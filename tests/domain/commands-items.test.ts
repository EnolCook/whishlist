import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  cancelReservationAsMember,
  deleteItem,
  enrichFromUrl,
  patchItem,
  saveItem,
  setItemArchived,
  setItemType,
} from "../../src/server/commands/items";
import { isRateLimitError } from "../../src/server/rate-limit";
import { readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

const fields = {
  wishlistId: "w",
  name: "Puzzle 1000 pièces",
  typeId: "t",
  personId: "p",
  url: "",
  imageUrl: "https://images.example.test/puzzle.png",
  price: "24,90",
  priority: "",
};

function docWithSecondList() {
  const doc = apiDoc();
  doc.wishlists.push({ ...doc.wishlists[0]!, id: "w2", readToken: "rt2", inviteToken: "it2" });
  doc.memberships.push({ wishlistId: "w2", userId: "camille", role: "owner", joinedAt: "2026-01-01T00:00:00.000Z" });
  doc.types.push({ id: "t2", wishlistId: "w2", label: "Livres", sortOrder: 0 });
  doc.people.push({ id: "p2", wishlistId: "w2", label: "Camille" });
  return doc;
}

test("créer puis modifier une idée, avec les validations du domaine", async () => {
  const doc = docWithSecondList();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    const created = await saveItem(alex, fields);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.item.priceCents, 2490);
    assert.equal(created.item.imageUrl, fields.imageUrl, "l'image saisie prime, sans appel réseau");
    assert.equal(created.item.url, null);

    const updated = await saveItem(alex, { ...fields, itemId: created.item.id, name: "Puzzle 2000 pièces", price: "" });
    assert.equal(updated.ok && updated.item.name, "Puzzle 2000 pièces");
    assert.equal(updated.ok && updated.item.priceCents, null);

    assert.deepEqual(await saveItem(alex, { ...fields, price: "abc" }), { ok: false, error: "priceInvalid" });
    assert.deepEqual(await saveItem(alex, { ...fields, name: "  " }), { ok: false, error: "itemNeedsName" });
    assert.deepEqual(await saveItem(alex, { ...fields, typeId: "t2" }), { ok: false, error: "typeNotInList" });
    assert.deepEqual(await saveItem(alex, { ...fields, personId: "p2" }), { ok: false, error: "personNotInList" });
  });
});

test("archiver, changer de catégorie, supprimer", async () => {
  const doc = apiDoc();
  doc.types.push({ id: "t-b", wishlistId: "w", label: "Livres", sortOrder: 1 });
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    const archived = await setItemArchived(alex, { wishlistId: "w", itemId: "gift", archived: true });
    assert.equal(archived.ok && archived.item.archived, true);
    const back = await setItemArchived(alex, { wishlistId: "w", itemId: "gift", archived: false });
    assert.equal(back.ok && back.item.archived, false);
    const moved = await setItemType(alex, { wishlistId: "w", itemId: "gift", typeId: "t-b" });
    assert.equal(moved.ok && moved.item.typeId, "t-b");
    assert.equal((await deleteItem(alex, { wishlistId: "w", itemId: "gift" })).ok, true);
    assert.equal((await readDocument()).items.some((item) => item.id === "gift"), false);
  });
});

test("un non-membre ne change rien", async () => {
  const doc = apiDoc();
  const camille = ctx(doc.users[1]!);
  await withStore(doc, async () => {
    const before = await readDocument();
    const attempts = [
      await saveItem(camille, fields),
      await saveItem(camille, { ...fields, itemId: "gift" }),
      await setItemArchived(camille, { wishlistId: "w", itemId: "gift", archived: true }),
      await setItemType(camille, { wishlistId: "w", itemId: "gift", typeId: "t" }),
      await deleteItem(camille, { wishlistId: "w", itemId: "gift" }),
      await cancelReservationAsMember(camille, { wishlistId: "w", reservationId: "r-taken" }),
      await enrichFromUrl(camille, { wishlistId: "w", url: "https://shop.example.test/p" }),
    ];
    for (const attempt of attempts) assert.deepEqual(attempt, { ok: false, error: "notMember" });
    assert.deepEqual(await readDocument(), before);
  });
});

test("sans compte : unauthorized", async () => {
  await withStore(apiDoc(), async () => {
    assert.deepEqual(await saveItem(ctx(), fields), { ok: false, error: "unauthorized" });
  });
});

test("un membre annule une réservation de sa liste", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const result = await cancelReservationAsMember(ctx(doc.users[0]!), { wishlistId: "w", reservationId: "r-taken" });
    assert.equal(result.ok, true);
    const after = await readDocument();
    assert.equal(after.reservations.length, 0);
    assert.equal(after.items.find((item) => item.id === "taken")?.archived, false);
  });
});

test("préremplir : lien http(s) obligatoire, 30 appels par heure", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    assert.deepEqual(await enrichFromUrl(alex, { wishlistId: "w", url: "ftp://shop.example.test" }), {
      ok: false,
      error: "urlInvalid",
    });
    for (let i = 0; i < 29; i += 1) await enrichFromUrl(alex, { wishlistId: "w", url: "pas-un-lien" });
    await assert.rejects(enrichFromUrl(alex, { wishlistId: "w", url: "pas-un-lien" }), isRateLimitError);
  });
});

test("catégorie et archivage s'appliquent ensemble ou pas du tout", async () => {
  const doc = apiDoc();
  doc.types.push({ id: "t-b", wishlistId: "w", label: "Livres", sortOrder: 1 });
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    const refused = await patchItem(alex, { wishlistId: "w", itemId: "gift", typeId: "absente", archived: true });
    assert.deepEqual(refused, { ok: false, error: "typeNotInList" });
    assert.equal((await readDocument()).items.find((item) => item.id === "gift")?.archived, false);
    const both = await patchItem(alex, { wishlistId: "w", itemId: "gift", typeId: "t-b", archived: true });
    assert.deepEqual(both.ok && [both.item.typeId, both.item.archived], ["t-b", true]);
  });
});

test("enregistrer une idée avec un lien : 60 récupérations d'image par heure", async () => {
  const doc = apiDoc();
  const alex = ctx(doc.users[0]!);
  await withStore(doc, async () => {
    // Lien local : la récupération est refusée par safeHttpGet, sans réseau, mais compte dans la limite.
    const withLink = { ...fields, url: "http://127.0.0.1/produit", imageUrl: "" };
    for (let i = 0; i < 60; i += 1) await saveItem(alex, withLink);
    await assert.rejects(saveItem(alex, withLink), isRateLimitError);
    assert.equal((await saveItem(alex, { ...withLink, imageUrl: "https://images.example.test/a.png" })).ok, true);
  });
});
