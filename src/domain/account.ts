import { withLocale } from "../i18n/locale-path";
import type { Locale } from "../i18n/config";
import { clone } from "./access";
import { pendingEmailChange } from "./email-confirmation";
import { leaveWishlist, pickHeir, wipeWishlist } from "./membership";
import { followedListsOf } from "./subscription";
import type { Database, Role, WishlistTheme } from "./types";

export type AccountDeletionPreview = {
  /** Listes dont elle est la seule membre : effacées. */
  deletedLists: { id: string; title: string }[];
  /** Listes qui restent aux autres membres ; `newOwnerName` si elle en était propriétaire. */
  transferredLists: { id: string; title: string; newOwnerName: string | null }[];
  /** Ses réservations sur des listes qui restent : gardées, sans lien au compte. */
  reservationsKept: number;
  /** Listes publiques qu'elle suit sans en être membre : elle ne les suivra plus. */
  followedLists: { id: string; title: string }[];
};

function isAlone(doc: Database, wishlistId: string): boolean {
  return doc.memberships.filter((m) => m.wishlistId === wishlistId).length === 1;
}

export function previewAccountDeletion(doc: Database, userId: string): AccountDeletionPreview {
  const preview: AccountDeletionPreview = {
    deletedLists: [],
    transferredLists: [],
    reservationsKept: 0,
    followedLists: [],
  };
  const wiped = new Set<string>();
  for (const membership of doc.memberships.filter((m) => m.userId === userId)) {
    const wishlist = doc.wishlists.find((w) => w.id === membership.wishlistId);
    if (!wishlist) continue;
    if (isAlone(doc, wishlist.id)) {
      wiped.add(wishlist.id);
      preview.deletedLists.push({ id: wishlist.id, title: wishlist.title });
      continue;
    }
    const heir = membership.role === "owner" ? pickHeir(doc, wishlist.id, userId) : null;
    const heirName = heir ? (doc.users.find((u) => u.id === heir.userId)?.displayName ?? null) : null;
    preview.transferredLists.push({ id: wishlist.id, title: wishlist.title, newOwnerName: heirName });
  }
  preview.reservationsKept = doc.reservations.filter(
    (r) => r.userId === userId && !wiped.has(r.wishlistId),
  ).length;
  preview.followedLists = followedListsOf(doc, userId).map(({ wishlist }) => ({ id: wishlist.id, title: wishlist.title }));
  return preview;
}

/**
 * Supprime le compte, définitivement. Listes où elle est seule : effacées ; autres listes :
 * son adhésion part et le membre le plus ancien hérite si elle était propriétaire ;
 * ses réservations restent sans lien au compte ; ses connexions disparaissent.
 */
export function deleteAccount(
  doc: Database,
  input: { userId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  const { userId } = input;
  if (!doc.users.some((u) => u.id === userId)) return { ok: false, error: "accountMissing" };
  let next = clone(doc);
  for (const { wishlistId } of doc.memberships.filter((m) => m.userId === userId)) {
    if (isAlone(next, wishlistId)) {
      wipeWishlist(next, wishlistId);
      continue;
    }
    const left = leaveWishlist(next, { wishlistId, actorId: userId });
    if (!left.ok) return left;
    next = left.doc;
  }
  for (const reservation of next.reservations) {
    if (reservation.userId === userId) reservation.userId = null;
  }
  next.subscriptions = next.subscriptions.filter((s) => s.userId !== userId);
  next.apiSessions = next.apiSessions.filter((s) => s.userId !== userId);
  next.passwordResets = next.passwordResets.filter((r) => r.userId !== userId);
  next.emailConfirmations = next.emailConfirmations.filter((c) => c.userId !== userId);
  next.users = next.users.filter((u) => u.id !== userId);
  return { ok: true, doc: next };
}

export type ExportedList = {
  title: string;
  subtitle: string | null;
  createdAt: string;
  role: Role;
  joinedAt: string;
  theme: WishlistTheme;
  coverImageUrl: string | null;
  publicUrl: string;
  readPasswordProtected: boolean;
  members: { displayName: string; role: Role; joinedAt: string }[];
  categories: { label: string; sortOrder: number }[];
  people: { label: string }[];
  items: {
    name: string;
    category: string | null;
    person: string | null;
    priceCents: number | null;
    url: string | null;
    imageUrl: string | null;
    priority: string | null;
    secondHandOk: boolean;
    description: string | null;
    archived: boolean;
  }[];
  reservations: { item: string | null; fromName: string | null; note: string | null; createdAt: string; byMe: boolean }[];
};

export type ExportedSubscription = {
  title: string;
  subtitle: string | null;
  publicUrl: string;
  subscribedAt: string;
};

export type AccountExport = {
  format: "ohyoushouldnt-export";
  version: 1;
  exportedAt: string;
  account: {
    email: string;
    displayName: string;
    createdAt: string;
    emailVerifiedAt: string | null;
    pendingEmail: string | null;
  };
  lists: ExportedList[];
  subscriptions: ExportedSubscription[];
  myReservations: {
    listTitle: string;
    item: string | null;
    fromName: string | null;
    note: string | null;
    createdAt: string;
  }[];
};

/**
 * Données du compte, champ par champ (liste blanche) : un champ ajouté plus tard au store
 * ne part pas sans être nommé ici. Ni secret, ni e-mail ou identifiant d'un autre compte.
 */
export function exportAccount(
  doc: Database,
  userId: string,
  site: { origin: string; locale: Locale },
  now = new Date(),
): AccountExport | null {
  const user = doc.users.find((u) => u.id === userId);
  if (!user) return null;
  const itemName = new Map(doc.items.map((item) => [item.id, item.name]));
  const memberOf = new Set<string>();

  const lists: ExportedList[] = [];
  for (const membership of doc.memberships.filter((m) => m.userId === userId)) {
    const wishlist = doc.wishlists.find((w) => w.id === membership.wishlistId);
    if (!wishlist) continue;
    memberOf.add(wishlist.id);
    const typeLabel = new Map(doc.types.filter((t) => t.wishlistId === wishlist.id).map((t) => [t.id, t.label]));
    const personLabel = new Map(doc.people.filter((p) => p.wishlistId === wishlist.id).map((p) => [p.id, p.label]));
    lists.push({
      title: wishlist.title,
      subtitle: wishlist.subtitle,
      createdAt: wishlist.createdAt,
      role: membership.role,
      joinedAt: membership.joinedAt,
      theme: {
        primary: wishlist.theme.primary,
        accent: wishlist.theme.accent,
        highlight: wishlist.theme.highlight,
        background: wishlist.theme.background,
      },
      coverImageUrl: wishlist.coverImageUrl,
      publicUrl: `${site.origin}${withLocale(site.locale, `/l/${wishlist.readToken}`)}`,
      readPasswordProtected: wishlist.readPasswordHash !== null,
      members: doc.memberships
        .filter((m) => m.wishlistId === wishlist.id)
        .map((m) => ({
          displayName: doc.users.find((u) => u.id === m.userId)?.displayName ?? "",
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      categories: doc.types
        .filter((t) => t.wishlistId === wishlist.id)
        .map((t) => ({ label: t.label, sortOrder: t.sortOrder })),
      people: doc.people.filter((p) => p.wishlistId === wishlist.id).map((p) => ({ label: p.label })),
      items: doc.items
        .filter((item) => item.wishlistId === wishlist.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          name: item.name,
          category: typeLabel.get(item.typeId) ?? null,
          person: personLabel.get(item.personId) ?? null,
          priceCents: item.priceCents,
          url: item.url,
          imageUrl: item.imageUrl,
          priority: item.priority,
          secondHandOk: item.secondHandOk,
          description: item.description,
          archived: item.archived,
        })),
      reservations: doc.reservations
        .filter((r) => r.wishlistId === wishlist.id)
        .map((r) => ({
          item: itemName.get(r.itemId) ?? null,
          fromName: r.fromName,
          note: r.note,
          createdAt: r.createdAt,
          byMe: r.userId === userId,
        })),
    });
  }

  const myReservations = doc.reservations
    .filter((r) => r.userId === userId && !memberOf.has(r.wishlistId))
    .map((r) => ({
      listTitle: doc.wishlists.find((w) => w.id === r.wishlistId)?.title ?? "",
      item: itemName.get(r.itemId) ?? null,
      fromName: r.fromName,
      note: r.note,
      createdAt: r.createdAt,
    }));

  const subscriptions: ExportedSubscription[] = followedListsOf(doc, userId).map(({ wishlist, subscription }) => ({
    title: wishlist.title,
    subtitle: wishlist.subtitle,
    publicUrl: `${site.origin}${withLocale(site.locale, `/l/${wishlist.readToken}`)}`,
    subscribedAt: subscription.createdAt,
  }));

  return {
    format: "ohyoushouldnt-export",
    version: 1,
    exportedAt: now.toISOString(),
    account: {
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
      pendingEmail: pendingEmailChange(doc, user.id, now),
    },
    lists,
    subscriptions,
    myReservations,
  };
}
