import assert from "node:assert/strict";
import { before, test } from "node:test";
import { manageLabel, reorderTypes } from "../../src/server/commands/labels";
import { createList, updateSettings } from "../../src/server/commands/lists";
import { readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

test("créer une liste avec sa première catégorie et son « qui »", async () => {
  const doc = apiDoc();
  const camille = ctx(doc.users[1]!);
  await withStore(doc, async () => {
    // Les valeurs par défaut des champs vides sont couvertes par list-creation-defaults.test.ts.
    const created = await createList(camille, { title: "Noël", category: "Livres", person: "Camille" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.list.role, "owner");
    assert.deepEqual(created.list.categories.map((type) => type.label), ["Livres"]);
    assert.deepEqual(created.list.people.map((person) => person.label), ["Camille"]);
    assert.deepEqual(created.list.members.map((member) => member.userId), ["camille"]);
  });
});

test("catégories et « qui » : ajouter, renommer, retirer s'ils ne servent pas", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    const added = await manageLabel(alex, { kind: "type", op: "add", wishlistId: "w", label: "Livres" });
    assert.equal(added.ok, true);
    if (!added.ok || !added.label) return;
    const id = added.label.id;
    assert.equal(added.label.label, "Livres");
    const renamed = await manageLabel(alex, { kind: "type", op: "rename", wishlistId: "w", id, label: "BD" });
    assert.deepEqual(renamed.ok && renamed.label, { id, label: "BD" });
    assert.equal((await manageLabel(alex, { kind: "type", op: "delete", wishlistId: "w", id })).ok, true);
    assert.deepEqual(await manageLabel(alex, { kind: "type", op: "delete", wishlistId: "w", id: "t" }), {
      ok: false,
      error: "typeInUse",
    });

    const person = await manageLabel(alex, { kind: "person", op: "add", wishlistId: "w", label: "Sam" });
    assert.equal(person.ok, true);
    assert.deepEqual(await manageLabel(alex, { kind: "person", op: "delete", wishlistId: "w", id: "p" }), {
      ok: false,
      error: "personInUse",
    });
    assert.deepEqual(await manageLabel(alex, { kind: "person", op: "add", wishlistId: "w", label: " " }), {
      ok: false,
      error: "personNeedsName",
    });
  });
});

test("réordonner les catégories", async () => {
  const doc = apiDoc();
  doc.types.push({ id: "t2", wishlistId: "w", label: "Livres", sortOrder: 1 });
  await withStore(doc, async () => {
    assert.equal((await reorderTypes(ctx(doc.users[0]!), { wishlistId: "w", orderedTypeIds: ["t2", "t"] })).ok, true);
    const types = (await readDocument()).types.sort((a, b) => a.sortOrder - b.sortOrder);
    assert.deepEqual(types.map((type) => type.id), ["t2", "t"]);
  });
});

test("réglages : titre vide refusé, champs absents inchangés", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    assert.deepEqual(await updateSettings(alex, { wishlistId: "w", title: "  " }), { ok: false, error: "listNeedsTitle" });
    const saved = await updateSettings(alex, { wishlistId: "w", subtitle: "Pour Noël" });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.list.title, "Liste d'Alex");
    assert.equal(saved.list.subtitle, "Pour Noël");
  });
});

test("un non-membre ne crée ni ne modifie rien", async () => {
  const doc = apiDoc();
  const camille = ctx(doc.users[1]!);
  await withStore(doc, async () => {
    assert.deepEqual(await manageLabel(camille, { kind: "type", op: "add", wishlistId: "w", label: "X" }), {
      ok: false,
      error: "notMember",
    });
    assert.deepEqual(await reorderTypes(camille, { wishlistId: "w", orderedTypeIds: ["t"] }), {
      ok: false,
      error: "notMember",
    });
    assert.deepEqual(await updateSettings(camille, { wishlistId: "w", title: "Pris" }), { ok: false, error: "notMember" });
    assert.equal((await readDocument()).types.length, 1);
  });
});
