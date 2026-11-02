import { formatPrice } from "./price";
import type { Database, Item, View, Wishlist } from "./types";

export interface PublicItem {
  id: string;
  name: string;
  typeLabel: string;
  url: string | null;
  imageUrl: string | null;
  priceLabel: string | null;
  priority: string | null;
  secondHandOk: boolean;
  personLabel: string;
  reserved: boolean;
  /** Réservation faite par le visiteur courant (compte ou cookie). */
  mine: boolean;
  reservationId: string | null;
  sortOrder: number;
}

export interface PublicWishlist {
  wishlist: Wishlist;
  items: PublicItem[];
  views: View[];
}

export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function findWishlistByReadToken(doc: Database, readToken: string): Wishlist | null {
  return doc.wishlists.find((w) => w.readToken === readToken) ?? null;
}

export function listItems(doc: Database, wishlistId: string): Item[] {
  return sortItems(doc.items.filter((item) => item.wishlistId === wishlistId && !item.archived));
}

export function toPublicItem(
  doc: Database,
  item: Item,
  locale = "fr-FR",
  mineReservationIds: ReadonlySet<string> = new Set(),
): PublicItem {
  const type = doc.types.find((t) => t.id === item.typeId);
  const person = doc.people.find((p) => p.id === item.personId);
  const reservation = doc.reservations.find((r) => r.itemId === item.id);
  const mine = Boolean(reservation && mineReservationIds.has(reservation.id));
  return {
    id: item.id,
    name: item.name,
    typeLabel: type?.label ?? item.typeId,
    url: item.url,
    imageUrl: item.imageUrl ?? null,
    priceLabel: formatPrice(item.priceCents, locale),
    priority: item.priority,
    secondHandOk: item.secondHandOk,
    personLabel: person?.label ?? item.personId,
    reserved: Boolean(reservation),
    mine,
    reservationId: reservation?.id ?? null,
    sortOrder: item.sortOrder,
  };
}

/** Ids de réservation « à moi » : compte connecté et/ou claims cookie. */
export function mineReservationIdsFor(
  doc: Database,
  wishlistId: string,
  userId: string | null,
  claimedIds: ReadonlySet<string>,
): Set<string> {
  const ids = new Set<string>();
  for (const reservation of doc.reservations) {
    if (reservation.wishlistId !== wishlistId) continue;
    if (userId && reservation.userId === userId) ids.add(reservation.id);
    if (claimedIds.has(reservation.id)) ids.add(reservation.id);
  }
  return ids;
}

/**
 * Idées visibles publiquement : non réservées, ou réservées par le visiteur.
 * (Les réservations archivent l'idée — on les ré-inclut si mine.)
 */
export function listPublicVisibleItems(
  doc: Database,
  wishlistId: string,
  mineReservationIds: ReadonlySet<string>,
): Item[] {
  const reservedItemIds = new Set(
    doc.reservations.filter((r) => r.wishlistId === wishlistId).map((r) => r.itemId),
  );
  const mineItemIds = new Set(
    doc.reservations
      .filter((r) => r.wishlistId === wishlistId && mineReservationIds.has(r.id))
      .map((r) => r.itemId),
  );
  return sortItems(
    doc.items.filter((item) => {
      if (item.wishlistId !== wishlistId) return false;
      if (mineItemIds.has(item.id)) return true;
      if (item.archived) return false;
      return !reservedItemIds.has(item.id);
    }),
  );
}

export function getPublicWishlist(
  doc: Database,
  readToken: string,
  locale = "fr-FR",
  mineReservationIds: ReadonlySet<string> = new Set(),
): PublicWishlist | null {
  const wishlist = findWishlistByReadToken(doc, readToken);
  if (!wishlist) return null;
  const items = listPublicVisibleItems(doc, wishlist.id, mineReservationIds).map((item) =>
    toPublicItem(doc, item, locale, mineReservationIds),
  );
  const views = doc.views.filter((view) => view.wishlistId === wishlist.id);
  return { wishlist, items, views };
}
