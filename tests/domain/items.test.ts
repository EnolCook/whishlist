import assert from "node:assert/strict";
import { test } from "node:test";
import { createWishlist } from "../../src/domain/import";
import {
  addPerson,
  addType,
  cancelReservation,
  createItem,
  deleteItem,
  deletePerson,
  deleteType,
  renamePerson,
  setItemArchived,
  setItemType,
} from "../../src/domain/items";
import { reserveItem } from "../../src/domain/reserve";
import { emptyDatabase } from "../../src/domain/types";

function ready() {
  const doc = emptyDatabase();
  doc.users.push({
    id: "u",
    email: "a@b.c",
    passwordHash: "x",
    displayName: "A",
    createdAt: "2026-01-01T00:00:00.000Z",
    mustChangePassword: false,
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  });
  const created = createWishlist(doc, { ownerId: "u", title: "L", importTemplate: false, id: "w" });
  if (!created.ok) throw new Error(created.error);
  const typed = addType(created.doc, { wishlistId: "w", actorId: "u", label: "Jeux", id: "t" });
  if (!typed.ok) throw new Error(typed.error);
  const person = addPerson(typed.doc, { wishlistId: "w", actorId: "u", label: "Couple", id: "p" });
  if (!person.ok) throw new Error(person.error);
  return person.doc;
}

test("validation idée et réservation qui bloque la suppression", () => {
  const doc = ready();
  const nameless = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "  ",
    typeId: "t",
    personId: "p",
  });
  assert.equal(nameless.ok, false);
  const badType = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "X",
    typeId: "nope",
    personId: "p",
  });
  assert.equal(badType.ok, false);
  const badUrl = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "X",
    typeId: "t",
    personId: "p",
    url: "ftp://nope",
  });
  assert.equal(badUrl.ok, false);
  const created = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "The Gang",
    typeId: "t",
    personId: "p",
    url: "",
    priceCents: 1800,
    id: "item",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.item.url, null);
  assert.equal(created.item.imageUrl, null);
  const withImage = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "Avec image",
    typeId: "t",
    personId: "p",
    imageUrl: "https://cdn.example.com/x.jpg",
    id: "img",
  });
  assert.equal(withImage.ok, true);
  if (withImage.ok) assert.equal(withImage.item.imageUrl, "https://cdn.example.com/x.jpg");
  const negative = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "Y",
    typeId: "t",
    personId: "p",
    priceCents: -1,
  });
  assert.equal(negative.ok, false);
  const reserved = reserveItem(created.doc, { wishlistId: "w", itemId: "item", fromName: "  ", note: "" });
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  assert.equal(reserved.reservation.fromName, null);
  assert.equal(reserved.doc.items.find((item) => item.id === "item")?.archived, true);
  const blocked = deleteItem(reserved.doc, { wishlistId: "w", actorId: "u", itemId: "item" });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.error, "itemHasReservation");
  assert.equal(reserved.doc.reservations.length, 1);
  const cancelled = cancelReservation(reserved.doc, {
    wishlistId: "w",
    actorId: "u",
    reservationId: reserved.reservation.id,
  });
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  assert.equal(cancelled.doc.reservations.length, 0);
  assert.equal(cancelled.doc.items.find((item) => item.id === "item")?.archived, false);
});

test("changement de catégorie d'une idée", () => {
  let doc = ready();
  const other = addType(doc, { wishlistId: "w", actorId: "u", label: "Livres", id: "livres" });
  assert.equal(other.ok, true);
  if (!other.ok) return;
  doc = other.doc;
  const created = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "The Gang",
    typeId: "t",
    personId: "p",
    id: "item",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const moved = setItemType(created.doc, {
    wishlistId: "w",
    actorId: "u",
    itemId: "item",
    typeId: "livres",
  });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(moved.doc.items.find((item) => item.id === "item")?.typeId, "livres");
  const bad = setItemType(moved.doc, {
    wishlistId: "w",
    actorId: "u",
    itemId: "item",
    typeId: "missing",
  });
  assert.equal(bad.ok, false);
});

test("archivage d'une idée", () => {
  const doc = ready();
  const created = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "The Gang",
    typeId: "t",
    personId: "p",
    id: "item",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.item.archived, false);
  const archived = setItemArchived(created.doc, {
    wishlistId: "w",
    actorId: "u",
    itemId: "item",
    archived: true,
  });
  assert.equal(archived.ok, true);
  if (!archived.ok) return;
  assert.equal(archived.doc.items.find((item) => item.id === "item")?.archived, true);
  const restored = setItemArchived(archived.doc, {
    wishlistId: "w",
    actorId: "u",
    itemId: "item",
    archived: false,
  });
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.doc.items.find((item) => item.id === "item")?.archived, false);
});

test("retirer un type (bloqué si utilisé)", () => {
  let doc = ready();
  const extra = addType(doc, { wishlistId: "w", actorId: "u", label: "Tech", id: "tech" });
  assert.equal(extra.ok, true);
  if (!extra.ok) return;
  doc = extra.doc;
  const created = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "Laptop",
    typeId: "tech",
    personId: "p",
    id: "item",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const blocked = deleteType(created.doc, { wishlistId: "w", actorId: "u", typeId: "tech" });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.error, "typeInUse");
  const cleared = deleteItem(created.doc, { wishlistId: "w", actorId: "u", itemId: "item" });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  const removed = deleteType(cleared.doc, { wishlistId: "w", actorId: "u", typeId: "tech" });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.doc.types.some((type) => type.id === "tech"), false);
});

test("renommer et retirer un qui (bloqué si utilisé)", () => {
  let doc = ready();
  const renamed = renamePerson(doc, {
    wishlistId: "w",
    actorId: "u",
    personId: "p",
    label: "Alex",
  });
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(renamed.doc.people.find((person) => person.id === "p")?.label, "Alex");
  assert.equal(
    renamed.doc.views.find((view) => view.kind === "person" && view.personId === "p")?.label,
    "Alex",
  );
  doc = renamed.doc;
  const created = createItem(doc, {
    wishlistId: "w",
    actorId: "u",
    name: "Mug",
    typeId: "t",
    personId: "p",
    id: "item",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const blocked = deletePerson(created.doc, { wishlistId: "w", actorId: "u", personId: "p" });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.error, "personInUse");
  const cleared = deleteItem(created.doc, { wishlistId: "w", actorId: "u", itemId: "item" });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  const removed = deletePerson(cleared.doc, { wishlistId: "w", actorId: "u", personId: "p" });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.doc.people.some((person) => person.id === "p"), false);
  assert.equal(
    removed.doc.views.some((view) => view.kind === "person" && view.personId === "p"),
    false,
  );
});
