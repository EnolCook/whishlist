import assert from "node:assert/strict";
import { test } from "node:test";
import { availableItems, MAX_FROM_NAME, MAX_NOTE, reserveItem } from "../../src/domain/reserve";
import { emptyDatabase, type Database } from "../../src/domain/types";
import { readDocument, updateDocument } from "../../src/store/db";
import { withTempDataPath } from "./helpers/temp-store";

function doc(): Database {
  const data = emptyDatabase();
  data.wishlists.push({
    id: "w",
    title: "L",
    subtitle: null,
    coverImageUrl: null,
    theme: { primary: "#1e60ff", accent: "#ff2d2d", highlight: "#ffd700", background: "#e8f0ff" },
    readToken: "r",
    inviteToken: "i",
    readPasswordHash: null,
    fromTemplate: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  data.types.push(
    { id: "jeux", wishlistId: "w", label: "Jeux", sortOrder: 0 },
    { id: "livres", wishlistId: "w", label: "Livres", sortOrder: 1 },
  );
  data.people.push({ id: "p", wishlistId: "w", label: "Couple" });
  data.items.push(
    {
      id: "gang",
      wishlistId: "w",
      name: "The Gang",
      typeId: "jeux",
      url: null,
      imageUrl: null,
      priceCents: 1800,
      priority: null,
      personId: "p",
      sortOrder: 1,
      archived: false,
    },
    {
      id: "book",
      wishlistId: "w",
      name: "Livre",
      typeId: "livres",
      url: null,
      imageUrl: null,
      priceCents: null,
      priority: null,
      personId: "p",
      sortOrder: 2,
      archived: false,
    },
  );
  return data;
}

test("réservation, blank, type, champs vides", () => {
  const data = doc();
  assert.equal(availableItems(data, "w", "").length, 2);
  assert.equal(availableItems(data, "w", "jeux").length, 1);
  const missing = reserveItem(data, { wishlistId: "w", itemId: "" });
  assert.equal(missing.ok, false);
  const first = reserveItem(data, {
    wishlistId: "w",
    itemId: "gang",
    fromName: "  ",
    note: "",
    userId: "u1",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.reservation.fromName, null);
  assert.equal(first.reservation.note, null);
  assert.equal(first.reservation.userId, "u1");
  const anon = reserveItem(data, { wishlistId: "w", itemId: "book" });
  assert.equal(anon.ok, true);
  if (anon.ok) assert.equal(anon.reservation.userId, null);
  assert.equal(first.doc.items.find((item) => item.id === "gang")?.archived, true);
  assert.equal(availableItems(first.doc, "w", "").length, 1);
  const second = reserveItem(first.doc, { wishlistId: "w", itemId: "gang", fromName: "Sam" });
  assert.equal(second.ok, false);
  assert.equal(first.doc.reservations.length, 1);
  const wrongType = reserveItem(data, { wishlistId: "w", itemId: "book", typeId: "jeux" });
  assert.equal(wrongType.ok, false);
});

test("deux confirmations simultanées sous lock", async () => {
  await withTempDataPath(async () => {
    await updateDocument((current) => ({ doc: doc(), result: current }));
    await Promise.all([
      updateDocument((current) => {
        const result = reserveItem(current, { wishlistId: "w", itemId: "gang", fromName: "A" });
        return { doc: result.ok ? result.doc : current, result };
      }),
      updateDocument((current) => {
        const result = reserveItem(current, { wishlistId: "w", itemId: "gang", fromName: "B" });
        return { doc: result.ok ? result.doc : current, result };
      }),
    ]);
    const saved = await readDocument();
    assert.equal(saved.reservations.length, 1);
  });
});

test("nom et petit mot : longueur maximale", () => {
  const long = reserveItem(doc(), { wishlistId: "w", itemId: "gang", fromName: "x".repeat(MAX_FROM_NAME + 1) });
  assert.deepEqual(long, { ok: false, error: "fieldTooLong" });
  const note = reserveItem(doc(), { wishlistId: "w", itemId: "gang", note: "x".repeat(MAX_NOTE + 1) });
  assert.deepEqual(note, { ok: false, error: "fieldTooLong" });
  const exact = reserveItem(doc(), {
    wishlistId: "w",
    itemId: "gang",
    fromName: "x".repeat(MAX_FROM_NAME),
    note: "x".repeat(MAX_NOTE),
  });
  assert.equal(exact.ok, true);
});

test("une idée déjà réservée dit « déjà réservée », une idée archivée « pas dans la liste »", () => {
  const first = reserveItem(doc(), { wishlistId: "w", itemId: "gang" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(reserveItem(first.doc, { wishlistId: "w", itemId: "gang" }), {
    ok: false,
    error: "itemAlreadyReserved",
  });
  const archived = doc();
  archived.items[1]!.archived = true;
  assert.deepEqual(reserveItem(archived, { wishlistId: "w", itemId: "book" }), { ok: false, error: "itemNotInList" });
});
