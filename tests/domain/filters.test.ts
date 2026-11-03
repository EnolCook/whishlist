import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  filterAndSortPublicItems,
  applyBudget,
  applyPerson,
  applyView,
  groupByCategory,
  parseBudget,
  sortByPriority,
} from "../../src/domain/filters";
import { createWishlist } from "../../src/domain/import";
import { emptyDatabase, type SeedFile } from "../../src/domain/types";

const seed = JSON.parse(readFileSync(path.join(process.cwd(), "data", "seed.json"), "utf8")) as SeedFile;

function doc() {
  const base = emptyDatabase();
  base.users.push({
    id: "u",
    email: "a@b.c",
    passwordHash: "x",
    displayName: "A",
    createdAt: "2026-01-01T00:00:00.000Z",
    mustChangePassword: false,
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  });
  const created = createWishlist(base, {
    ownerId: "u",
    title: "Fixture",
    importTemplate: true,
    seed,
    id: "w",
  });
  if (!created.ok) throw new Error(created.error);
  return created.doc;
}

test("filtres du seed de test", () => {
  const data = doc();
  const names = (view: string) => applyView(data, "w", `w:${view}`).map((item) => item.name);
  const maison = names("maison");
  assert.ok(maison.includes("Lampe de chevet design"));
  assert.ok(maison.includes("Monstera en pot"));
  assert.equal(maison.includes("Cocotte en fonte 24 cm"), false);
  const cadeaux = names("cadeaux");
  assert.ok(cadeaux.includes("Cocotte en fonte 24 cm"));
  assert.ok(cadeaux.includes("Casque vélo urbain"));
  assert.ok(cadeaux.includes("Roman contemporain (édition reliée)"));
  assert.equal(cadeaux.includes("Lampe de chevet design"), false);
  assert.equal(applyView(data, "w", "w:unknown").length, seed.items.length);
});

test("filtre par budget", () => {
  const data = doc();
  const all = applyView(data, "w", null);
  const names = (budget: Parameters<typeof applyBudget>[1]) =>
    applyBudget(all, budget).map((item) => item.name);
  const under = names("under-20");
  assert.ok(under.includes("Jeu de société coopératif"));
  assert.equal(under.includes("Cocotte en fonte 24 cm"), false);
  const mid = names("50-100");
  assert.ok(mid.includes("Plaid en laine"));
  assert.ok(mid.includes("Casque vélo urbain"));
  assert.ok(names("over-100").includes("Cocotte en fonte 24 cm"));
  assert.ok(names("20-50").includes("Roman contemporain (édition reliée)"));
  assert.ok(names("none").includes("Livre de recettes de saison"));
  assert.equal(names("none").includes("Cocotte en fonte 24 cm"), false);
  assert.equal(applyBudget(all, parseBudget("nope")).length, seed.items.length);
});

test("qui se combine avec le type", () => {
  const data = doc();
  const maison = applyView(data, "w", "w:maison");
  const alex = applyPerson(maison, "w:alex").map((item) => item.name);
  assert.ok(alex.includes("Lampe de chevet design"));
  assert.equal(alex.includes("Monstera en pot"), false);
  const sam = applyPerson(maison, "w:sam").map((item) => item.name);
  assert.ok(sam.includes("Monstera en pot"));
  assert.equal(sam.includes("Lampe de chevet design"), false);
  assert.equal(applyPerson(maison, null).length, maison.length);
});

test("tri par priorité dans une vue filtrée", () => {
  const data = doc();
  const maison = sortByPriority(applyView(data, "w", "w:maison"));
  assert.ok(maison.length >= 2);
  for (let i = 1; i < maison.length; i++) {
    const prev = Number(maison[i - 1]?.priority ?? 0);
    const next = Number(maison[i]?.priority ?? 0);
    assert.ok(prev >= next);
  }
});

test("groupement par catégorie selon sortOrder", () => {
  const data = doc();
  const items = sortByPriority(applyView(data, "w", null));
  const types = data.types.filter((type) => type.wishlistId === "w");
  const groups = groupByCategory(items, types);
  const labels = groups.map((group) => group.label);
  const orderedLabels = [...types]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "fr"))
    .map((type) => type.label)
    .filter((label) => labels.includes(label));
  assert.deepEqual(labels, orderedLabels);
  assert.ok(labels.includes("Maison"));
  assert.ok(labels.includes("Cuisine"));
  const maison = groups.find((group) => group.label === "Maison");
  assert.ok(maison);
  assert.ok(maison.items.some((item) => item.name === "Lampe de chevet design"));
  assert.equal(
    groups.reduce((sum, group) => sum + group.items.length, 0),
    items.length,
  );
});

test("filterAndSortPublicItems : priorité d'abord, ordre du propriétaire à priorité égale, puis filtres", () => {
  // Ordre rendu par l'API (sortOrder du propriétaire), volontairement pas alphabétique.
  const items = [
    { id: "a", name: "Zèbre", personId: "p1", priceCents: 1500, priority: "3" },
    { id: "b", name: "Abeille", personId: "p2", priceCents: 4000, priority: "5" },
    { id: "c", name: "Arbre", personId: "p1", priceCents: null, priority: "3" },
    { id: "d", name: "Banane", personId: "p1", priceCents: 1000, priority: null },
  ];
  assert.deepEqual(
    filterAndSortPublicItems(items, null, null).map((item) => item.id),
    ["b", "a", "c", "d"],
  );
  assert.deepEqual(
    filterAndSortPublicItems(items, "p1", null).map((item) => item.id),
    ["a", "c", "d"],
  );
  assert.deepEqual(
    filterAndSortPublicItems(items, null, "under-20").map((item) => item.id),
    ["a", "d"],
  );
  assert.deepEqual(filterAndSortPublicItems(items, null, "none").map((item) => item.id), ["c"]);
});
