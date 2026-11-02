import assert from "node:assert/strict";
import { test } from "node:test";
import { listDefaults, memberListTitles, numberedTitle } from "../../src/domain/list-defaults";

test("numberedTitle garde le nom libre, numérote sinon", () => {
  assert.equal(numberedTitle("Liste de Nathan", []), "Liste de Nathan");
  assert.equal(numberedTitle("Liste de Nathan", ["Autre"]), "Liste de Nathan");
  assert.equal(numberedTitle("Liste de Nathan", ["Liste de Nathan"]), "Liste de Nathan 2");
  assert.equal(
    numberedTitle("Liste de Nathan", ["Liste de Nathan", "Liste de Nathan 2"]),
    "Liste de Nathan 3",
  );
  // insensible à la casse et aux espaces de bord
  assert.equal(numberedTitle("Liste de Nathan", ["  liste de nathan  "]), "Liste de Nathan 2");
  // comble un trou : 2 pris, 3 libre
  assert.equal(numberedTitle("L", ["L", "L 3"]), "L 2");
});

test("memberListTitles ne rend que les listes dont le compte est membre", () => {
  const memberships = [
    { userId: "u", wishlistId: "a" },
    { userId: "u", wishlistId: "b" },
    { userId: "other", wishlistId: "c" },
    { userId: "u", wishlistId: "missing" },
  ];
  const wishlists = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" },
  ];
  assert.deepEqual(memberListTitles(memberships, wishlists, "u"), ["A", "B"]);
});

test("listDefaults : nom affiché, ou libellés de repli s'il est vide", () => {
  const strings: Record<string, string> = {
    "newList.defaultNameNoName": "Ma liste",
    "newList.defaultCategory": "Cadeaux",
    "newList.defaultPerson": "Moi",
  };
  const t = (key: string, vars?: Record<string, string>) =>
    key === "newList.defaultName" ? `Liste de ${vars?.name}` : (strings[key] ?? key);
  assert.deepEqual(listDefaults("  Nathan ", t), { titleBase: "Liste de Nathan", category: "Cadeaux", person: "Nathan" });
  assert.deepEqual(listDefaults("   ", t), { titleBase: "Ma liste", category: "Cadeaux", person: "Moi" });
});
