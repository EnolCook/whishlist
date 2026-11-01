import type { Database } from "../domain/types";
import { COLLECTION_NAMES, COLLECTIONS, sameRow, type CollectionName, type RowOf, type StoreDb } from "./rows";

interface Plan<K extends CollectionName> {
  name: K;
  old: Map<string, RowOf<K>>;
  next: Map<string, RowOf<K>>;
}

/** Lignes par clé ; deux lignes de même clé lèvent une erreur au lieu de disparaître en silence. */
function byKey<K extends CollectionName>(name: K, rows: Database[K]): Map<string, RowOf<K>> {
  const collection = COLLECTIONS[name];
  const map = new Map<string, RowOf<K>>();
  for (const row of rows) {
    const key = collection.key(row);
    if (map.has(key)) throw new Error(`${name}: deux enregistrements avec la même clé (${key})`);
    map.set(key, row);
  }
  return map;
}

function plan<K extends CollectionName>(name: K, before: Database, after: Database): Plan<K> {
  return { name, old: byKey(name, before[name]), next: byKey(name, after[name]) };
}

function deleteRemoved<K extends CollectionName>(db: StoreDb, { name, old, next }: Plan<K>): void {
  const collection = COLLECTIONS[name];
  for (const [key, row] of old) {
    if (!next.has(key)) db.delete(collection.table).where(collection.where(row)).run();
  }
}

function updateChanged<K extends CollectionName>(db: StoreDb, { name, old, next }: Plan<K>): void {
  const collection = COLLECTIONS[name];
  for (const [key, row] of next) {
    const previous = old.get(key);
    if (previous && !sameRow(collection, previous, row)) {
      db.update(collection.table).set(row).where(collection.where(row)).run();
    }
  }
}

function insertAdded<K extends CollectionName>(db: StoreDb, { name, old, next }: Plan<K>): void {
  const { table } = COLLECTIONS[name];
  for (const [key, row] of next) {
    if (!old.has(key)) db.insert(table).values(row).run();
  }
}

/**
 * Écrit seulement ce qui a changé entre `before` et `after`, par clé primaire.
 * Suppressions d'abord (un index unique, comme une réservation par idée, n'est pas différé),
 * puis modifications, puis ajouts dans l'ordre du tableau. Jamais INSERT OR REPLACE : il change le rowid.
 * À appeler dans une transaction, avec `defer_foreign_keys` actif.
 */
export function writeDiff(db: StoreDb, before: Database, after: Database): void {
  const plans = COLLECTION_NAMES.map((name) => plan(name, before, after));
  for (const p of plans) deleteRemoved(db, p);
  for (const p of plans) updateChanged(db, p);
  for (const p of plans) insertAdded(db, p);
}

function insertCollection<K extends CollectionName>(db: StoreDb, name: K, doc: Database): void {
  const { table } = COLLECTIONS[name];
  for (const row of doc[name]) db.insert(table).values(row).run();
}

/** Insère tout le document, dans l'ordre des tableaux (import, remplacement). */
export function insertAll(db: StoreDb, doc: Database): void {
  for (const name of COLLECTION_NAMES) insertCollection(db, name, doc);
}

/** Vide toutes les tables (remplacement). */
export function deleteAll(db: StoreDb): void {
  for (const name of [...COLLECTION_NAMES].reverse()) db.delete(COLLECTIONS[name].table).run();
}
