import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { test } from "node:test";
import type { Database, Item } from "../../src/domain/types";
import { databaseFilePath, openStore, readDocument, updateDocument } from "../../src/store/db";
import { apiDoc, withStore } from "./helpers/api-fixtures";

function totalChanges(): number {
  return (openStore().writer.prepare("select total_changes() as n").get() as { n: number }).n;
}

function item(id: string, sortOrder: number): Item {
  return {
    id,
    wishlistId: "w",
    name: `Idée ${id}`,
    typeId: "t",
    url: null,
    imageUrl: null,
    priceCents: null,
    priority: null,
    personId: "p",
    sortOrder,
    archived: false,
  };
}

test("une modification en place et un nouvel objet sont tous deux enregistrés", async () => {
  await withStore(apiDoc(), async () => {
    await updateDocument((doc) => {
      doc.wishlists[0].title = "Titre en place";
      return { doc, result: null };
    });
    await updateDocument((doc) => ({
      doc: { ...doc, items: doc.items.map((i) => (i.id === "gift" ? { ...i, name: "Nouvel objet" } : i)) },
      result: null,
    }));
    const saved = await readDocument();
    assert.equal(saved.wishlists[0].title, "Titre en place");
    assert.equal(saved.items.find((i) => i.id === "gift")?.name, "Nouvel objet");
  });
});

test("une réservation ajoutée n'écrit qu'une ligne", async () => {
  await withStore(apiDoc(), async () => {
    const before = totalChanges();
    await updateDocument((doc) => {
      doc.reservations.push({
        id: "r-gift",
        wishlistId: "w",
        itemId: "gift",
        fromName: "Sam",
        note: null,
        userId: null,
        createdAt: "2026-01-03T00:00:00.000Z",
      });
      return { doc, result: null };
    });
    assert.equal(totalChanges() - before, 1);
  });
});

test("un mutate qui lève : rien n'est écrit et l'erreur remonte", async () => {
  await withStore(apiDoc(), async () => {
    await assert.rejects(
      updateDocument((doc) => {
        doc.wishlists[0].title = "Jamais";
        doc.items.push(item("jamais", 9));
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.deepStrictEqual(await readDocument(), apiDoc());
    // La base reste utilisable après l'échec.
    await updateDocument((doc) => {
      doc.wishlists[0].title = "Après";
      return { doc, result: null };
    });
    assert.equal((await readDocument()).wishlists[0].title, "Après");
  });
});

test("une clé étrangère cassée est refusée au COMMIT, rien n'est écrit", async () => {
  await withStore(apiDoc(), async () => {
    await assert.rejects(
      updateDocument((doc) => {
        doc.wishlists[0].title = "Jamais";
        doc.items.push({ ...item("orphan", 9), wishlistId: "absente" });
        return { doc, result: null };
      }),
      /FOREIGN KEY/,
    );
    assert.deepStrictEqual(await readDocument(), apiDoc());
  });
});

test("deux lignes de même clé : erreur, au lieu d'en perdre une en silence", async () => {
  await withStore(apiDoc(), async () => {
    await assert.rejects(
      updateDocument((doc) => {
        doc.items.push({ ...item("gift", 9), name: "Doublon" });
        return { doc, result: null };
      }),
      /items: deux enregistrements avec la même clé \(gift\)/,
    );
    assert.deepStrictEqual(await readDocument(), apiDoc());
  });
});

test("l'index unique refuse une deuxième réservation de la même idée, même sans la règle du domaine", async () => {
  await withStore(apiDoc(), async () => {
    await assert.rejects(
      updateDocument((doc) => {
        doc.wishlists[0].title = "Jamais";
        doc.reservations.push({ ...doc.reservations[0], id: "r-taken-2", fromName: "Autre" });
        return { doc, result: null };
      }),
      /UNIQUE/,
    );
    assert.deepStrictEqual(await readDocument(), apiDoc());
  });
});

test("ordre : les ajouts sortent dans l'ordre d'ajout, une modification garde sa place", async () => {
  await withStore(apiDoc(), async () => {
    for (const [id, order] of [
      ["a3", 3],
      ["a4", 4],
      ["a5", 5],
    ] as const) {
      await updateDocument((doc) => {
        doc.items.push(item(id, order));
        return { doc, result: null };
      });
    }
    await updateDocument((doc) => {
      doc.items.find((i) => i.id === "gift")!.name = "Modifiée";
      return { doc, result: null };
    });
    assert.deepEqual(
      (await readDocument()).items.map((i) => i.id),
      ["gift", "gift2", "taken", "a3", "a4", "a5"],
    );
  });
});

test("une lecture pendant une écriture en attente voit l'état d'avant, sans attendre", async () => {
  await withStore(apiDoc(), async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let entered!: () => void;
    const inside = new Promise<void>((resolve) => (entered = resolve));
    const writing = updateDocument(async (doc: Database) => {
      doc.wishlists[0].title = "Pendant";
      entered();
      await gate;
      return { doc, result: null };
    });
    await inside;
    assert.equal((await readDocument()).wishlists[0].title, "Liste d'Alex");
    release();
    await writing;
    assert.equal((await readDocument()).wishlists[0].title, "Pendant");
  });
});

test("la base et ses fichiers annexes sont en mode 600", { skip: process.platform === "win32" }, async () => {
  await withStore(apiDoc(), async () => {
    const file = databaseFilePath();
    for (const suffix of ["", "-wal", "-shm"]) {
      assert.equal((await stat(`${file}${suffix}`)).mode & 0o777, 0o600, `${file}${suffix}`);
    }
  });
});
