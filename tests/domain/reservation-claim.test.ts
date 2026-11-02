import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelOwnReservation } from "../../src/domain/items";
import {
  listPublicVisibleItems,
  mineReservationIdsFor,
  toPublicItem,
} from "../../src/domain/read";
import { DEFAULT_WISHLIST_THEME } from "../../src/domain/theme";
import { emptyDatabase, type Database } from "../../src/domain/types";

function doc(): Database {
  const data = emptyDatabase();
  data.wishlists.push({
    id: "w",
    title: "L",
    subtitle: null,
    coverImageUrl: null,
    theme: { ...DEFAULT_WISHLIST_THEME },
    readToken: "rt",
    inviteToken: "it",
    readPasswordHash: null,
    fromTemplate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  data.types.push({ id: "t", wishlistId: "w", label: "Jeux", sortOrder: 0 });
  data.people.push({ id: "p", wishlistId: "w", label: "Alex" });
  data.items.push({
    id: "gift",
    wishlistId: "w",
    name: "Livre",
    typeId: "t",
    url: null,
    imageUrl: null,
    priceCents: 1000,
    priority: null,
    secondHandOk: false,
    personId: "p",
    sortOrder: 1,
    archived: true,
  });
  data.reservations.push({
    id: "res1",
    wishlistId: "w",
    itemId: "gift",
    fromName: "Sam",
    note: null,
    userId: "u1",
    createdAt: "2026-01-02T00:00:00.000Z",
  });
  return data;
}

test("mine : compte ou claim cookie", () => {
  const data = doc();
  assert.deepEqual([...mineReservationIdsFor(data, "w", "u1", new Set())], ["res1"]);
  assert.deepEqual([...mineReservationIdsFor(data, "w", null, new Set(["res1"]))], ["res1"]);
  assert.equal(mineReservationIdsFor(data, "w", "other", new Set()).size, 0);
});

test("liste publique : résa des autres masquée, la mienne visible", () => {
  const data = doc();
  const mine = mineReservationIdsFor(data, "w", "u1", new Set());
  const visible = listPublicVisibleItems(data, "w", mine);
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, "gift");
  const pub = toPublicItem(data, visible[0]!, "fr-FR", mine);
  assert.equal(pub.mine, true);
  assert.equal(pub.reserved, true);

  const hidden = listPublicVisibleItems(data, "w", new Set());
  assert.equal(hidden.length, 0);
});

test("cancelOwnReservation : compte, claim, refus", () => {
  const byUser = cancelOwnReservation(doc(), {
    wishlistId: "w",
    reservationId: "res1",
    userId: "u1",
    claimedIds: new Set(),
  });
  assert.equal(byUser.ok, true);

  const byClaim = cancelOwnReservation(doc(), {
    wishlistId: "w",
    reservationId: "res1",
    userId: null,
    claimedIds: new Set(["res1"]),
  });
  assert.equal(byClaim.ok, true);

  const denied = cancelOwnReservation(doc(), {
    wishlistId: "w",
    reservationId: "res1",
    userId: "stranger",
    claimedIds: new Set(),
  });
  assert.deepEqual(denied, { ok: false, error: "accessDenied" });
});
