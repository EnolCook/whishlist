import assert from "node:assert/strict";
import { test } from "node:test";
import { exportAccount } from "../../src/domain/account";
import { exportFileName, isExportFileName } from "../../src/domain/export-file";
import type { Locale } from "../../src/i18n/config";
import { accountDoc } from "./helpers/account-fixtures";

const NOW = new Date("2026-10-28T10:00:00.000Z");
const SITE: { origin: string; locale: Locale } = { origin: "https://ohyoushouldnt.example.test", locale: "fr" };

function exported(site = SITE) {
  const data = exportAccount(accountDoc(), "lou", site, NOW);
  assert.ok(data);
  return data;
}

test("en-tête du document et compte", () => {
  const data = exported();
  assert.equal(data.format, "ohyoushouldnt-export");
  assert.equal(data.version, 1);
  assert.equal(data.exportedAt, NOW.toISOString());
  assert.deepEqual(data.account, {
    email: "lou@example.test",
    displayName: "Lou",
    createdAt: "2026-01-01T00:00:00.000Z",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    pendingEmail: null,
  });
});

test("chaque liste dont elle est membre, avec son rôle et ses contenus par libellé", () => {
  const data = exported();
  assert.deepEqual(
    data.lists.map((list) => [list.title, list.role]),
    [
      ["Anniversaire Lou", "owner"],
      ["Noël en famille", "owner"],
      ["Envies d'Alex", "member"],
    ],
  );
  const shared = data.lists[1]!;
  assert.equal(shared.publicUrl, "https://ohyoushouldnt.example.test/l/read-shared");
  assert.deepEqual(shared.members, [
    { displayName: "Lou", role: "owner", joinedAt: "2026-01-01T00:00:00.000Z" },
    { displayName: "Camille", role: "member", joinedAt: "2026-03-01T00:00:00.000Z" },
    { displayName: "Alex", role: "member", joinedAt: "2026-02-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(shared.categories, [{ label: "Catégorie shared", sortOrder: 0 }]);
  assert.deepEqual(shared.people, [{ label: "Qui shared" }]);
  assert.deepEqual(shared.items, [
    {
      name: "Idée shared",
      category: "Catégorie shared",
      person: "Qui shared",
      priceCents: 2500,
      url: "https://shop.example.test/idee",
      imageUrl: null,
      priority: null,
      secondHandOk: false,
      description: null,
      archived: false,
    },
  ]);
  assert.deepEqual(shared.reservations, [
    { item: "Idée shared", fromName: "Camille", note: "Pour Noël", createdAt: "2026-04-02T00:00:00.000Z", byMe: false },
  ]);
  assert.equal(data.lists[2]!.reservations[0]!.byMe, true);
});

test("l'adresse publique suit la langue demandée", () => {
  const data = exported({ ...SITE, locale: "en" });
  assert.equal(data.lists[0]!.publicUrl, "https://ohyoushouldnt.example.test/en/l/read-solo");
});

test("myReservations : seulement ses réservations sur des listes dont elle n'est pas membre", () => {
  assert.deepEqual(exported().myReservations, [
    { listTitle: "Liste de Camille", item: "Idée other", fromName: "Lou", note: "Surprise", createdAt: "2026-04-04T00:00:00.000Z" },
  ]);
});

test("subscriptions : seulement les listes suivies par ce compte, jamais qui suit ses propres listes", () => {
  assert.deepEqual(exported().subscriptions, [
    {
      title: "Liste de Camille",
      subtitle: null,
      publicUrl: "https://ohyoushouldnt.example.test/l/read-other",
      subscribedAt: "2026-04-04T00:00:00.000Z",
    },
  ]);
});

test("readPasswordProtected dit si un mot de passe de lecture existe", () => {
  const data = exported();
  assert.deepEqual(
    data.lists.map((list) => list.readPasswordProtected),
    [false, false, true],
  );
});

test("aucun secret ni donnée d'un autre compte dans le fichier", () => {
  const doc = accountDoc();
  const json = JSON.stringify(exportAccount(doc, "lou", SITE, NOW));
  const lou = doc.users.find((u) => u.id === "lou")!;
  assert.equal(json.includes("passwordHash"), false);
  assert.equal(json.includes(lou.passwordHash), false);
  assert.equal(json.includes("sessionVersion"), false);
  assert.equal(json.includes("mustChangePassword"), false);
  assert.equal(json.includes("invite-"), false, "inviteToken");
  assert.equal(json.includes("inviteToken"), false);
  assert.equal(json.includes("scrypt$read-secret"), false, "readPasswordHash");
  assert.equal(json.includes("readPasswordHash"), false);
  assert.equal(json.includes("api-token-hash"), false, "apiSessions");
  assert.equal(json.includes("reset-token-hash"), false, "passwordResets");
  assert.equal(json.includes("alex@example.test"), false);
  assert.equal(json.includes("camille@example.test"), false);
  assert.equal(json.includes('"alex"'), false, "id d'un autre compte");
  assert.equal(json.includes('"camille"'), false, "id d'un autre compte");
});

test("un compte inexistant : null", () => {
  assert.equal(exportAccount(accountDoc(), "ghost", SITE, NOW), null);
});

test("nom du fichier d'export : daté, et dans la langue du compte", () => {
  assert.equal(exportFileName("2026-10-28T10:00:00.000Z", "fr"), "ohyoushouldnt-donnees-2026-10-28.json");
  assert.equal(exportFileName("2026-10-28T10:00:00.000Z", "en"), "ohyoushouldnt-data-2026-10-28.json");
  assert.equal(isExportFileName("ohyoushouldnt-donnees-2026-10-28.json"), true);
  assert.equal(isExportFileName("ohyoushouldnt-data-2026-10-28.json"), true);
  assert.equal(isExportFileName("autre.json"), false);
});

test("un changement d'adresse en attente figure dans l'export (FR-020)", () => {
  const doc = accountDoc();
  doc.emailConfirmations.push({
    id: "ec",
    userId: "lou",
    purpose: "change",
    email: "lou.b@example.test",
    tokenHash: "h",
    expiresAt: "2026-10-29T10:00:00.000Z",
    createdAt: "2026-10-28T10:00:00.000Z",
  });
  assert.equal(exportAccount(doc, "lou", SITE, NOW)?.account.pendingEmail, "lou.b@example.test");
});
