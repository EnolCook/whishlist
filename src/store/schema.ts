import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Role, ViewKind, WishlistTheme } from "../domain/types";

// Une table par collection de `Database`, mêmes noms de champs (colonnes en snake_case).
// Pas de ON DELETE CASCADE : le domaine supprime lui-même les lignes liées, une clé étrangère
// qui échoue au COMMIT révèle un oubli au lieu de le réparer en silence.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  sessionVersion: integer("session_version").notNull().default(0),
  emailVerifiedAt: text("email_verified_at"),
});

export const wishlists = sqliteTable("wishlists", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  coverImageUrl: text("cover_image_url"),
  theme: text("theme", { mode: "json" }).$type<WishlistTheme>().notNull(),
  readToken: text("read_token").notNull().unique(),
  inviteToken: text("invite_token").notNull().unique(),
  readPasswordHash: text("read_password_hash"),
  fromTemplate: integer("from_template", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const memberships = sqliteTable(
  "memberships",
  {
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").$type<Role>().notNull(),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.wishlistId, table.userId] }),
    index("memberships_user_id").on(table.userId),
    check("memberships_role", sql`${table.role} in ('owner', 'member')`),
  ],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    readPasswordHash: text("read_password_hash"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.wishlistId, table.userId] }),
    index("subscriptions_user_id").on(table.userId),
  ],
);

export const types = sqliteTable(
  "types",
  {
    id: text("id").primaryKey(),
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("types_wishlist_id").on(table.wishlistId)],
);

export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    label: text("label").notNull(),
  },
  (table) => [index("people_wishlist_id").on(table.wishlistId)],
);

export const views = sqliteTable(
  "views",
  {
    id: text("id").primaryKey(),
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    label: text("label").notNull(),
    kind: text("kind").$type<ViewKind>().notNull(),
    typeIds: text("type_ids", { mode: "json" }).$type<string[]>().notNull(),
    personId: text("person_id").references(() => people.id),
    pinned: integer("pinned", { mode: "boolean" }).notNull(),
  },
  (table) => [
    index("views_wishlist_id").on(table.wishlistId),
    check("views_kind", sql`${table.kind} in ('all', 'types', 'person')`),
  ],
);

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    name: text("name").notNull(),
    typeId: text("type_id")
      .notNull()
      .references(() => types.id),
    url: text("url"),
    imageUrl: text("image_url"),
    priceCents: integer("price_cents"),
    priority: text("priority"),
    secondHandOk: integer("second_hand_ok", { mode: "boolean" }).notNull().default(false),
    description: text("description"),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    sortOrder: integer("sort_order").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("items_wishlist_id").on(table.wishlistId)],
);

export const reservations = sqliteTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id),
    // Unique : deux personnes ne peuvent pas confirmer la même idée (principe III).
    itemId: text("item_id")
      .notNull()
      .unique()
      .references(() => items.id),
    fromName: text("from_name"),
    note: text("note"),
    userId: text("user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("reservations_wishlist_id").on(table.wishlistId), index("reservations_user_id").on(table.userId)],
);

export const passwordResets = sqliteTable(
  "password_resets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("password_resets_user_id").on(table.userId)],
);

export const emailConfirmations = sqliteTable(
  "email_confirmations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    purpose: text("purpose", { enum: ["verify", "change"] }).notNull(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("email_confirmations_user_id").on(table.userId),
    uniqueIndex("email_confirmations_user_purpose").on(table.userId, table.purpose),
    check("email_confirmations_purpose", sql`${table.purpose} in ('verify', 'change')`),
  ],
);

export const apiSessions = sqliteTable(
  "api_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    sessionVersion: integer("session_version").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("api_sessions_user_id").on(table.userId)],
);

/** Clés techniques : `legacy_import` = `imported:<ISO>` ou `none`. */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
