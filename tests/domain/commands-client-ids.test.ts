import assert from "node:assert/strict";
import { before, test } from "node:test";
import { isClientId } from "../../src/domain/client-ids";
import { saveItem } from "../../src/server/commands/items";
import { createList } from "../../src/server/commands/lists";
import { readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

// Identifiants choisis par le client (contrat api-v1-additions, feature 005) :
// un changement renvoyé après une réponse perdue ne crée pas de doublon.

before(ensurePasswordHash);

const LIST_ID = "list_client_id_01";
const CATEGORY_ID = "type_client_id_01";
const PERSON_ID = "pers_client_id_01";
const ITEM_ID = "item_client_id_01";

function itemInput(overrides: Partial<Parameters<typeof saveItem>[1]> = {}) {
  return {
    wishlistId: "w",
    clientId: ITEM_ID,
    name: "Puzzle 1000 pièces",
    typeId: "t",
    personId: "p",
    url: "",
    imageUrl: "",
    price: "24,90",
    priority: "",
    ...overrides,
  };
}

test("format d'un identifiant client : 16 à 32 caractères base64url", () => {
  assert.equal(isClientId("a".repeat(16)), true);
  assert.equal(isClientId("A-_z09".padEnd(32, "x")), true);
  assert.equal(isClientId("a".repeat(15)), false);
  assert.equal(isClientId("a".repeat(33)), false);
  assert.equal(isClientId("abc/def+ghijklmno"), false);
});

test("createList avec id, categoryId, personId : crée ces identifiants", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const created = await createList(ctx(doc.users[0]!), {
      title: "Noël",
      category: "Livres",
      person: "Alex",
      id: LIST_ID,
      categoryId: CATEGORY_ID,
      personId: PERSON_ID,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.replayed, false);
    assert.equal(created.list.id, LIST_ID);
    assert.deepEqual(created.list.categories.map((category) => category.id), [CATEGORY_ID]);
    assert.deepEqual(created.list.people.map((person) => person.id), [PERSON_ID]);
  });
});

test("createList rejoué par le même compte : même liste, sans doublon", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const input = { title: "Noël", category: "Livres", person: "Alex", id: LIST_ID, categoryId: CATEGORY_ID, personId: PERSON_ID };
    await createList(ctx(doc.users[0]!), input);
    const replay = await createList(ctx(doc.users[0]!), input);
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.replayed, true);
    assert.equal(replay.list.id, LIST_ID);
    const stored = await readDocument();
    assert.equal(stored.wishlists.filter((list) => list.id === LIST_ID).length, 1);
    assert.equal(stored.types.filter((type) => type.wishlistId === LIST_ID).length, 1);
    assert.equal(stored.people.filter((person) => person.wishlistId === LIST_ID).length, 1);
  });
});

test("createList : id d'une liste dont le compte n'est pas membre → idConflict", async () => {
  const doc = apiDoc();
  doc.wishlists[0]!.id = LIST_ID;
  for (const name of ["memberships", "types", "people", "items", "reservations"] as const) {
    for (const row of doc[name]) row.wishlistId = LIST_ID;
  }
  await withStore(doc, async () => {
    const result = await createList(ctx(doc.users[1]!), { title: "Noël", category: "Livres", person: "Camille", id: LIST_ID });
    assert.deepEqual(result, { ok: false, error: "idConflict" });
  });
});

test("createList : categoryId ou personId déjà pris → idConflict, rien n'est créé", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const taken = await createList(ctx(doc.users[0]!), {
      title: "Noël",
      category: "Livres",
      person: "Alex",
      id: LIST_ID,
      categoryId: "gift".padEnd(16, "x"),
      personId: PERSON_ID,
    });
    assert.equal(taken.ok, true);
    const second = await createList(ctx(doc.users[0]!), {
      title: "Anniversaire",
      category: "Jeux",
      person: "Alex",
      id: "other_list_id_001",
      categoryId: "gift".padEnd(16, "x"),
    });
    assert.deepEqual(second, { ok: false, error: "idConflict" });
    const stored = await readDocument();
    assert.equal(stored.wishlists.some((list) => list.id === "other_list_id_001"), false);
  });
});

test("createList : identifiant hors format → idInvalid", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    for (const field of ["id", "categoryId", "personId"] as const) {
      const result = await createList(ctx(doc.users[0]!), { title: "Noël", category: "Livres", person: "Alex", [field]: "court" });
      assert.deepEqual(result, { ok: false, error: "idInvalid" }, field);
    }
  });
});

test("saveItem avec id : création, puis renvoi → même idée, sans doublon ni modification", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const created = await saveItem(ctx(doc.users[0]!), itemInput());
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.replayed, false);
    assert.equal(created.item.id, ITEM_ID);
    assert.equal(created.item.priceCents, 2490);
    const replay = await saveItem(ctx(doc.users[0]!), itemInput({ name: "Autre nom", price: "1" }));
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.replayed, true);
    assert.equal(replay.item.name, "Puzzle 1000 pièces");
    assert.equal(replay.item.priceCents, 2490);
    const stored = await readDocument();
    assert.equal(stored.items.filter((item) => item.id === ITEM_ID).length, 1);
  });
});

test("saveItem : id d'une idée d'une autre liste → idConflict", async () => {
  const doc = apiDoc();
  doc.wishlists.push({ ...doc.wishlists[0]!, id: "w2", readToken: "rt2", inviteToken: "it2" });
  doc.memberships.push({ wishlistId: "w2", userId: "alex", role: "owner", joinedAt: "2026-01-01T00:00:00.000Z" });
  doc.types.push({ id: "t2", wishlistId: "w2", label: "Jeux", sortOrder: 0 });
  doc.people.push({ id: "p2", wishlistId: "w2", label: "Alex" });
  await withStore(doc, async () => {
    assert.equal((await saveItem(ctx(doc.users[0]!), itemInput())).ok, true);
    const other = await saveItem(ctx(doc.users[0]!), itemInput({ wishlistId: "w2", typeId: "t2", personId: "p2" }));
    assert.deepEqual(other, { ok: false, error: "idConflict" });
  });
});

test("saveItem : id déjà pris par autre chose qu'une idée → idConflict ; hors format → idInvalid", async () => {
  const doc = apiDoc();
  doc.types.push({ id: "type_taken_id_001", wishlistId: "w", label: "Livres", sortOrder: 1 });
  await withStore(doc, async () => {
    assert.deepEqual(await saveItem(ctx(doc.users[0]!), itemInput({ clientId: "type_taken_id_001" })), {
      ok: false,
      error: "idConflict",
    });
    assert.deepEqual(await saveItem(ctx(doc.users[0]!), itemInput({ clientId: "x/y" })), { ok: false, error: "idInvalid" });
  });
});

test("saveItem : un renvoi exige d'être membre de la liste", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    assert.equal((await saveItem(ctx(doc.users[0]!), itemInput())).ok, true);
    assert.deepEqual(await saveItem(ctx(doc.users[1]!), itemInput()), { ok: false, error: "notMember" });
  });
});

test("deux créations simultanées avec le même id → une seule idée", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const results = await Promise.all([saveItem(ctx(doc.users[0]!), itemInput()), saveItem(ctx(doc.users[0]!), itemInput())]);
    assert.equal(results.every((result) => result.ok), true);
    assert.deepEqual(results.map((result) => result.ok && result.replayed).sort(), [false, true]);
    const stored = await readDocument();
    assert.equal(stored.items.filter((item) => item.id === ITEM_ID).length, 1);
  });
});
