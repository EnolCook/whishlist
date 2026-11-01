import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { reserve } from "../../src/server/commands/public-list";
import { closeStore, readDocument, updateDocument } from "../../src/store/db";
import { apiDoc, ctx, withStore } from "./helpers/api-fixtures";

const run = promisify(execFile);
const noUnlock = () => false;

test("100 réservations simultanées de la même idée : une seule réussit (SC-004)", async () => {
  await withStore(apiDoc(), async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        reserve(ctx(null, `198.51.100.${i + 1}`), { readToken: "rt", itemId: "gift", fromName: `P${i}`, isUnlocked: noUnlock }),
      ),
    );
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.deepEqual([...new Set(results.filter((r) => !r.ok).map((r) => (r.ok ? "" : r.error)))], ["itemAlreadyReserved"]);
    assert.equal((await readDocument()).reservations.filter((r) => r.itemId === "gift").length, 1);
  });
});

test("deux processus réservent la même idée en même temps : une seule réservation au total", async () => {
  await withStore(apiDoc(), async () => {
    const dataPath = process.env.WISHLIST_DATA_PATH!;
    // La base existe déjà (withStore) : les deux processus n'ont rien à importer.
    closeStore(dataPath);
    const worker = path.join(import.meta.dirname, "helpers", "reserve-worker.ts");
    const repoRoot = path.resolve(import.meta.dirname, "..", "..");
    const outputs = await Promise.all(
      ["198.51.100", "203.0.113"].map((prefix) =>
        run(process.execPath, ["--import", "tsx", worker, dataPath, "50", prefix], { cwd: repoRoot }),
      ),
    );
    const counts = outputs.map(({ stdout }) => JSON.parse(stdout) as { ok: number; errors: string[] });
    assert.equal(counts[0].ok + counts[1].ok, 1);
    for (const { errors } of counts) assert.deepEqual(errors, ["itemAlreadyReserved"]);
    assert.equal((await readDocument()).reservations.filter((r) => r.itemId === "gift").length, 1);
  });
});

test("deux écritures concurrentes sur deux listes différentes sont toutes deux gardées", async () => {
  const doc = apiDoc();
  doc.wishlists.push({ ...doc.wishlists[0], id: "w2", title: "Autre", readToken: "rt2", inviteToken: "it2" });
  await withStore(doc, async () => {
    await Promise.all([
      updateDocument((current) => {
        current.wishlists.find((w) => w.id === "w")!.title = "Un";
        return { doc: current, result: null };
      }),
      updateDocument((current) => {
        current.wishlists.find((w) => w.id === "w2")!.title = "Deux";
        return { doc: current, result: null };
      }),
    ]);
    assert.deepEqual(
      (await readDocument()).wishlists.map((w) => w.title),
      ["Un", "Deux"],
    );
  });
});
