import { clone } from "./access";
import { DEFAULT_WISHLIST_THEME } from "./theme";
import { distinctTokens, newId } from "./tokens";
import type { Database, SeedFile, Wishlist } from "./types";

function prefix(wishlistId: string, id: string): string {
  return `${wishlistId}:${id}`;
}

export function importTemplate(doc: Database, wishlistId: string, seed: SeedFile): Database {
  const next = clone(doc);
  seed.types.forEach((type, index) => {
    next.types.push({
      id: prefix(wishlistId, type.id),
      wishlistId,
      label: type.label,
      sortOrder: index,
    });
  });
  for (const person of seed.people) {
    next.people.push({
      id: prefix(wishlistId, person.id),
      wishlistId,
      label: person.label,
    });
  }
  for (const view of seed.views) {
    next.views.push({
      id: prefix(wishlistId, view.id),
      wishlistId,
      label: view.label,
      kind: view.kind,
      typeIds: view.typeIds.map((id) => prefix(wishlistId, id)),
      personId: view.personId ? prefix(wishlistId, view.personId) : null,
      pinned: view.pinned,
    });
  }
  for (const item of seed.items) {
    next.items.push({
      id: prefix(wishlistId, item.id),
      wishlistId,
      name: item.name,
      typeId: prefix(wishlistId, item.typeId),
      url: item.url,
      imageUrl: item.imageUrl ?? null,
      priceCents: item.priceCents,
      priority: item.priority,
      secondHandOk: item.secondHandOk ?? false,
      description: item.description ?? null,
      personId: prefix(wishlistId, item.personId),
      sortOrder: item.sortOrder,
      archived: item.archived ?? false,
    });
  }
  return next;
}

export function createWishlist(
  doc: Database,
  input: {
    ownerId: string;
    title: string;
    importTemplate: boolean;
    seed?: SeedFile;
    now?: Date;
    id?: string;
  },
): { ok: true; doc: Database; wishlist: Wishlist } | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "listNeedsTitle" };
  if (!doc.users.some((u) => u.id === input.ownerId)) {
    return { ok: false, error: "accountMissing" };
  }
  const now = (input.now ?? new Date()).toISOString();
  const id = input.id ?? newId();
  const tokens = distinctTokens();
  const wishlist: Wishlist = {
    id,
    title,
    subtitle: null,
    coverImageUrl: null,
    theme: { ...DEFAULT_WISHLIST_THEME },
    readToken: tokens.readToken,
    inviteToken: tokens.inviteToken,
    readPasswordHash: null,
    fromTemplate: input.importTemplate,
    createdAt: now,
  };
  let next = clone(doc);
  next.wishlists.push(wishlist);
  next.memberships.push({
    wishlistId: id,
    userId: input.ownerId,
    role: "owner",
    joinedAt: now,
  });
  if (input.importTemplate) {
    if (!input.seed) return { ok: false, error: "seedMissing" };
    next = importTemplate(next, id, input.seed);
  }
  return { ok: true, doc: next, wishlist };
}
