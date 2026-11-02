import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createWishlist } from "../../src/domain/import";
import { copyItem, createItem, moveItem } from "../../src/domain/items";
import { emptyDatabase, type Database } from "../../src/domain/types";
import { copyItem as copyCommand, moveItem as moveCommand } from "../../src/server/commands/items";
import { ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

const CLIENT_ID = "copy-0123456789abcdef";

/** Alex est membre de « Anniversaire » (w1) et « Noël » (w2), pas de « Autre » (w3). */
function lists(): Database {
  let doc = emptyDatabase();
  for (const id of ["alex", "sam"]) {
    doc.users.push({ id, email: `${id}@example.test`, passwordHash: "x", displayName: id, createdAt: "2026-01-01T00:00:00.000Z", emailVerifiedAt: "2026-01-01T00:00:00.000Z", mustChangePassword: false });
  }
  for (const [id, title, owner] of [["w1", "Anniversaire", "alex"], ["w2", "Noël", "alex"], ["w3", "Autre", "sam"]] as const) {
    const created = createWishlist(doc, { ownerId: owner, title, importTemplate: false, id });
    if (!created.ok) throw new Error(created.error);
    doc = created.doc;
    doc.types.push({ id: `${id}-books`, wishlistId: id, label: "Livres", sortOrder: 0 }, { id: `${id}-misc`, wishlistId: id, label: "Divers", sortOrder: 1 });
    doc.people.push({ id: `${id}-alex`, wishlistId: id, label: "Alex" });
  }
  for (const [name, priority] of [["Liseuse", "3"], ["Roman", null], ["Puzzle", null]] as const) {
    const created = createItem(doc, { wishlistId: "w1", actorId: "alex", name, typeId: "w1-books", personId: "w1-alex", url: "https://shop.example.test/p", priceCents: 12900, priority, id: name.toLowerCase() });
    if (!created.ok) throw new Error(created.error);
    doc = created.doc;
  }
  return doc;
}

const toChristmas = { wishlistId: "w1", actorId: "alex", itemId: "liseuse", targetWishlistId: "w2", typeId: "w2-books", personId: "w2-alex" };

function reserve(doc: Database, itemId: string): Database {
  doc.reservations.push({ id: "r1", wishlistId: "w1", itemId, fromName: "Sam", note: null, userId: null, createdAt: "2026-01-02" });
  return doc;
}

// --- Déplacer ---

test("déplacer : l'idée change de liste, garde son identifiant et ses champs, prend la catégorie et le « qui » choisis", () => {
  const moved = moveItem(lists(), toChristmas);
  assert.ok(moved.ok);
  if (!moved.ok) return;
  const item = moved.doc.items.find((i) => i.id === "liseuse")!;
  assert.deepEqual(
    { wishlistId: item.wishlistId, typeId: item.typeId, personId: item.personId, name: item.name, url: item.url, priceCents: item.priceCents, priority: item.priority },
    { wishlistId: "w2", typeId: "w2-books", personId: "w2-alex", name: "Liseuse", url: "https://shop.example.test/p", priceCents: 12900, priority: "3" },
  );
  assert.equal(moved.doc.items.filter((i) => i.wishlistId === "w1").length, 2);
});

test("déplacer une idée réservée : refusé, rien ne change", () => {
  const doc = reserve(lists(), "liseuse");
  assert.deepEqual(moveItem(doc, toChristmas), { ok: false, error: "itemReservedCannotMove" });
  assert.equal(doc.items.find((i) => i.id === "liseuse")?.wishlistId, "w1");
});

test("droits : membre des deux listes ; catégorie et « qui » doivent être ceux de la liste d'arrivée", () => {
  const doc = lists();
  assert.deepEqual(moveItem(doc, { ...toChristmas, targetWishlistId: "w3", typeId: "w3-books", personId: "w3-alex" }), { ok: false, error: "notMember" });
  assert.deepEqual(moveItem(doc, { ...toChristmas, actorId: "sam" }), { ok: false, error: "notMember" });
  assert.deepEqual(moveItem(doc, { ...toChristmas, typeId: "w1-books" }), { ok: false, error: "typeNotInList" });
  assert.deepEqual(moveItem(doc, { ...toChristmas, personId: "w1-alex" }), { ok: false, error: "personNotInList" });
  assert.deepEqual(moveItem(doc, { ...toChristmas, itemId: "absent" }), { ok: false, error: "itemMissing" });
  for (const fn of [copyItem]) {
    assert.deepEqual(fn(doc, { ...toChristmas, targetWishlistId: "w3", typeId: "w3-books", personId: "w3-alex" }), { ok: false, error: "notMember" });
  }
});

test("déplacer : l'idée arrive en fin de la liste d'arrivée", () => {
  let doc = lists();
  const there = createItem(doc, { wishlistId: "w2", actorId: "alex", name: "Calendrier", typeId: "w2-books", personId: "w2-alex", id: "calendrier" });
  assert.ok(there.ok);
  if (!there.ok) return;
  doc = there.doc;
  const moved = moveItem(doc, toChristmas);
  assert.ok(moved.ok);
  if (!moved.ok) return;
  const order = (id: string) => moved.doc.items.find((i) => i.id === id)!.sortOrder;
  assert.ok(order("liseuse") > order("calendrier"));
});

// --- Copier ---

test("copier dans une autre liste : tous les champs, nouvel identifiant, l'original reste", () => {
  const doc = lists();
  const copied = copyItem(doc, { ...toChristmas, typeId: "w2-misc" });
  assert.ok(copied.ok);
  if (!copied.ok) return;
  assert.notEqual(copied.item.id, "liseuse");
  assert.deepEqual(
    { ...copied.item, id: "x", sortOrder: 0 },
    { ...doc.items.find((i) => i.id === "liseuse")!, id: "x", sortOrder: 0, wishlistId: "w2", typeId: "w2-misc", personId: "w2-alex" },
  );
  assert.equal(copied.doc.items.find((i) => i.id === "liseuse")?.wishlistId, "w1");
});

test("copier un champ inconnu de la règle (ajouté plus tard) : il suit aussi", () => {
  const doc = lists();
  (doc.items.find((i) => i.id === "liseuse") as unknown as Record<string, unknown>).futureField = "suit";
  const copied = copyItem(doc, toChristmas);
  assert.ok(copied.ok);
  if (!copied.ok) return;
  assert.equal((copied.item as unknown as Record<string, unknown>).futureField, "suit");
});

test("copier une idée réservée : permis, la copie n'est pas réservée ; une idée archivée donne une copie visible", () => {
  const doc = reserve(lists(), "liseuse");
  doc.items.find((i) => i.id === "liseuse")!.archived = true;
  const copied = copyItem(doc, toChristmas);
  assert.ok(copied.ok);
  if (!copied.ok) return;
  assert.equal(copied.item.archived, false);
  assert.ok(!copied.doc.reservations.some((r) => r.itemId === copied.item.id));
  assert.equal(copied.doc.reservations.length, 1);
});

test("copier dans la même liste : la copie se place juste après l'original", () => {
  const doc = lists();
  const copied = copyItem(doc, { ...toChristmas, itemId: "roman", targetWishlistId: "w1", typeId: "w1-books", personId: "w1-alex", id: "roman-2" });
  assert.ok(copied.ok);
  if (!copied.ok) return;
  const order = copied.doc.items.filter((i) => i.wishlistId === "w1").sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id);
  assert.deepEqual(order, ["liseuse", "roman", "roman-2", "puzzle"]);
});

// --- Commandes (site et API) ---

test("commande copier : un renvoi avec le même identifiant ne crée pas de deuxième copie", async () => {
  const doc = lists();
  await withStore(doc, async () => {
    const alex = ctx(doc.users[0]!);
    const input = { wishlistId: "w1", itemId: "liseuse", targetWishlistId: "w2", typeId: "w2-books", personId: "w2-alex", clientId: CLIENT_ID };
    const first = await copyCommand(alex, input);
    const again = await copyCommand(alex, input);
    assert.ok(first.ok && again.ok);
    if (!first.ok || !again.ok) return;
    assert.equal(first.replayed, false);
    assert.equal(again.replayed, true);
    assert.equal(again.item.id, CLIENT_ID);
    assert.deepEqual(await copyCommand(alex, { ...input, clientId: "pas un id" }), { ok: false, error: "idInvalid" });
  });
});

test("commande déplacer : un renvoi après réussite rend l'idée déjà déplacée ; un autre membre est refusé", async () => {
  const doc = lists();
  await withStore(doc, async () => {
    const alex = ctx(doc.users[0]!);
    const input = { wishlistId: "w1", itemId: "liseuse", targetWishlistId: "w2", typeId: "w2-books", personId: "w2-alex" };
    const first = await moveCommand(alex, input);
    const again = await moveCommand(alex, input);
    assert.ok(first.ok && again.ok);
    if (!again.ok) return;
    assert.equal(again.item.wishlistId, "w2");
    const sam = ctx(doc.users[1]!);
    assert.deepEqual(await moveCommand(sam, { ...input, wishlistId: "w2", targetWishlistId: "w1", typeId: "w1-books", personId: "w1-alex" }), { ok: false, error: "notMember" });
  });
});
