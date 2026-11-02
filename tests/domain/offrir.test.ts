import assert from "node:assert/strict";
import { test } from "node:test";
import { listMyOffers, listOffrir } from "../../src/domain/offrir";
import { DEFAULT_WISHLIST_THEME } from "../../src/domain/theme";
import { emptyDatabase } from "../../src/domain/types";

test("offrir scopé à la liste, champs vides, zéro ligne", () => {
  const doc = emptyDatabase();
  doc.types.push({ id: "t", wishlistId: "w", label: "Jeux", sortOrder: 0 });
  doc.items.push({
    id: "gang",
    wishlistId: "w",
    name: "The Gang",
    typeId: "t",
    url: null,
    imageUrl: null,
    priceCents: 1800,
    priority: null,
    secondHandOk: false,
    description: null,
    personId: "p",
    sortOrder: 1,
    archived: false,
  });
  assert.equal(listOffrir(doc, "w").length, 0);
  doc.reservations.push(
    {
      id: "r1",
      wishlistId: "w",
      itemId: "gang",
      fromName: null,
      note: null,
      userId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "r2",
      wishlistId: "other",
      itemId: "gang",
      fromName: "Sam",
      note: "mot",
      userId: "u1",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  );
  const rows = listOffrir(doc, "w");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.itemName, "The Gang");
  assert.equal(rows[0]?.typeLabel, "Jeux");
  assert.equal(rows[0]?.fromName, null);
  assert.equal(rows[0]?.note, null);
});

test("mes cadeaux : seulement les réservations liées au compte", () => {
  const doc = emptyDatabase();
  doc.wishlists.push({
    id: "w",
    title: "Liste démo",
    subtitle: null,
    coverImageUrl: null,
    theme: { ...DEFAULT_WISHLIST_THEME },
    readToken: "rt",
    inviteToken: "it",
    readPasswordHash: null,
    fromTemplate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  doc.types.push({ id: "t", wishlistId: "w", label: "Jeux", sortOrder: 0 });
  doc.items.push({
    id: "gang",
    wishlistId: "w",
    name: "The Gang",
    typeId: "t",
    url: null,
    imageUrl: null,
    priceCents: 1800,
    priority: null,
    secondHandOk: false,
    description: null,
    personId: "p",
    sortOrder: 1,
    archived: true,
  });
  doc.reservations.push(
    {
      id: "anon",
      wishlistId: "w",
      itemId: "gang",
      fromName: "Anonyme",
      note: null,
      userId: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "mine",
      wishlistId: "w",
      itemId: "gang",
      fromName: "Moi",
      note: "surprise",
      userId: "u1",
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  );
  const mine = listMyOffers(doc, "u1");
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.itemName, "The Gang");
  assert.equal(mine[0]?.listTitle, "Liste démo");
  assert.equal(mine[0]?.listReadToken, "rt");
  assert.equal(listMyOffers(doc, "nobody").length, 0);
});
