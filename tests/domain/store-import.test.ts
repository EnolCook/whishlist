import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { findApiSessionUser, issueApiSession } from "../../src/auth/api-session";
import { createPasswordReset, resetPasswordWithToken } from "../../src/domain/password-reset";
import { DEFAULT_WISHLIST_THEME } from "../../src/domain/theme";
import type { Database as Doc } from "../../src/domain/types";
import { closeStore, databaseFilePath, openStore, readDocument } from "../../src/store/db";
import { LegacyImportError } from "../../src/store/legacy-json";
import { apiDoc } from "./helpers/api-fixtures";
import { withTempDataPath } from "./helpers/temp-store";

const run = promisify(execFile);

function marker(): string | undefined {
  const row = openStore().reader.prepare("select value from meta where key = 'legacy_import'").get() as
    | { value: string }
    | undefined;
  return row?.value;
}

function assertNoDatabase(): void {
  const file = databaseFilePath();
  for (const suffix of ["", "-wal", "-shm"]) assert.equal(existsSync(`${file}${suffix}`), false, `${file}${suffix}`);
}

async function assertRefused(dataPath: string, content: string, expected: RegExp, forbidden: string[] = []) {
  await writeFile(dataPath, content, "utf8");
  let error: unknown;
  try {
    openStore();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof LegacyImportError, String(error));
  assert.match(error.problems.join("\n"), expected);
  for (const value of forbidden) assert.equal(error.message.includes(value), false, `le message cite ${value}`);
  assertNoDatabase();
  assert.equal(await readFile(dataPath, "utf8"), content);
}

test("import : tout le fichier est repris tel quel, puis marqué importé", async () => {
  await withTempDataPath(async (dataPath) => {
    const doc = apiDoc();
    doc.users[0].passwordHash = "scrypt$hash-alex";
    await writeFile(dataPath, JSON.stringify(doc), "utf8");
    assert.deepStrictEqual(await readDocument(), doc);
    assert.match(marker() ?? "", /^imported:\d{4}-/);
  });
});

test("import : les champs anciens reçoivent leur valeur par défaut", async () => {
  await withTempDataPath(async (dataPath) => {
    const legacy = JSON.parse(JSON.stringify(apiDoc())) as Record<string, unknown> & Doc;
    delete (legacy as Partial<Doc>).subscriptions;
    delete (legacy as Partial<Doc>).apiSessions;
    delete (legacy as Partial<Doc>).passwordResets;
    delete (legacy as Partial<Doc>).emailConfirmations;
    const user = legacy.users[0] as Partial<Doc["users"][number]>;
    delete user.sessionVersion;
    delete user.mustChangePassword;
    delete user.emailVerifiedAt;
    const list = legacy.wishlists[0] as Partial<Doc["wishlists"][number]>;
    delete list.subtitle;
    delete list.coverImageUrl;
    delete list.readPasswordHash;
    list.theme = undefined;
    const item = legacy.items[0] as Partial<Doc["items"][number]>;
    delete item.imageUrl;
    delete item.archived;
    delete (legacy.reservations[0] as Partial<Doc["reservations"][number]>).userId;
    legacy.types.push({ id: "t0", wishlistId: "w", label: "Autres", sortOrder: 0 });
    // Les premiers fichiers n'avaient pas de sortOrder sur les libellés.
    for (const type of legacy.types) delete (type as Partial<Doc["types"][number]>).sortOrder;
    await writeFile(dataPath, JSON.stringify(legacy), "utf8");

    const doc = await readDocument();
    assert.deepEqual(doc.subscriptions, []);
    assert.deepEqual(doc.apiSessions, []);
    assert.deepEqual(doc.passwordResets, []);
    assert.deepEqual(doc.emailConfirmations, []);
    // Compte d'avant la validation des adresses : vérifié à sa date de création (010, FR-005b).
    assert.equal(doc.users[0].emailVerifiedAt, doc.users[0].createdAt);
    assert.equal(doc.users[0].sessionVersion, 0);
    assert.equal(doc.users[0].mustChangePassword, false);
    assert.equal(doc.wishlists[0].subtitle, null);
    assert.equal(doc.wishlists[0].coverImageUrl, null);
    assert.equal(doc.wishlists[0].readPasswordHash, null);
    assert.deepEqual(doc.wishlists[0].theme, DEFAULT_WISHLIST_THEME);
    assert.equal(doc.items[0].imageUrl, null);
    assert.equal(doc.items[0].archived, false);
    assert.equal(doc.reservations[0].userId, null);
    // sortOrder absents : ordre alphabétique recalculé (Autres, Jeux).
    assert.deepEqual(
      doc.types.map((t) => [t.id, t.sortOrder]),
      [
        ["t", 1],
        ["t0", 0],
      ],
    );
  });
});

test("pas de réimport : la base fait foi, l'ancien fichier n'est plus touché", async () => {
  await withTempDataPath(async (dataPath) => {
    await writeFile(dataPath, JSON.stringify(apiDoc()), "utf8");
    openStore();
    closeStore();
    const changed = apiDoc();
    changed.wishlists[0].title = "Changé dans le JSON";
    await writeFile(dataPath, JSON.stringify(changed), "utf8");
    const before = await stat(dataPath);
    assert.equal((await readDocument()).wishlists[0].title, "Liste d'Alex");
    const after = await stat(dataPath);
    assert.equal(after.mtimeMs, before.mtimeMs);
    assert.equal(await readFile(dataPath, "utf8"), JSON.stringify(changed));
  });
});

test("installation neuve : base vide, marquée sans import", async () => {
  await withTempDataPath(async () => {
    const doc = await readDocument();
    assert.equal(doc.users.length, 0);
    assert.equal(marker(), "none");
  });
});

test("refus : JSON invalide ou collection absente, sans base créée ni fichier modifié", async () => {
  await withTempDataPath(async (dataPath) => {
    await assertRefused(dataPath, "{ \"users\": [", /JSON invalide/);
    // Le message de JSON.parse cite un extrait du fichier : il ne doit pas arriver dans le journal.
    await assertRefused(
      dataPath,
      '{"users":[{"email":"alex@example.test","passwordHash":"scrypt$secret" oops',
      /^JSON invalide \((ligne \d+, colonne \d+|position \d+)\)$/m,
      ["alex@example.test", "scrypt$secret", "oops"],
    );
    const noItems: Record<string, unknown> = { ...apiDoc() };
    delete noItems.items;
    await assertRefused(dataPath, JSON.stringify(noItems), /^items: collection absente/m);
  });
});

test("refus : chaque contrôle d'intégrité nomme la collection et l'identifiant, jamais l'e-mail ni le nom", async () => {
  const cases: [string, (doc: Doc) => void, RegExp][] = [
    ["identifiant en double", (d) => d.items.push({ ...d.items[0] }), /^items: identifiant en double \(gift\)/m],
    [
      "adhésion en double",
      (d) => d.memberships.push({ ...d.memberships[0] }),
      /^memberships: adhésion en double \(w\/alex\)/m,
    ],
    [
      "e-mail en double",
      (d) => (d.users[1].email = d.users[0].email),
      /^users: e-mail en double \(alex, camille\)/m,
    ],
    [
      "readToken en double",
      (d) => d.wishlists.push({ ...d.wishlists[0], id: "w2", inviteToken: "it2" }),
      /^wishlists: readToken en double \(w, w2\)/m,
    ],
    [
      "deux réservations pour une idée",
      (d) => d.reservations.push({ ...d.reservations[0], id: "r-2" }),
      /^reservations: plusieurs réservations pour la même idée \(r-taken, r-2\)/m,
    ],
    [
      "idée vers une liste absente",
      (d) => (d.items[0].wishlistId = "w-9"),
      /^items: gift → wishlistId absent \(w-9\)/m,
    ],
    [
      "confirmation d'adresse vers un compte absent",
      (d) =>
        d.emailConfirmations.push({
          id: "ec",
          userId: "u-9",
          purpose: "verify",
          email: "alex@example.test",
          tokenHash: "h",
          expiresAt: "2026-01-02T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      /^emailConfirmations: ec → userId absent \(u-9\)/m,
    ],
    [
      "deux demandes du même motif pour un compte",
      (d) => {
        const request = {
          userId: "alex",
          purpose: "change" as const,
          email: "alex.b@example.test",
          expiresAt: "2026-01-02T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        };
        d.emailConfirmations.push({ ...request, id: "ec-1", tokenHash: "h1" }, { ...request, id: "ec-2", tokenHash: "h2" });
      },
      /^emailConfirmations: plusieurs demandes du même motif pour un compte \(ec-1, ec-2\)/m,
    ],
    [
      "vue vers un libellé absent",
      (d) => d.views.push({ id: "v", wishlistId: "w", label: "V", kind: "types", typeIds: ["t-9"], personId: null, pinned: false }),
      /^views: v → typeIds absent \(t-9\)/m,
    ],
    [
      "abonnement en double",
      (d) =>
        d.subscriptions.push(
          { wishlistId: "w", userId: "camille", readPasswordHash: null, createdAt: "2026-01-01T00:00:00.000Z" },
          { wishlistId: "w", userId: "camille", readPasswordHash: null, createdAt: "2026-01-02T00:00:00.000Z" },
        ),
      /^subscriptions: abonnement en double \(w\/camille\)/m,
    ],
    [
      "abonnement vers une liste absente",
      (d) =>
        d.subscriptions.push({
          wishlistId: "w-9",
          userId: "camille",
          readPasswordHash: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      /^subscriptions: w-9\/camille → wishlistId absent \(w-9\)/m,
    ],
  ];
  for (const [label, breakDoc, expected] of cases) {
    await withTempDataPath(async (dataPath) => {
      const doc = apiDoc();
      breakDoc(doc);
      await assertRefused(dataPath, JSON.stringify(doc), expected, ["alex@example.test", "camille@example.test", "Camille"]);
    }).catch((error) => {
      throw new Error(`${label} : ${(error as Error).message}`);
    });
  }
});

test("refus : champ obligatoire absent ou de mauvais type, nommé par collection et identifiant", async () => {
  const cases: [(doc: Record<string, unknown[]>) => void, RegExp][] = [
    [(d) => delete (d.items[1] as Record<string, unknown>).name, /^items: gift2 → name absent ou invalide$/m],
    [(d) => ((d.users[0] as Record<string, unknown>).displayName = 42), /^users: alex → displayName absent ou invalide$/m],
    [(d) => ((d.memberships[0] as Record<string, unknown>).role = "admin"), /^memberships: w\/alex → role absent ou invalide$/m],
    [
      (d) => d.views.push({ id: "v", wishlistId: "w", label: "V", kind: "types", personId: null, pinned: false }),
      /^views: v → typeIds absent ou invalide$/m,
    ],
  ];
  for (const [breakDoc, expected] of cases) {
    await withTempDataPath(async (dataPath) => {
      const doc = JSON.parse(JSON.stringify(apiDoc())) as Record<string, unknown[]>;
      breakDoc(doc);
      await assertRefused(dataPath, JSON.stringify(doc), expected, ["alex@example.test", "Alex"]);
    });
  }
});

test("tout ou rien : un échec au milieu de l'import ne garde rien, la fois suivante importe tout", async () => {
  await withTempDataPath(async (dataPath) => {
    // Base existante sans marque d'import, qui contient déjà une idée `gift2` :
    // l'import échoue sur cette idée, après les comptes, les listes et les libellés.
    const writer = openStore().writer;
    writer.exec("delete from meta");
    writer.exec(`insert into wishlists values ('w9', 'L', null, null, '{}', 'rt9', 'it9', null, 0, '2026-01-01')`);
    writer.exec("insert into types values ('t9', 'w9', 'T', 0)");
    writer.exec("insert into people values ('p9', 'w9', 'P')");
    writer.exec(
      "insert into items (id, wishlist_id, name, type_id, person_id, sort_order) values ('gift2', 'w9', 'Déjà là', 't9', 'p9', 0)",
    );
    closeStore();
    await writeFile(dataPath, JSON.stringify(apiDoc()), "utf8");

    assert.throws(() => openStore(), /UNIQUE|PRIMARY KEY/);
    const check = new Database(databaseFilePath(), { readonly: true });
    try {
      assert.equal((check.prepare("select count(*) as n from users").get() as { n: number }).n, 0);
      assert.equal((check.prepare("select count(*) as n from meta").get() as { n: number }).n, 0);
      assert.equal((check.prepare("select count(*) as n from items").get() as { n: number }).n, 1);
    } finally {
      check.close();
    }

    const fix = new Database(databaseFilePath());
    fix.exec("delete from items; delete from people; delete from types; delete from wishlists");
    fix.close();
    assert.deepStrictEqual(await readDocument(), apiDoc());
    assert.match(marker() ?? "", /^imported:/);
  });
});

test("un seul import quand deux processus ouvrent la même base neuve", async () => {
  await withTempDataPath(async (dataPath) => {
    await writeFile(dataPath, JSON.stringify(apiDoc()), "utf8");
    const helper = path.join(import.meta.dirname, "helpers", "open-store.ts");
    const outputs = await Promise.all(
      [1, 2].map(() => run(process.execPath, ["--import", "tsx", helper, dataPath], { cwd: process.cwd() })),
    );
    for (const { stdout } of outputs) assert.deepEqual(JSON.parse(stdout.trim().split("\n").at(-1)!), { users: 2, markers: 1 });
    assert.equal((await readDocument()).users.length, 2);
  });
});

test("sessions expirées importées : toujours refusées", async () => {
  await withTempDataPath(async (dataPath) => {
    const base = apiDoc();
    const expired = issueApiSession(base, base.users[0], Date.parse("2020-01-01T00:00:00.000Z"));
    const live = issueApiSession(expired.doc, expired.doc.users[1]);
    await writeFile(dataPath, JSON.stringify(live.doc), "utf8");
    const doc = await readDocument();
    assert.deepStrictEqual(doc.apiSessions, live.doc.apiSessions);
    assert.equal(findApiSessionUser(doc, expired.token), null);
    assert.equal(findApiSessionUser(doc, live.token)?.id, "camille");
  });
});

test("demande de réinitialisation expirée importée : toujours refusée", async () => {
  await withTempDataPath(async (dataPath) => {
    const issued = createPasswordReset(apiDoc(), {
      email: "alex@example.test",
      now: new Date("2020-01-01T00:00:00.000Z"),
    });
    assert.ok(issued.token);
    await writeFile(dataPath, JSON.stringify(issued.doc), "utf8");
    const doc = await readDocument();
    assert.deepStrictEqual(doc.passwordResets, issued.doc.passwordResets);
    const reset = await resetPasswordWithToken(doc, { token: issued.token, password: "nouveau-mot-de-passe" });
    assert.equal(reset.ok, false);
  });
});

test("migration 0001 : les comptes d'une base existante sont vérifiés à leur date de création", async () => {
  await withTempDataPath(async () => {
    const { readMigrationFiles } = await import("drizzle-orm/migrator");
    const [init] = readMigrationFiles({ migrationsFolder: path.join(process.cwd(), "drizzle") });
    // Base telle qu'en prod avant la 010 : seule la migration initiale, un compte.
    const old = new Database(databaseFilePath());
    for (const statement of init.sql) if (statement.trim()) old.exec(statement);
    old.exec("CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)");
    old.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(init.hash, init.folderMillis);
    old.prepare("INSERT INTO meta (key, value) VALUES ('legacy_import', 'none')").run();
    old
      .prepare(
        "INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES ('u', 'u@example.test', 'h', 'U', '2026-03-01T00:00:00.000Z')",
      )
      .run();
    old.close();

    const doc = await readDocument();
    assert.equal(doc.users[0].emailVerifiedAt, "2026-03-01T00:00:00.000Z");
    assert.deepEqual(doc.emailConfirmations, []);
  });
});
