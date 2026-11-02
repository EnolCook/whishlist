import assert from "node:assert/strict";
import { test } from "node:test";
import { createItem } from "../../src/domain/items";
import { createWishlist } from "../../src/domain/import";
import {
  acceptInvite,
  leaveWishlist,
  regenerateInvite,
  removeMember,
  updateWishlistSettings,
} from "../../src/domain/membership";
import { emptyDatabase, type Database } from "../../src/domain/types";

function base(): Database {
  const doc = emptyDatabase();
  doc.users.push(
    {
      id: "a",
      email: "a@b.c",
      passwordHash: "x",
      displayName: "A",
      createdAt: "2026-01-01T00:00:00.000Z",
      mustChangePassword: false,
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "b",
      email: "b@b.c",
      passwordHash: "x",
      displayName: "B",
      createdAt: "2026-01-01T00:00:00.000Z",
      mustChangePassword: false,
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    },
  );
  const created = createWishlist(doc, { ownerId: "a", title: "Commune", importTemplate: false, id: "w" });
  if (!created.ok) throw new Error(created.error);
  return created.doc;
}

test("invitation, membres, départ du créateur", () => {
  const doc = base();
  const list = doc.wishlists[0]!;
  assert.notEqual(list.readToken, list.inviteToken);
  const anon = acceptInvite(doc, { token: list.inviteToken, userId: "ghost" });
  assert.equal(anon.ok, false);
  const joined = acceptInvite(doc, { token: list.inviteToken, userId: "b", now: new Date("2026-02-01") });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  const again = acceptInvite(joined.doc, { token: list.inviteToken, userId: "b" });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.doc.memberships.filter((m) => m.userId === "b").length, 1);
  const rotated = regenerateInvite(joined.doc, { wishlistId: "w", actorId: "a" });
  assert.equal(rotated.ok, true);
  if (!rotated.ok) return;
  assert.notEqual(rotated.inviteToken, list.inviteToken);
  const stale = acceptInvite(rotated.doc, { token: list.inviteToken, userId: "a" });
  assert.equal(stale.ok, false);
  const removed = removeMember(rotated.doc, { wishlistId: "w", actorId: "a", userId: "b" });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.doc.wishlists[0]?.readToken, list.readToken);
  assert.equal(removed.doc.memberships.some((m) => m.userId === "b"), false);
  const rejoined = acceptInvite(removed.doc, { token: rotated.inviteToken, userId: "b" });
  assert.equal(rejoined.ok, true);
  if (!rejoined.ok) return;
  const left = leaveWishlist(rejoined.doc, { wishlistId: "w", actorId: "a" });
  assert.equal(left.ok, true);
  if (!left.ok) return;
  const owner = left.doc.memberships.find((m) => m.wishlistId === "w" && m.role === "owner");
  assert.equal(owner?.userId, "b");
  const alone = leaveWishlist(left.doc, { wishlistId: "w", actorId: "b" });
  assert.equal(alone.ok, false);
  const outsider = createItem(rejoined.doc, {
    wishlistId: "w",
    actorId: "nobody",
    name: "x",
    typeId: "missing",
    personId: "missing",
  });
  assert.equal(outsider.ok, false);
});

test("réglages : sous-titre, image et couleurs", () => {
  const doc = base();
  assert.equal(doc.wishlists[0]?.theme.primary, "#1e60ff");
  const updated = updateWishlistSettings(doc, {
    wishlistId: "w",
    actorId: "a",
    title: "Cloé et Tat'",
    subtitle: "Nos idées cadeaux",
    coverImageUrl: "https://cdn.example.com/cover.png",
    theme: {
      primary: "#112233",
      accent: "#ff0000",
      highlight: "#ffcc00",
      background: "#f5f5ff",
    },
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.wishlist.title, "Cloé et Tat'");
  assert.equal(updated.wishlist.subtitle, "Nos idées cadeaux");
  assert.equal(updated.wishlist.coverImageUrl, "https://cdn.example.com/cover.png");
  assert.equal(updated.wishlist.theme.primary, "#112233");
  assert.equal(updated.wishlist.theme.accent, "#ff0000");

  const cleared = updateWishlistSettings(updated.doc, {
    wishlistId: "w",
    actorId: "a",
    title: "Cloé et Tat'",
    subtitle: "  ",
    coverImageUrl: "",
  });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  assert.equal(cleared.wishlist.subtitle, null);
  assert.equal(cleared.wishlist.coverImageUrl, null);
  assert.equal(cleared.wishlist.theme.primary, "#112233");

  const badImage = updateWishlistSettings(doc, {
    wishlistId: "w",
    actorId: "a",
    coverImageUrl: "ftp://nope",
  });
  assert.equal(badImage.ok, false);
  if (badImage.ok) return;
  assert.equal(badImage.error, "imageMustBeHttp");

  const badColor = updateWishlistSettings(doc, {
    wishlistId: "w",
    actorId: "a",
    theme: { primary: "blue" },
  });
  assert.equal(badColor.ok, false);

  const outsider = updateWishlistSettings(doc, {
    wishlistId: "w",
    actorId: "b",
    subtitle: "x",
  });
  assert.equal(outsider.ok, false);
});
