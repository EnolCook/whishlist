import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createWishlist, importTemplate } from "../../src/domain/import";
import type { Database, SeedFile } from "../../src/domain/types";
import { readDocument, replaceDocument } from "../../src/store/db";
import { apiDoc } from "./helpers/api-fixtures";
import { withTempDataPath } from "./helpers/temp-store";

/** Toutes les valeurs particulières : null, booléens, JSON, emoji, centimes. */
function edgeDoc(): Database {
  const doc = apiDoc();
  doc.users[0].mustChangePassword = true;
  doc.users[0].sessionVersion = 3;
  doc.users[1].emailVerifiedAt = null;
  doc.wishlists[0].subtitle = "Noël 🎄 — « déjà » ça";
  doc.wishlists[0].coverImageUrl = "https://example.test/cover.png";
  doc.wishlists[0].readPasswordHash = "scrypt$abc";
  doc.wishlists[0].fromTemplate = true;
  doc.views.push(
    { id: "v-all", wishlistId: "w", label: "Tout", kind: "all", typeIds: [], personId: null, pinned: true },
    { id: "v-p", wishlistId: "w", label: "Alex", kind: "person", typeIds: ["t"], personId: "p", pinned: false },
  );
  doc.items[0].url = "https://example.test/x";
  doc.items[0].imageUrl = "https://example.test/x.png";
  doc.items[0].priceCents = 123456;
  doc.items[0].priority = "★★★";
  doc.items[1].priceCents = null;
  doc.reservations.push({
    id: "r-gift",
    wishlistId: "w",
    itemId: "gift",
    fromName: null,
    note: null,
    userId: "camille",
    createdAt: "2026-01-03T00:00:00.000Z",
  });
  doc.passwordResets.push({
    id: "pr",
    userId: "alex",
    tokenHash: "h1",
    expiresAt: "2026-01-04T00:00:00.000Z",
    createdAt: "2026-01-03T00:00:00.000Z",
  });
  doc.apiSessions.push({
    id: "s",
    userId: "camille",
    tokenHash: "h2",
    sessionVersion: 0,
    createdAt: "2026-01-03T00:00:00.000Z",
    expiresAt: "2026-02-03T00:00:00.000Z",
  });
  doc.apiKeys.push(
    { id: "k1", userId: "camille", name: "Claude", tokenHash: "h5", hint: "abcd", createdAt: "2026-01-03T00:00:00.000Z", lastUsedAt: null },
    {
      id: "k2",
      userId: "camille",
      name: "Script",
      tokenHash: "h6",
      hint: "efgh",
      createdAt: "2026-01-03T00:00:00.000Z",
      lastUsedAt: "2026-01-04T00:00:00.000Z",
    },
  );
  doc.emailConfirmations.push(
    {
      id: "ec-v",
      userId: "camille",
      purpose: "verify",
      email: "camille@example.test",
      tokenHash: "h3",
      expiresAt: "2026-01-04T00:00:00.000Z",
      createdAt: "2026-01-03T00:00:00.000Z",
    },
    {
      id: "ec-c",
      userId: "camille",
      purpose: "change",
      email: "camille.b@example.test",
      tokenHash: "h4",
      expiresAt: "2026-01-04T00:00:00.000Z",
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  );
  return doc;
}

/** Base de démo construite comme `scripts/create-demo-data.mjs` (liste, modèle importé), sans hacher de mot de passe. */
function demoDoc(): Database {
  const seed = JSON.parse(readFileSync(path.join(process.cwd(), "data", "demo-seed.json"), "utf8")) as SeedFile;
  const base = apiDoc();
  const created = createWishlist(base, {
    ownerId: "alex",
    title: "Nos envies toute l’année",
    importTemplate: false,
    id: "demo-list",
    now: new Date("2026-10-21T08:00:00.000Z"),
  });
  assert.ok(created.ok);
  return importTemplate(created.doc, created.wishlist.id, seed);
}

test("aller-retour : chaque collection ressort à l'identique", async () => {
  await withTempDataPath(async () => {
    for (const doc of [apiDoc(), edgeDoc(), demoDoc()]) {
      await replaceDocument(doc);
      assert.deepStrictEqual(await readDocument(), doc);
    }
  });
});
