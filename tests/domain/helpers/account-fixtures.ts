import { DEFAULT_WISHLIST_THEME } from "../../../src/domain/theme";
import { emptyDatabase, type Database, type Role } from "../../../src/domain/types";
import { user } from "./api-fixtures";

function addList(doc: Database, id: string, title: string, members: [string, Role, string][]): void {
  doc.wishlists.push({
    id,
    title,
    subtitle: null,
    coverImageUrl: null,
    theme: { ...DEFAULT_WISHLIST_THEME },
    readToken: `read-${id}`,
    inviteToken: `invite-${id}`,
    readPasswordHash: null,
    fromTemplate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  for (const [userId, role, joinedAt] of members) {
    doc.memberships.push({ wishlistId: id, userId, role, joinedAt });
  }
  doc.types.push({ id: `${id}-type`, wishlistId: id, label: `Catégorie ${id}`, sortOrder: 0 });
  doc.people.push({ id: `${id}-person`, wishlistId: id, label: `Qui ${id}` });
  doc.views.push({
    id: `${id}-view`,
    wishlistId: id,
    label: "Tout",
    kind: "all",
    typeIds: [],
    personId: null,
    pinned: false,
  });
  doc.items.push({
    id: `${id}-item`,
    wishlistId: id,
    name: `Idée ${id}`,
    typeId: `${id}-type`,
    url: "https://shop.example.test/idee",
    imageUrl: null,
    priceCents: 2500,
    priority: null,
    secondHandOk: false,
    description: null,
    personId: `${id}-person`,
    sortOrder: 0,
    archived: false,
  });
}

/**
 * Lou (`lou`) est le compte supprimé ou exporté.
 * - `solo` : Lou seule (propriétaire) ;
 * - `shared` : Lou propriétaire, Alex (rejoint en février) et Camille (en mars) membres → Alex hérite ;
 * - `alexs` : Alex propriétaire, Lou membre ;
 * - `other` : Camille seule ; Lou y a réservé une idée connectée.
 */
export function accountDoc(): Database {
  const doc = emptyDatabase();
  for (const [id, name] of [
    ["lou", "Lou"],
    ["alex", "Alex"],
    ["camille", "Camille"],
  ]) {
    doc.users.push({ ...user(id, `${id}@example.test`, name), passwordHash: `scrypt$hash-${id}`, sessionVersion: 3 });
  }
  addList(doc, "solo", "Anniversaire Lou", [["lou", "owner", "2026-01-01T00:00:00.000Z"]]);
  addList(doc, "shared", "Noël en famille", [
    ["lou", "owner", "2026-01-01T00:00:00.000Z"],
    ["camille", "member", "2026-03-01T00:00:00.000Z"],
    ["alex", "member", "2026-02-01T00:00:00.000Z"],
  ]);
  addList(doc, "alexs", "Envies d'Alex", [
    ["alex", "owner", "2026-01-01T00:00:00.000Z"],
    ["lou", "member", "2026-02-01T00:00:00.000Z"],
  ]);
  addList(doc, "other", "Liste de Camille", [["camille", "owner", "2026-01-01T00:00:00.000Z"]]);
  doc.wishlists.find((w) => w.id === "alexs")!.readPasswordHash = "scrypt$read-secret";

  doc.reservations.push(
    {
      id: "r-solo",
      wishlistId: "solo",
      itemId: "solo-item",
      fromName: "Sam",
      note: null,
      userId: null,
      createdAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "r-shared",
      wishlistId: "shared",
      itemId: "shared-item",
      fromName: "Camille",
      note: "Pour Noël",
      userId: "camille",
      createdAt: "2026-04-02T00:00:00.000Z",
    },
    {
      id: "r-alexs",
      wishlistId: "alexs",
      itemId: "alexs-item",
      fromName: "Lou",
      note: "Avec Camille",
      userId: "lou",
      createdAt: "2026-04-03T00:00:00.000Z",
    },
    {
      id: "r-other",
      wishlistId: "other",
      itemId: "other-item",
      fromName: "Lou",
      note: "Surprise",
      userId: "lou",
      createdAt: "2026-04-04T00:00:00.000Z",
    },
  );
  for (const userId of ["lou", "alex"]) {
    doc.apiKeys.push({
      id: `k-${userId}`,
      userId,
      name: `Clé de ${userId}`,
      tokenHash: `api-key-hash-${userId}`,
      hint: "wxyz",
      createdAt: "2026-04-01T00:00:00.000Z",
      lastUsedAt: null,
    });
    doc.apiSessions.push({
      id: `s-${userId}`,
      userId,
      tokenHash: `api-token-hash-${userId}`,
      sessionVersion: 3,
      createdAt: "2026-04-01T00:00:00.000Z",
      expiresAt: "2026-05-01T00:00:00.000Z",
    });
    doc.passwordResets.push({
      id: `pr-${userId}`,
      userId,
      tokenHash: `reset-token-hash-${userId}`,
      expiresAt: "2026-04-01T01:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
  }
  doc.subscriptions.push(
    {
      wishlistId: "other",
      userId: "lou",
      readPasswordHash: null,
      createdAt: "2026-04-04T00:00:00.000Z",
    },
    {
      wishlistId: "solo",
      userId: "camille",
      readPasswordHash: null,
      createdAt: "2026-04-02T00:00:00.000Z",
    },
  );
  return doc;
}
