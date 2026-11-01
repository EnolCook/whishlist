import { cache } from "react";
import type { Database } from "../domain/types";
import { openStore, readTransaction, writeTransaction } from "./connection";
import { deleteAll, insertAll, writeDiff } from "./diff";
import { readAll } from "./rows";

export { closeStore, dataFilePath, databaseFilePath, openStore } from "./connection";

/** Lecture complète, instantané cohérent. Ordre des tableaux = ordre d'insertion. */
export async function readDocument(): Promise<Database> {
  const store = openStore();
  return readTransaction(store, readAll);
}

/** One read per RSC request (layout + page + auth share this). */
export const getDocument = cache(readDocument);

/**
 * Une modification à la fois par base. `mutate` peut modifier `doc` en place ou en rendre un autre ;
 * seules les lignes ajoutées, modifiées ou retirées sont écrites. Tout ou rien : si `mutate` lève
 * ou si une contrainte échoue, rien n'est écrit et l'erreur remonte.
 */
export async function updateDocument<T>(
  mutate: (doc: Database) => { doc: Database; result: T } | Promise<{ doc: Database; result: T }>,
): Promise<T> {
  const store = openStore();
  return writeTransaction(store, async (db) => {
    const doc = readAll(db);
    const before = structuredClone(doc);
    const { doc: next, result } = await mutate(doc);
    writeDiff(db, before, next);
    return result;
  });
}

/** Remplace tout le contenu en une transaction (démo, remise à zéro de l'e2e, tests). */
export async function replaceDocument(doc: Database): Promise<void> {
  const store = openStore();
  await writeTransaction(store, async (db) => {
    deleteAll(db);
    insertAll(db, doc);
  });
}
