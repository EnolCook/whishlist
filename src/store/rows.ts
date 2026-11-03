import { and, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "../domain/types";
import * as schema from "./schema";

export type StoreDb = BetterSQLite3Database<typeof schema>;

export type CollectionName = keyof Database;
export type RowOf<K extends CollectionName> = Database[K][number];

export interface Collection<K extends CollectionName> {
  table: SQLiteTable;
  /** Clé primaire, sérialisée en une chaîne (identifiants seulement, jamais une donnée personnelle). */
  key(row: RowOf<K>): string;
  /** Condition SQL sur la clé primaire. */
  where(row: RowOf<K>): SQL;
}

type WithId = { [K in CollectionName]: RowOf<K> extends { id: string } ? K : never }[CollectionName];

function byId<K extends WithId>(table: SQLiteTable & { id: SQLiteColumn }): Collection<K> {
  return {
    table,
    key: (row) => row.id,
    where: (row) => eq(table.id, row.id),
  };
}

/** Chaque objet du domaine est une ligne telle quelle (mêmes noms de propriétés que le schéma). */
export const COLLECTIONS: { [K in CollectionName]: Collection<K> } = {
  users: byId(schema.users),
  wishlists: byId(schema.wishlists),
  memberships: {
    table: schema.memberships,
    key: (row) => `${row.wishlistId}/${row.userId}`,
    where: (row) =>
      and(eq(schema.memberships.wishlistId, row.wishlistId), eq(schema.memberships.userId, row.userId)) ?? sql`0`,
  },
  subscriptions: {
    table: schema.subscriptions,
    key: (row) => `${row.wishlistId}/${row.userId}`,
    where: (row) =>
      and(eq(schema.subscriptions.wishlistId, row.wishlistId), eq(schema.subscriptions.userId, row.userId)) ?? sql`0`,
  },
  types: byId(schema.types),
  people: byId(schema.people),
  views: byId(schema.views),
  items: byId(schema.items),
  reservations: byId(schema.reservations),
  passwordResets: byId(schema.passwordResets),
  apiSessions: byId(schema.apiSessions),
  emailConfirmations: byId(schema.emailConfirmations),
};

/** Les collections dans l'ordre de `Database`. */
export const COLLECTION_NAMES: CollectionName[] = [
  "users",
  "wishlists",
  "memberships",
  "subscriptions",
  "types",
  "people",
  "views",
  "items",
  "reservations",
  "passwordResets",
  "apiSessions",
  "emailConfirmations",
];

/** Même contenu colonne par colonne (`undefined` vaut `null`, JSON comparé sérialisé). */
export function sameRow<K extends CollectionName>(collection: Collection<K>, a: RowOf<K>, b: RowOf<K>): boolean {
  const left = new Map(Object.entries(a));
  const right = new Map(Object.entries(b));
  for (const column of Object.keys(getTableColumns(collection.table))) {
    if (JSON.stringify(left.get(column) ?? null) !== JSON.stringify(right.get(column) ?? null)) return false;
  }
  return true;
}

/** Toutes les tables, dans l'ordre d'insertion (`rowid`), comme les tableaux de l'ancien fichier. */
export function readAll(db: StoreDb): Database {
  const byRowid = sql`rowid`;
  return {
    users: db.select().from(schema.users).orderBy(byRowid).all(),
    wishlists: db.select().from(schema.wishlists).orderBy(byRowid).all(),
    memberships: db.select().from(schema.memberships).orderBy(byRowid).all(),
    subscriptions: db.select().from(schema.subscriptions).orderBy(byRowid).all(),
    types: db.select().from(schema.types).orderBy(byRowid).all(),
    people: db.select().from(schema.people).orderBy(byRowid).all(),
    views: db.select().from(schema.views).orderBy(byRowid).all(),
    items: db.select().from(schema.items).orderBy(byRowid).all(),
    reservations: db.select().from(schema.reservations).orderBy(byRowid).all(),
    passwordResets: db.select().from(schema.passwordResets).orderBy(byRowid).all(),
    apiSessions: db.select().from(schema.apiSessions).orderBy(byRowid).all(),
    emailConfirmations: db.select().from(schema.emailConfirmations).orderBy(byRowid).all(),
  };
}
