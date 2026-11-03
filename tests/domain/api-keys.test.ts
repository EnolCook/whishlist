import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";
import { before, test } from "node:test";
import { NextRequest } from "next/server";
import { API_KEY_PREFIX, createApiKey, findApiKey } from "../../src/auth/api-keys";
import {
  MAX_API_KEYS,
  MAX_API_KEY_NAME,
  addApiKey,
  apiKeyNameError,
  findApiKeyByHash,
  listApiKeys,
  revokeApiKey,
  touchApiKey,
} from "../../src/domain/api-keys";
import { issueApiSession } from "../../src/auth/api-session";
import { deleteAccount } from "../../src/domain/account";
import { createPasswordReset, resetPasswordWithToken } from "../../src/domain/password-reset";
import { changePassword } from "../../src/domain/users";
import { apiKeyUser, optionalApiUser, usesApiKey } from "../../src/server/api/auth";
import { withApi } from "../../src/server/api/http";
import { createMyApiKey, revokeMyApiKey } from "../../src/server/commands/api-keys";
import { closeStore, databaseFilePath, openStore, readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";
import { withTempDataPath } from "./helpers/temp-store";

before(ensurePasswordHash);

function withKey(name = "Claude") {
  const doc = apiDoc();
  const created = createApiKey(doc, doc.users[0]!, { name }, Date.parse("2026-11-02T10:00:00Z"));
  if (!created.ok) throw new Error(created.error);
  return created;
}

const bearer = (token: string) => new NextRequest("http://localhost/api/v1/lists", { headers: { authorization: `Bearer ${token}` } });

test("création : préfixe oys_, gardée hachée, indice des 4 derniers caractères, jeton rendu une seule fois", () => {
  const { doc, token, key } = withKey();
  assert.ok(token.startsWith(API_KEY_PREFIX));
  const stored = doc.apiKeys[0]!;
  assert.notEqual(stored.tokenHash, token);
  assert.ok(!JSON.stringify(doc.apiKeys).includes(token), "le jeton en clair n'est nulle part dans la base");
  assert.equal(key.hint, token.slice(-4));
  assert.deepEqual(listApiKeys(doc, "alex"), [{ id: key.id, name: "Claude", hint: key.hint, createdAt: "2026-11-02T10:00:00.000Z", lastUsedAt: null }]);
  assert.deepEqual(listApiKeys(doc, "camille"), []);
});

test("création refusée : sans nom, nom trop long, plus de 20 clés", () => {
  const doc = apiDoc();
  const alex = doc.users[0]!;
  assert.deepEqual(createApiKey(doc, alex, { name: "  " }), { ok: false, error: "apiKeyNeedsName" });
  assert.deepEqual(createApiKey(doc, alex, { name: "x".repeat(61) }), { ok: false, error: "apiKeyNameTooLong" });
  let current = doc;
  for (let i = 0; i < MAX_API_KEYS; i++) {
    const created = createApiKey(current, alex, { name: `clé ${i}` });
    assert.ok(created.ok);
    if (created.ok) current = created.doc;
  }
  assert.deepEqual(createApiKey(current, alex, { name: "une de trop" }), { ok: false, error: "apiKeyLimit" });
});

test("règles du domaine : nom de 1 à 60 caractères après nettoyage, la clé garde le hachage et l'indice reçus", () => {
  assert.equal(apiKeyNameError(""), "apiKeyNeedsName");
  assert.equal(apiKeyNameError("x".repeat(MAX_API_KEY_NAME)), null);
  assert.equal(apiKeyNameError("x".repeat(MAX_API_KEY_NAME + 1)), "apiKeyNameTooLong");
  const doc = apiDoc();
  const alex = doc.users[0]!;
  const padded = addApiKey(doc, alex, { name: `  ${"x".repeat(MAX_API_KEY_NAME)}  `, tokenHash: "hachage", hint: "abcd" });
  assert.ok(padded.ok, "les espaces autour du nom ne comptent pas");
  if (!padded.ok) return;
  assert.equal(padded.key.name, "x".repeat(MAX_API_KEY_NAME));
  assert.equal(padded.key.hint, "abcd");
  assert.equal(findApiKeyByHash(padded.doc, "hachage")?.user.id, "alex");
  assert.equal(findApiKeyByHash(padded.doc, "autre"), null);
  assert.equal(doc.apiKeys.length, 0, "la base reçue n'est pas modifiée");
});

test("retrouver une clé : bonne clé → son compte ; autre jeton, clé révoquée ou compte supprimé → rien", () => {
  const { doc, token, key } = withKey();
  assert.equal(findApiKey(doc, token)?.user.id, "alex");
  assert.equal(findApiKey(doc, `${token}x`), null);
  assert.equal(findApiKey(doc, "jeton-de-session"), null);
  assert.deepEqual(revokeApiKey(doc, { userId: "camille", keyId: key.id }), { ok: false, error: "apiKeyMissing" });
  const revoked = revokeApiKey(doc, { userId: "alex", keyId: key.id });
  assert.ok(revoked.ok);
  if (revoked.ok) assert.equal(findApiKey(revoked.doc, token), null);
  const deleted = deleteAccount(doc, { userId: "alex" });
  assert.ok(deleted.ok);
  if (deleted.ok) assert.deepEqual(deleted.doc.apiKeys, []);
});

test("dernière utilisation : notée, puis pas réécrite avant une heure", () => {
  const { doc, key } = withKey();
  const first = touchApiKey(doc, key.id, Date.parse("2026-11-02T10:00:00Z"));
  assert.equal(first?.apiKeys[0]?.lastUsedAt, "2026-11-02T10:00:00.000Z");
  assert.equal(touchApiKey(first!, key.id, Date.parse("2026-11-02T10:59:00Z")), null);
  assert.equal(touchApiKey(first!, key.id, Date.parse("2026-11-02T11:01:00Z"))?.apiKeys[0]?.lastUsedAt, "2026-11-02T11:01:00.000Z");
});

test("clé valide : donne son compte et note son utilisation ; reconnue comme clé, jamais comme session de l'app", async () => {
  const { doc, token } = withKey();
  await withStore(doc, async () => {
    assert.equal(usesApiKey(bearer(token)), true);
    assert.equal(usesApiKey(bearer("jeton-de-session")), false);
    assert.equal((await apiKeyUser(token))?.id, "alex");
    assert.ok((await readDocument()).apiKeys[0]?.lastUsedAt);
    assert.equal(await apiKeyUser(`${API_KEY_PREFIX}inconnue`), null);
    assert.equal(await optionalApiUser(bearer(token)), null, "l'API JSON ne prend pas une clé pour un compte");
  });
});

test("API : au-delà de 120 requêtes par minute, la clé est limitée ; une autre clé du compte ne l'est pas", async () => {
  const { doc, token } = withKey();
  const second = createApiKey(doc, doc.users[0]!, { name: "Script" });
  assert.ok(second.ok);
  if (!second.ok) return;
  await withStore(second.doc, async () => {
    for (let i = 0; i < 120; i++) await apiKeyUser(token);
    await assert.rejects(() => apiKeyUser(token), (error: Error) => error.message === "rateLimited");
    assert.equal((await apiKeyUser(second.token))?.id, "alex", "la limite est par clé");
  });
});

test("API JSON : une clé est refusée sur toute route (403 apiKeyNotAllowed) avant le handler ; elle n'ouvre que /api/mcp", async () => {
  const { token } = withKey();
  let called = false;
  const route = withApi(async () => {
    called = true;
    return new Response(null, { status: 204 });
  });
  const refused = await route(bearer(token), { params: Promise.resolve({}) });
  assert.equal(refused.status, 403);
  assert.equal(((await refused.json()) as { error: { code: string } }).error.code, "apiKeyNotAllowed");
  assert.equal(called, false);
});

test("commandes de la page Compte : créer puis révoquer ; un compte ne révoque pas la clé d'un autre", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const created = await createMyApiKey(ctx(doc.users[0]!), { name: "Script" });
    assert.ok(created.ok);
    if (!created.ok) return;
    assert.deepEqual(await revokeMyApiKey(ctx(doc.users[1]!), { keyId: created.key.id }), { ok: false, error: "apiKeyMissing" });
    assert.deepEqual(await revokeMyApiKey(ctx(doc.users[0]!), { keyId: created.key.id }), { ok: true });
    assert.deepEqual((await readDocument()).apiKeys, []);
  });
});

test("réinitialisation ou changement du mot de passe : les clés du compte sont révoquées, celles des autres restent", async () => {
  const { doc } = withKey();
  const other = createApiKey(doc, doc.users[1]!, { name: "Autre" });
  assert.ok(other.ok);
  if (!other.ok) return;
  const asked = createPasswordReset(other.doc, { email: doc.users[0]!.email });
  assert.ok(asked.token);
  const reset = await resetPasswordWithToken(asked.doc, { token: asked.token!, password: "nouveau-mdp-solide" });
  assert.ok(reset.ok);
  if (!reset.ok) return;
  assert.deepEqual(reset.doc.apiKeys.map((key) => key.userId), [doc.users[1]!.id]);
  assert.equal(findApiKey(reset.doc, other.token)?.user.id, doc.users[1]!.id);

  const changed = await changePassword(other.doc, { userId: doc.users[0]!.id, password: "nouveau-mdp-solide" });
  assert.ok(changed.ok);
  if (changed.ok) assert.deepEqual(changed.doc.apiKeys.map((key) => key.userId), [doc.users[1]!.id]);
});

test("page Compte : au plus 10 créations de clé par heure", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    for (let i = 0; i < 10; i++) assert.ok((await createMyApiKey(ctx(doc.users[0]!), { name: `Clé ${i}` })).ok);
    await assert.rejects(() => createMyApiKey(ctx(doc.users[0]!), { name: "Une de trop" }), (error: Error) => error.message === "rateLimited");
    assert.equal((await readDocument()).apiKeys.length, 10);
  });
});

test("jeton de session de l'app : jamais avec le préfixe des clés, sinon il serait lu comme une clé", () => {
  const tokens = ["oys_premier", "oys_second", "jeton-normal"];
  const issued = issueApiSession(apiDoc(), apiDoc().users[0]!, Date.now(), () => tokens.shift()!);
  assert.equal(issued.token, "jeton-normal");
  assert.equal(usesApiKey(bearer(issued.token)), false);
});

test("base existante d'avant les clés : la migration ajoute la table api_keys, vide", async () => {
  await withTempDataPath(async () => {
    const file = databaseFilePath();
    const journal = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    const before = journal.entries.filter((entry) => entry.tag < "0005");
    assert.deepEqual(before.map((entry) => entry.tag.slice(0, 4)), ["0000", "0001", "0002", "0003", "0004"]);

    // La base telle qu'elle était : les migrations 0000 à 0004 appliquées.
    const old = new Database(file);
    old.exec("CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)");
    for (const entry of before) {
      const sql = readFileSync(path.join(process.cwd(), "drizzle", `${entry.tag}.sql`), "utf8");
      for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) old.exec(statement);
      old.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(entry.tag, entry.when);
    }
    old.exec("insert into meta values ('legacy_import', 'none')");
    old.close();

    openStore();
    assert.deepEqual((await readDocument()).apiKeys, []);
    closeStore();
    const check = new Database(file, { readonly: true });
    try {
      const columns = (check.prepare("pragma table_info(api_keys)").all() as { name: string }[]).map((c) => c.name);
      assert.deepEqual(columns, ["id", "user_id", "name", "token_hash", "hint", "created_at", "last_used_at"]);
    } finally {
      check.close();
    }
  });
});
