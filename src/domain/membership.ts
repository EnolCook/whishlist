import { clone, findMembership } from "./access";
import { parseThemeForm, resolveTheme, type WishlistTheme } from "./theme";
import { newToken } from "./tokens";
import type { Database, Membership, Wishlist } from "./types";

const SUBTITLE_MAX = 280;

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function validHttpUrl(url: string | null): boolean {
  if (url === null) return true;
  return url.startsWith("http://") || url.startsWith("https://");
}

export function updateWishlistSettings(
  doc: Database,
  input: {
    wishlistId: string;
    actorId: string;
    title?: string;
    subtitle?: string | null;
    coverImageUrl?: string | null;
    theme?: Partial<WishlistTheme> | null;
  },
): { ok: true; doc: Database; wishlist: Wishlist } | { ok: false; error: string } {
  const actor = findMembership(doc, input.wishlistId, input.actorId);
  if (!actor) return { ok: false, error: "notMember" };
  const wishlist = doc.wishlists.find((entry) => entry.id === input.wishlistId);
  if (!wishlist) return { ok: false, error: "listMissing" };

  const title =
    input.title !== undefined ? input.title.trim() : wishlist.title;
  if (!title) return { ok: false, error: "listNeedsTitle" };

  const subtitle =
    input.subtitle !== undefined ? blankToNull(input.subtitle) : wishlist.subtitle;
  if (subtitle && subtitle.length > SUBTITLE_MAX) {
    return { ok: false, error: "subtitleTooLong" };
  }

  const coverImageUrl =
    input.coverImageUrl !== undefined
      ? blankToNull(input.coverImageUrl)
      : wishlist.coverImageUrl;
  if (!validHttpUrl(coverImageUrl)) return { ok: false, error: "imageMustBeHttp" };

  let theme = resolveTheme(wishlist.theme);
  if (input.theme !== undefined && input.theme !== null) {
    const parsed = parseThemeForm(input.theme);
    if (!parsed.ok) return parsed;
    theme = parsed.theme;
  }

  const next = clone(doc);
  const target = next.wishlists.find((entry) => entry.id === input.wishlistId)!;
  target.title = title;
  target.subtitle = subtitle;
  target.coverImageUrl = coverImageUrl;
  target.theme = theme;
  return { ok: true, doc: next, wishlist: target };
}

/** Efface une liste et tout ce qui lui appartient (sur un document déjà cloné). */
export function wipeWishlist(doc: Database, wishlistId: string): void {
  doc.wishlists = doc.wishlists.filter((w) => w.id !== wishlistId);
  doc.memberships = doc.memberships.filter((m) => m.wishlistId !== wishlistId);
  doc.subscriptions = doc.subscriptions.filter((s) => s.wishlistId !== wishlistId);
  doc.types = doc.types.filter((t) => t.wishlistId !== wishlistId);
  doc.people = doc.people.filter((p) => p.wishlistId !== wishlistId);
  doc.views = doc.views.filter((v) => v.wishlistId !== wishlistId);
  doc.items = doc.items.filter((i) => i.wishlistId !== wishlistId);
  doc.reservations = doc.reservations.filter((r) => r.wishlistId !== wishlistId);
}

/** Liste du lien d'invitation, ou `undefined` (jeton vide, inconnu ou régénéré). */
export function findWishlistByInvite(doc: Database, token: string): Wishlist | undefined {
  return token ? doc.wishlists.find((w) => w.inviteToken === token) : undefined;
}

export function acceptInvite(
  doc: Database,
  input: { token: string; userId: string; now?: Date },
): { ok: true; doc: Database; wishlistId: string } | { ok: false; error: string } {
  const wishlist = findWishlistByInvite(doc, input.token);
  if (!wishlist) return { ok: false, error: "inviteLinkBroken" };
  if (!doc.users.some((u) => u.id === input.userId)) {
    return { ok: false, error: "loginToJoin" };
  }
  if (findMembership(doc, wishlist.id, input.userId)) {
    return { ok: true, doc, wishlistId: wishlist.id };
  }
  const next = clone(doc);
  next.subscriptions = next.subscriptions.filter(
    (s) => !(s.wishlistId === wishlist.id && s.userId === input.userId),
  );
  next.memberships.push({
    wishlistId: wishlist.id,
    userId: input.userId,
    role: "member",
    joinedAt: (input.now ?? new Date()).toISOString(),
  });
  return { ok: true, doc: next, wishlistId: wishlist.id };
}

export function regenerateInvite(
  doc: Database,
  input: { wishlistId: string; actorId: string },
): { ok: true; doc: Database; inviteToken: string } | { ok: false; error: string } {
  const actor = findMembership(doc, input.wishlistId, input.actorId);
  if (!actor || actor.role !== "owner") {
    return { ok: false, error: "ownerRegenerateInvite" };
  }
  const wishlist = doc.wishlists.find((w) => w.id === input.wishlistId);
  if (!wishlist) return { ok: false, error: "listMissing" };
  let inviteToken = newToken();
  while (inviteToken === wishlist.readToken) inviteToken = newToken();
  const next = clone(doc);
  const target = next.wishlists.find((w) => w.id === input.wishlistId)!;
  target.inviteToken = inviteToken;
  return { ok: true, doc: next, inviteToken };
}

export function removeMember(
  doc: Database,
  input: { wishlistId: string; actorId: string; userId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  const actor = findMembership(doc, input.wishlistId, input.actorId);
  if (!actor || actor.role !== "owner") {
    return { ok: false, error: "ownerRemoveMember" };
  }
  if (input.userId === input.actorId) {
    return { ok: false, error: "useLeaveInstead" };
  }
  const target = findMembership(doc, input.wishlistId, input.userId);
  if (!target) return { ok: false, error: "personNotMember" };
  if (target.role === "owner") {
    return { ok: false, error: "ownerCannotSelfRemove" };
  }
  const next = clone(doc);
  next.memberships = next.memberships.filter(
    (m) => !(m.wishlistId === input.wishlistId && m.userId === input.userId),
  );
  return { ok: true, doc: next };
}

/** Membre qui reprend la liste quand `leavingUserId` part : le plus ancien (`joinedAt`, puis `userId`). */
export function pickHeir(doc: Database, wishlistId: string, leavingUserId: string): Membership | null {
  const others = doc.memberships
    .filter((m) => m.wishlistId === wishlistId && m.userId !== leavingUserId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.userId.localeCompare(b.userId));
  return others[0] ?? null;
}

export function leaveWishlist(
  doc: Database,
  input: { wishlistId: string; actorId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  const actor = findMembership(doc, input.wishlistId, input.actorId);
  if (!actor) return { ok: false, error: "notMember" };
  const heir = pickHeir(doc, input.wishlistId, input.actorId);
  if (!heir) {
    return { ok: false, error: "aloneMustDelete" };
  }
  const next = clone(doc);
  if (actor.role === "owner") {
    findMembership(next, input.wishlistId, heir.userId)!.role = "owner";
  }
  next.memberships = next.memberships.filter(
    (m) => !(m.wishlistId === input.wishlistId && m.userId === input.actorId),
  );
  return { ok: true, doc: next };
}

export function deleteWishlist(
  doc: Database,
  input: { wishlistId: string; actorId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  const actor = findMembership(doc, input.wishlistId, input.actorId);
  if (!actor || actor.role !== "owner") {
    return { ok: false, error: "ownerDeleteList" };
  }
  const next = clone(doc);
  wipeWishlist(next, input.wishlistId);
  return { ok: true, doc: next };
}
