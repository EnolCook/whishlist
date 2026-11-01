import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, rmSync } from "node:fs";
import path from "node:path";
import { insertAll } from "./diff";
import { loadLegacyDocument } from "./legacy-json";
import type { Database as Doc } from "../domain/types";
import { readAll, type StoreDb } from "./rows";
import * as schema from "./schema";

export interface Store {
  file: string;
  /** Connexion des écritures : une transaction à la fois, par la file `queue`. */
  writer: Database.Database;
  db: StoreDb;
  /** Connexion des lectures : jamais l'état non validé d'une écriture en cours. */
  reader: Database.Database;
  readDb: StoreDb;
  queue: Promise<unknown>;
}

/** Chemin de l'ancien fichier JSON (`WISHLIST_DATA_PATH`, défaut `data/wishlist.json`). */
export function dataFilePath(): string {
  return process.env.WISHLIST_DATA_PATH ?? path.join(process.cwd(), "data", "wishlist.json");
}

/** La base est à côté de l'ancien fichier, en `.db` ; un chemin en `.db` est pris tel quel. */
export function databaseFilePath(dataPath = dataFilePath()): string {
  if (dataPath.endsWith(".db")) return dataPath;
  return dataPath.endsWith(".json") ? `${dataPath.slice(0, -".json".length)}.db` : `${dataPath}.db`;
}

function legacyFilePath(dataPath: string): string | null {
  return dataPath.endsWith(".db") ? null : dataPath;
}

// Résolu au chargement du module : certains tests changent ensuite de dossier courant (`withStore`).
const MIGRATIONS_FOLDER = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

function migrationsFolder(): string {
  return MIGRATIONS_FOLDER;
}

const globalStores = globalThis as unknown as { __wishlistStores?: Map<string, Store> };
const stores = (globalStores.__wishlistStores ??= new Map<string, Store>());

function restrictModes(file: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      chmodSync(`${file}${suffix}`, 0o600);
    } catch {
      // fichier absent, Windows / FS sans chmod — ignore
    }
  }
}

function removeDatabaseFiles(file: string): void {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
}

const BUSY_TIMEOUT_MS = 5000;

/**
 * Passage en WAL. Sur une base neuve qu'un autre processus est en train d'ouvrir, SQLite répond
 * SQLITE_BUSY sans passer par `busy_timeout` : on réessaie donc nous-mêmes, jusqu'au même délai.
 */
function enableWal(connection: Database.Database): void {
  const deadline = Date.now() + BUSY_TIMEOUT_MS;
  for (;;) {
    try {
      connection.pragma("journal_mode = WAL");
      return;
    } catch (error) {
      const busy = error instanceof Database.SqliteError && error.code === "SQLITE_BUSY";
      if (!busy || Date.now() >= deadline) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

function connect(file: string): Database.Database {
  const connection = new Database(file);
  // En premier : un autre processus peut tenir la base (passage en WAL, migration, import).
  connection.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  enableWal(connection);
  connection.pragma("synchronous = NORMAL");
  connection.pragma("foreign_keys = ON");
  return connection;
}

/**
 * Migrations puis import de l'ancien fichier, dans une seule transaction BEGIN IMMEDIATE :
 * un seul processus applique une migration ou importe ; l'import est tout ou rien.
 * (Même table de suivi que le migrateur de Drizzle, qui lit son état hors transaction.)
 */
function migrateAndImport(connection: Database.Database, db: StoreDb, legacyFile: string | null): void {
  const migrations = readMigrationFiles({ migrationsFolder: migrationsFolder() });
  connection.exec("BEGIN IMMEDIATE");
  try {
    connection.exec(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
    );
    const last = connection.prepare("SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1").get() as
      | { created_at: number }
      | undefined;
    for (const migration of migrations) {
      if (last && Number(last.created_at) >= migration.folderMillis) continue;
      for (const statement of migration.sql) if (statement.trim()) connection.exec(statement);
      connection
        .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
        .run(migration.hash, migration.folderMillis);
    }

    let imported: Doc | null = null;
    const marker = connection.prepare("SELECT value FROM meta WHERE key = 'legacy_import'").get();
    if (!marker) {
      connection.exec("PRAGMA defer_foreign_keys = ON");
      if (legacyFile && existsSync(/*turbopackIgnore: true*/ legacyFile)) {
        imported = loadLegacyDocument(legacyFile);
        insertAll(db, imported);
        db.insert(schema.meta).values({ key: "legacy_import", value: `imported:${new Date().toISOString()}` }).run();
      } else {
        db.insert(schema.meta).values({ key: "legacy_import", value: "none" }).run();
      }
    }
    connection.exec("COMMIT");
    if (imported) {
      console.info(
        `[store] ancien fichier importé : ${imported.users.length} comptes, ${imported.wishlists.length} listes, ` +
          `${imported.items.length} idées, ${imported.reservations.length} réservations`,
      );
    }
  } catch (error) {
    if (connection.inTransaction) connection.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Ouvre la base une fois par chemin et par processus (cache sur globalThis pour `next dev`) :
 * pragmas, migrations de `drizzle/`, import de l'ancien fichier si ce n'est pas déjà fait.
 * Lève `LegacyImportError` si l'ancien fichier est illisible ou incohérent ; une base créée par
 * cet appel est alors supprimée.
 */
export function openStore(dataPath = dataFilePath()): Store {
  const file = databaseFilePath(dataPath);
  const cached = stores.get(file);
  if (cached) return cached;

  mkdirSync(path.dirname(file), { recursive: true });
  const created = !existsSync(/*turbopackIgnore: true*/ file);
  if (created) closeSync(openSync(/*turbopackIgnore: true*/ file, "a", 0o600));

  let writer: Database.Database | null = null;
  let reader: Database.Database | null = null;
  try {
    writer = connect(file);
    const db = drizzle(writer, { schema });
    migrateAndImport(writer, db, legacyFilePath(dataPath));
    reader = connect(file);
    restrictModes(file);
    const store: Store = { file, writer, db, reader, readDb: drizzle(reader, { schema }), queue: Promise.resolve() };
    stores.set(file, store);
    return store;
  } catch (error) {
    reader?.close();
    writer?.close();
    if (created) removeDatabaseFiles(file);
    throw error;
  }
}

/** Ferme les connexions (tests, fin de script). Sans argument : toutes les bases ouvertes. */
export function closeStore(dataPath?: string): void {
  const files = dataPath === undefined ? [...stores.keys()] : [databaseFilePath(dataPath)];
  for (const file of files) {
    const store = stores.get(file);
    if (!store) continue;
    store.reader.close();
    store.writer.close();
    stores.delete(file);
  }
}

/** Une transaction d'écriture à la fois par base, dans l'ordre d'appel. */
export function enqueue<T>(store: Store, run: () => Promise<T>): Promise<T> {
  const next = store.queue.then(run, run);
  store.queue = next.catch(() => undefined);
  return next;
}

/**
 * BEGIN IMMEDIATE (attend un autre processus jusqu'à `busy_timeout`), clés étrangères vérifiées au COMMIT,
 * ROLLBACK si `run` lève. `run` peut être asynchrone : la file garantit que personne d'autre n'utilise
 * la connexion d'écriture pendant ce temps.
 */
export function writeTransaction<T>(store: Store, run: (db: StoreDb) => Promise<T>): Promise<T> {
  return enqueue(store, async () => {
    store.writer.exec("BEGIN IMMEDIATE");
    try {
      store.writer.exec("PRAGMA defer_foreign_keys = ON");
      const result = await run(store.db);
      store.writer.exec("COMMIT");
      return result;
    } catch (error) {
      if (store.writer.inTransaction) store.writer.exec("ROLLBACK");
      throw error;
    }
  });
}

/** Instantané cohérent sur la connexion de lecture, en un seul tour synchrone. */
export function readTransaction<T>(store: Store, run: (db: StoreDb) => T): T {
  store.reader.exec("BEGIN");
  try {
    return run(store.readDb);
  } finally {
    store.reader.exec("COMMIT");
  }
}

/** Lecture seule d'un fichier de base, sans migration ni import (contrôle, sauvegarde, outils). */
export function readDatabaseFile(file: string): Doc {
  const connection = new Database(file, { readonly: true, fileMustExist: true });
  try {
    connection.pragma("busy_timeout = 5000");
    return readAll(drizzle(connection, { schema }));
  } finally {
    connection.close();
  }
}
