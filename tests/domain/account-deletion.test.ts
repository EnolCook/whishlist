import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteAccount, previewAccountDeletion } from "../../src/domain/account";
import type { Database } from "../../src/domain/types";
import { accountDoc } from "./helpers/account-fixtures";

function deleted(doc: Database = accountDoc(), userId = "lou"): Database {
  const result = deleteAccount(doc, { userId });
  assert.ok(result.ok);
  return result.doc;
}

function owners(doc: Database, wishlistId: string): string[] {
  return doc.memberships.filter((m) => m.wishlistId === wishlistId && m.role === "owner").map((m) => m.userId);
}

test("une liste dont elle est la seule membre disparaît avec tout son contenu", () => {
  const doc = deleted();
  assert.equal(doc.wishlists.some((w) => w.id === "solo"), false);
  for (const key of ["memberships", "subscriptions", "types", "people", "views", "items", "reservations"] as const) {
    assert.equal(
      (doc[key] as { wishlistId: string }[]).some((entry) => entry.wishlistId === "solo"),
      false,
      key,
    );
  }
});

test("une liste partagée dont elle est propriétaire passe au membre le plus ancien", () => {
  const doc = deleted();
  assert.ok(doc.wishlists.some((w) => w.id === "shared"));
  assert.deepEqual(owners(doc, "shared"), ["alex"]);
  assert.equal(doc.memberships.find((m) => m.wishlistId === "shared" && m.userId === "camille")?.role, "member");
});

test("à date d'arrivée égale, l'héritier est départagé par son identifiant", () => {
  const doc = accountDoc();
  for (const m of doc.memberships) {
    if (m.wishlistId === "shared" && m.userId !== "lou") m.joinedAt = "2026-02-01T00:00:00.000Z";
  }
  assert.deepEqual(owners(deleted(doc), "shared"), ["alex"]);
});

test("une liste partagée dont elle est membre perd seulement son adhésion", () => {
  const doc = deleted();
  assert.deepEqual(
    doc.memberships.filter((m) => m.wishlistId === "alexs").map((m) => [m.userId, m.role]),
    [["alex", "owner"]],
  );
});

test("ses réservations sur les listes qui restent sont gardées, sans lien au compte", () => {
  const doc = deleted();
  for (const id of ["r-alexs", "r-other"]) {
    const reservation = doc.reservations.find((r) => r.id === id);
    assert.ok(reservation, id);
    assert.equal(reservation.userId, null);
    assert.equal(reservation.fromName, "Lou");
  }
  assert.equal(doc.reservations.find((r) => r.id === "r-alexs")?.note, "Avec Camille");
  assert.equal(doc.reservations.find((r) => r.id === "r-shared")?.userId, "camille");
});

test("ses connexions et liens de réinitialisation disparaissent, pas ceux des autres", () => {
  const doc = deleted();
  assert.deepEqual(doc.apiSessions.map((s) => s.userId), ["alex"]);
  assert.deepEqual(doc.passwordResets.map((r) => r.userId), ["alex"]);
});

test("plus rien ne référence le compte, et chaque liste restante a un seul propriétaire", () => {
  const doc = deleted();
  assert.equal(doc.users.some((u) => u.id === "lou"), false);
  assert.equal(JSON.stringify(doc).includes('"lou"'), false);
  for (const wishlist of doc.wishlists) {
    assert.equal(owners(doc, wishlist.id).length, 1, wishlist.id);
  }
  assert.deepEqual(doc.wishlists.map((w) => w.id), ["shared", "alexs", "other"]);
});

test("le document d'entrée n'est pas modifié", () => {
  const doc = accountDoc();
  const before = JSON.stringify(doc);
  deleted(doc);
  assert.equal(JSON.stringify(doc), before);
});

test("un compte inexistant : accountMissing", () => {
  const doc = accountDoc();
  assert.deepEqual(deleteAccount(doc, { userId: "ghost" }), { ok: false, error: "accountMissing" });
});

test("l'aperçu annonce ce que fait la suppression", () => {
  const doc = accountDoc();
  assert.deepEqual(previewAccountDeletion(doc, "lou"), {
    deletedLists: [{ id: "solo", title: "Anniversaire Lou" }],
    transferredLists: [
      { id: "shared", title: "Noël en famille", newOwnerName: "Alex" },
      { id: "alexs", title: "Envies d'Alex", newOwnerName: null },
    ],
    reservationsKept: 2,
    // Seules les listes suivies sans en être membre sont annoncées.
    followedLists: [{ id: "other", title: "Liste de Camille" }],
  });
  const after = deleted(doc);
  assert.equal(after.reservations.filter((r) => ["r-alexs", "r-other"].includes(r.id)).length, 2);
});

test("l'aperçu ne compte pas une réservation sur une liste qui sera effacée", () => {
  const doc = accountDoc();
  doc.reservations.push({
    id: "r-own",
    wishlistId: "solo",
    itemId: "solo-item",
    fromName: "Lou",
    note: null,
    userId: "lou",
    createdAt: "2026-04-05T00:00:00.000Z",
  });
  assert.equal(previewAccountDeletion(doc, "lou").reservationsKept, 2);
});

test("ses demandes de confirmation d'adresse disparaissent avec le compte", () => {
  const doc = accountDoc();
  for (const purpose of ["verify", "change"] as const) {
    doc.emailConfirmations.push({
      id: `ec-${purpose}`,
      userId: "lou",
      purpose,
      email: purpose === "verify" ? "lou@example.test" : "lou.b@example.test",
      tokenHash: `h-${purpose}`,
      expiresAt: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  }
  assert.deepEqual(deleted(doc).emailConfirmations, []);
});
