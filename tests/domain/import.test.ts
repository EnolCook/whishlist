import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createWishlist } from "../../src/domain/import";
import { emptyDatabase, type SeedFile } from "../../src/domain/types";

const seed = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "seed.json"), "utf8"),
) as SeedFile;

function imported(id: string) {
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
  const created = createWishlist(doc, {
    ownerId: "u",
    title: "Fixture",
    importTemplate: true,
    seed,
    id,
  });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("import");
  return created;
}

test("seed de test : idées préfixées, types et personnes", () => {
  const created = imported("w1");
  const items = created.doc.items.filter((item) => item.wishlistId === "w1");
  assert.equal(items.length, seed.items.length);
  assert.ok(items.every((item) => item.id.startsWith("w1:")));
  assert.ok(items.some((item) => item.name === "Cocotte en fonte 24 cm"));
  assert.equal(items.find((item) => item.name === "Cocotte en fonte 24 cm")?.priceCents, 18900);
  assert.ok(created.doc.types.some((type) => type.id === "w1:maison" && type.label === "Maison"));
  assert.ok(created.doc.people.some((person) => person.id === "w1:alex" && person.label === "Alex"));
});

test("deux imports ne partagent pas d'ids", () => {
  const first = imported("w1");
  const second = createWishlist(first.doc, {
    ownerId: "u",
    title: "Fixture 2",
    importTemplate: true,
    seed,
    id: "w2",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const a = new Set(second.doc.items.filter((item) => item.wishlistId === "w1").map((item) => item.id));
  const b = second.doc.items.filter((item) => item.wishlistId === "w2").map((item) => item.id);
  assert.equal(
    b.some((id) => a.has(id)),
    false,
  );
});
