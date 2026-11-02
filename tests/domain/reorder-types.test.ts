import assert from "node:assert/strict";
import { test } from "node:test";
import { createWishlist } from "../../src/domain/import";
import { addType, reorderTypes } from "../../src/domain/items";
import { emptyDatabase } from "../../src/domain/types";

test("reorderTypes change l’ordre des catégories", () => {
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
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const first = addType(created.doc, { wishlistId: "w", actorId: "u", label: "Livres", id: "t1" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = addType(first.doc, { wishlistId: "w", actorId: "u", label: "Maison", id: "t2" });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const reordered = reorderTypes(second.doc, {
    wishlistId: "w",
    actorId: "u",
    orderedTypeIds: ["t2", "t1"],
  });
  assert.equal(reordered.ok, true);
  if (!reordered.ok) return;
  const ordered = reordered.doc.types
    .filter((type) => type.wishlistId === "w")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((type) => type.id);
  assert.deepEqual(ordered, ["t2", "t1"]);
});
