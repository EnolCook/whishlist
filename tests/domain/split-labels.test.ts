import assert from "node:assert/strict";
import { before, test } from "node:test";
import { splitLabels } from "../../src/domain/items";
import { manageLabel } from "../../src/server/commands/labels";
import { createList } from "../../src/server/commands/lists";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

test("splitLabels découpe, nettoie et dédoublonne", () => {
  assert.deepEqual(splitLabels("Wilh, Nathan, Nous deux"), ["Wilh", "Nathan", "Nous deux"]);
  assert.deepEqual(splitLabels("Livres"), ["Livres"]);
  assert.deepEqual(splitLabels("A;B\nC"), ["A", "B", "C"]);
  // blancs et séparateurs vides ignorés
  assert.deepEqual(splitLabels("  A ,, , B  "), ["A", "B"]);
  // doublons retirés sans tenir compte de la casse, premier arrivé conservé
  assert.deepEqual(splitLabels("Nathan, nathan, NATHAN"), ["Nathan"]);
  // une saisie vide ne donne aucun libellé
  assert.deepEqual(splitLabels("   "), []);
  assert.deepEqual(splitLabels(""), []);
});

test("ajouter des « qui » séparés par des virgules en crée plusieurs", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    const added = await manageLabel(alex, {
      kind: "person",
      op: "add",
      wishlistId: "w",
      label: "Wilh, Nathan, Nous deux",
    });
    assert.equal(added.ok, true);
    if (!added.ok) return;
    assert.deepEqual(
      added.labels.map((entry) => entry.label),
      ["Wilh", "Nathan", "Nous deux"],
    );
    // `label` reste le premier, pour les appelants qui n'en attendent qu'un (API v1).
    assert.equal(added.label?.label, "Wilh");
  });
});

test("une saisie vide garde l'erreur du domaine", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    assert.deepEqual(await manageLabel(alex, { kind: "person", op: "add", wishlistId: "w", label: " , , " }), {
      ok: false,
      error: "personNeedsName",
    });
    assert.deepEqual(await manageLabel(alex, { kind: "type", op: "add", wishlistId: "w", label: "" }), {
      ok: false,
      error: "typeNeedsName",
    });
  });
});

test("renommer ne découpe pas : une virgule reste dans le libellé", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    const added = await manageLabel(alex, { kind: "person", op: "add", wishlistId: "w", label: "Wilh" });
    assert.equal(added.ok, true);
    if (!added.ok || !added.label) return;
    const renamed = await manageLabel(alex, {
      kind: "person",
      op: "rename",
      wishlistId: "w",
      id: added.label.id,
      label: "Papa, maman",
    });
    assert.equal(renamed.ok, true);
    if (!renamed.ok) return;
    assert.equal(renamed.label?.label, "Papa, maman");
  });
});

test("créer une liste découpe aussi la catégorie et le « qui »", async () => {
  const doc = apiDoc();
  const camille = ctx(doc.users[1]!);
  await withStore(doc, async () => {
    const created = await createList(camille, {
      title: "Noël",
      category: "Livres, Jeux",
      person: "Wilh, Nathan",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.deepEqual(
      created.list.categories.map((type) => type.label),
      ["Livres", "Jeux"],
    );
    assert.deepEqual(
      created.list.people.map((person) => person.label),
      ["Wilh", "Nathan"],
    );
  });
});
