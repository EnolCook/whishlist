import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createList } from "../../src/server/commands/lists";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

test("création : champs vides → valeurs par défaut (langue FR)", async () => {
  const doc = apiDoc();
  const user = doc.users[1]!;
  const c = ctx(user); // locale "fr"
  await withStore(doc, async () => {
    const created = await createList(c, { title: "", category: "", person: "" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.list.title, `Liste de ${user.displayName}`);
    assert.deepEqual(created.list.categories.map((x) => x.label), ["Cadeaux"]);
    assert.deepEqual(created.list.people.map((x) => x.label), [user.displayName]);
  });
});

test("création : un deuxième nom par défaut est numéroté", async () => {
  const doc = apiDoc();
  const user = doc.users[1]!;
  const c = ctx(user);
  await withStore(doc, async () => {
    const first = await createList(c, { title: "", category: "", person: "" });
    const second = await createList(c, { title: "", category: "", person: "" });
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.list.title, `Liste de ${user.displayName} 2`);
  });
});

test("création : les valeurs fournies priment sur les défauts", async () => {
  const doc = apiDoc();
  const c = ctx(doc.users[1]!);
  await withStore(doc, async () => {
    const created = await createList(c, { title: "Noël", category: "Livres", person: "Camille" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.list.title, "Noël");
    assert.deepEqual(created.list.categories.map((x) => x.label), ["Livres"]);
    assert.deepEqual(created.list.people.map((x) => x.label), ["Camille"]);
  });
});

test("création : nom affiché vide (ancien compte importé) → libellés de repli", async () => {
  const doc = apiDoc();
  doc.users[1]!.displayName = "";
  await withStore(doc, async () => {
    const created = await createList(ctx(doc.users[1]!), { title: "", category: "", person: "" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.list.title, "Ma liste");
    assert.deepEqual(created.list.people.map((x) => x.label), ["Moi"]);
  });
});

test("création : le nom affiché est repris tel quel, sans échappement", async () => {
  const doc = apiDoc();
  doc.users[1]!.displayName = "Léa & Tom";
  await withStore(doc, async () => {
    const created = await createList(ctx(doc.users[1]!), { title: "", category: "", person: "" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.list.title, "Liste de Léa & Tom");
    assert.deepEqual(created.list.people.map((x) => x.label), ["Léa & Tom"]);
  });
});

test("création en anglais : valeurs par défaut anglaises", async () => {
  const doc = apiDoc();
  const user = doc.users[1]!;
  await withStore(doc, async () => {
    const created = await createList({ ...ctx(user), locale: "en" }, { title: "", category: "", person: "" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.list.title, `${user.displayName}’s list`);
    assert.deepEqual(created.list.categories.map((x) => x.label), ["Gifts"]);
  });
});

test("création avec #3 : une saisie à virgules en crée plusieurs ; un champ vide ou fait de virgules prend le défaut", async () => {
  const doc = apiDoc();
  const user = doc.users[1]!;
  const c = ctx(user);
  await withStore(doc, async () => {
    const several = await createList(c, { title: "Noël", category: "Livres, Jeux", person: " , " });
    assert.equal(several.ok, true);
    if (!several.ok) return;
    assert.deepEqual(several.list.categories.map((x) => x.label), ["Livres", "Jeux"]);
    assert.deepEqual(several.list.people.map((x) => x.label), [user.displayName], "que des virgules : le défaut");
  });
});

test("création : le nom du compte pris par défaut n'est jamais découpé, même avec une virgule", async () => {
  const doc = apiDoc();
  const user = doc.users[1]!;
  user.displayName = "Dupont, Marie";
  await withStore(doc, async () => {
    const created = await createList(ctx(user), { title: "", category: "", person: "" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.deepEqual(created.list.people.map((x) => x.label), ["Dupont, Marie"]);
  });
});
