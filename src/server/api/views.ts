import { mustConfirmEmail } from "../../domain/email-confirmation";
import { listPublicVisibleItems, mineReservationIdsFor, sortItems } from "../../domain/read";
import { formatPrice } from "../../domain/price";
import { hasReadPassword } from "../../domain/read-password";
import { isSubscriptionUnlocked, viewerRelation } from "../../domain/subscription";
import type { Database, Item, Role, Subscription, User, WishlistTheme, Wishlist } from "../../domain/types";
import { intlLocale, type Locale } from "../../i18n/config";
import { withLocale } from "../../i18n/locale-path";
import { emailVerificationRequired } from "../mail";

/** Formes JSON du contrat (`specs/004-mobile-api/contracts/openapi.yaml`). */

export type CategoryView = { id: string; label: string; sortOrder: number };
export type LabelView = { id: string; label: string };

export type PublicItemView = {
  id: string;
  name: string;
  typeId: string;
  personId: string;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  priceLabel: string | null;
  priority: string | null;
  secondHandOk: boolean;
  description: string | null;
  mine: boolean;
  reservationId: string | null;
};

export type PublicListView = {
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  theme: WishlistTheme;
  subscribed: boolean;
  isMember: boolean;
  categories: CategoryView[];
  people: LabelView[];
  items: PublicItemView[];
};

export function categoriesOf(doc: Database, wishlistId: string): CategoryView[] {
  return doc.types
    .filter((type) => type.wishlistId === wishlistId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((type) => ({ id: type.id, label: type.label, sortOrder: type.sortOrder }));
}

export function peopleOf(doc: Database, wishlistId: string): LabelView[] {
  return doc.people
    .filter((person) => person.wishlistId === wishlistId)
    .map((person) => ({ id: person.id, label: person.label }));
}

function itemBase(item: Item, locale: Locale) {
  return {
    id: item.id,
    name: item.name,
    typeId: item.typeId,
    personId: item.personId,
    url: item.url,
    imageUrl: item.imageUrl ?? null,
    priceCents: item.priceCents,
    priceLabel: formatPrice(item.priceCents, intlLocale(locale)),
    priority: item.priority,
    secondHandOk: item.secondHandOk,
    description: item.description,
  };
}

/** Même contenu que la page publique : idées libres, plus celles de ce client. */
export function toPublicListView(
  doc: Database,
  wishlist: Wishlist,
  locale: Locale,
  mineIds: ReadonlySet<string>,
  viewerId: string | null = null,
): PublicListView {
  const reservationByItem = new Map(
    doc.reservations.filter((r) => r.wishlistId === wishlist.id).map((r) => [r.itemId, r.id]),
  );
  const items = listPublicVisibleItems(doc, wishlist.id, mineIds).map((item) => {
    const reservationId = reservationByItem.get(item.id) ?? null;
    const mine = Boolean(reservationId && mineIds.has(reservationId));
    return { ...itemBase(item, locale), mine, reservationId: mine ? reservationId : null };
  });
  const { isMember, subscribed } = viewerRelation(doc, wishlist.id, viewerId);
  return {
    title: wishlist.title,
    subtitle: wishlist.subtitle,
    coverImageUrl: wishlist.coverImageUrl,
    theme: wishlist.theme,
    subscribed,
    isMember,
    categories: categoriesOf(doc, wishlist.id),
    people: peopleOf(doc, wishlist.id),
    items,
  };
}

export type MeView = {
  id: string;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  /** Faux seulement si la validation est exigée et l'adresse pas encore confirmée (010). */
  emailVerified: boolean;
  /** Nouvelle adresse en attente de confirmation (010, US3). */
  pendingEmail: string | null;
};

export type SessionView = { token: string; expiresAt: string; user: MeView };

export type ListSummaryView = {
  id: string;
  title: string;
  /** Depuis 1.1.0 : ce qu'affiche la carte de « Mes listes » (couverture, sous-titre). */
  subtitle: string | null;
  coverImageUrl: string | null;
  theme: WishlistTheme;
  role: Role;
  itemCount: number;
  readUrl: string;
};

export type SubscribedListSummaryView = {
  id: string;
  readToken: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  theme: WishlistTheme;
  itemCount: number;
  readUrl: string;
  subscribedAt: string;
  locked: boolean;
};

export type MemberItemView = Omit<PublicItemView, "mine" | "reservationId"> & { archived: boolean; sortOrder: number };

export type MemberListView = {
  id: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  theme: WishlistTheme;
  role: Role;
  readUrl: string;
  inviteUrl: string;
  hasReadPassword: boolean;
  categories: CategoryView[];
  people: LabelView[];
  items: MemberItemView[];
  reservations: {
    id: string;
    itemId: string;
    itemName: string;
    fromName: string | null;
    note: string | null;
    createdAt: string;
  }[];
  members: { userId: string; displayName: string; role: Role }[];
};

/** `pendingEmail` : `pendingEmailChange(doc, user.id)` de la base que l'appelant a lue. */
export function toMe(user: User, pendingEmail: string | null): MeView {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    mustChangePassword: user.mustChangePassword,
    emailVerified: !mustConfirmEmail(user, emailVerificationRequired()),
    pendingEmail,
  };
}

/** Lien absolu dans la langue du client : `https://…/en/l/<token>`. */
function siteUrl(origin: string, locale: Locale, pathname: string): string {
  return `${origin}${withLocale(locale, pathname)}`;
}

export function toListSummary(
  doc: Database,
  wishlist: Wishlist,
  role: Role,
  locale: Locale,
  origin: string,
): ListSummaryView {
  return {
    id: wishlist.id,
    title: wishlist.title,
    subtitle: wishlist.subtitle,
    coverImageUrl: wishlist.coverImageUrl,
    theme: wishlist.theme,
    role,
    itemCount: doc.items.filter((item) => item.wishlistId === wishlist.id && !item.archived).length,
    readUrl: siteUrl(origin, locale, `/l/${wishlist.readToken}`),
  };
}

export function toSubscribedListSummary(
  doc: Database,
  wishlist: Wishlist,
  subscription: Subscription,
  locale: Locale,
  origin: string,
): SubscribedListSummaryView {
  const locked = !isSubscriptionUnlocked(wishlist, subscription);
  const mineIds = locked ? new Set<string>() : mineReservationIdsFor(doc, wishlist.id, subscription.userId, new Set());
  return {
    id: wishlist.id,
    readToken: wishlist.readToken,
    title: wishlist.title,
    subtitle: wishlist.subtitle,
    coverImageUrl: wishlist.coverImageUrl,
    theme: wishlist.theme,
    itemCount: locked ? 0 : listPublicVisibleItems(doc, wishlist.id, mineIds).length,
    readUrl: siteUrl(origin, locale, `/l/${wishlist.readToken}`),
    subscribedAt: subscription.createdAt,
    locked,
  };
}

export function toMemberItem(item: Item, locale: Locale): MemberItemView {
  return { ...itemBase(item, locale), archived: item.archived, sortOrder: item.sortOrder };
}

export function toMemberListView(
  doc: Database,
  wishlist: Wishlist,
  role: Role,
  locale: Locale,
  origin: string,
): MemberListView {
  const items = sortItems(doc.items.filter((item) => item.wishlistId === wishlist.id));
  const itemName = new Map(items.map((item) => [item.id, item.name]));
  return {
    id: wishlist.id,
    title: wishlist.title,
    subtitle: wishlist.subtitle,
    coverImageUrl: wishlist.coverImageUrl,
    theme: wishlist.theme,
    role,
    readUrl: siteUrl(origin, locale, `/l/${wishlist.readToken}`),
    inviteUrl: siteUrl(origin, locale, `/inviter/${wishlist.inviteToken}`),
    hasReadPassword: hasReadPassword(wishlist),
    categories: categoriesOf(doc, wishlist.id),
    people: peopleOf(doc, wishlist.id),
    items: items.map((item) => toMemberItem(item, locale)),
    reservations: doc.reservations
      .filter((reservation) => reservation.wishlistId === wishlist.id)
      .map((reservation) => ({
        id: reservation.id,
        itemId: reservation.itemId,
        itemName: itemName.get(reservation.itemId) ?? "",
        fromName: reservation.fromName,
        note: reservation.note,
        createdAt: reservation.createdAt,
      })),
    members: doc.memberships
      .filter((membership) => membership.wishlistId === wishlist.id)
      .map((membership) => ({
        userId: membership.userId,
        displayName: doc.users.find((entry) => entry.id === membership.userId)?.displayName ?? "",
        role: membership.role,
      })),
  };
}
