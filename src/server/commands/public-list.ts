import { canAccessPublicListWith } from "../../auth/public-list";
import { READ_UNLOCK_TTL_SEC, signReadUnlock } from "../../auth/read-unlock";
import { signReservationClaim } from "../../auth/reservation-claim";
import { sessionSecret } from "../../auth/session";
import { findMembership } from "../../domain/access";
import { cancelOwnReservation } from "../../domain/items";
import { findWishlistByReadToken, mineReservationIdsFor } from "../../domain/read";
import { hasReadPassword, verifyReadPassword } from "../../domain/read-password";
import { reserveItem } from "../../domain/reserve";
import { extractReadToken } from "../../domain/read-link";
import {
  findSubscription,
  subscribeWishlist,
  syncSubscriptionUnlock,
  unsubscribeWishlist,
} from "../../domain/subscription";
import type { Reservation, Wishlist } from "../../domain/types";
import { readDocument, updateDocument } from "../../store/db";
import {
  toPublicListView,
  toSubscribedListSummary,
  type PublicListView,
  type SubscribedListSummaryView,
} from "../api/views";
import { rateLimitForIp } from "../rate-limit";
import { activeUser, publicAccount, type CommandContext, type CommandResult } from "./context";

/** Le déverrouillage vient du cookie (site) ou de l'en-tête `X-Read-Unlock` (API). */
type IsUnlocked = (list: Wishlist) => boolean | Promise<boolean>;

export async function readPublicList(
  ctx: CommandContext,
  input: { readToken: string; isUnlocked: IsUnlocked; claimedIds: ReadonlySet<string> },
): Promise<CommandResult<{ list: PublicListView }> | { ok: false; error: "readPasswordRequired"; title: string }> {
  const doc = await readDocument();
  const wishlist = findWishlistByReadToken(doc, input.readToken);
  if (!wishlist) return { ok: false, error: "listMissing" };
  const account = publicAccount(ctx);
  if (!(await canAccessPublicListWith(doc, wishlist, account, input.isUnlocked))) {
    return { ok: false, error: "readPasswordRequired", title: wishlist.title };
  }
  const mineIds = mineReservationIdsFor(doc, wishlist.id, account?.id ?? null, input.claimedIds);
  return { ok: true, list: toPublicListView(doc, wishlist, ctx.locale, mineIds, account?.id ?? null) };
}

export async function unlockPublicList(
  ctx: CommandContext,
  input: { readToken: string; password: string },
): Promise<CommandResult<{ wishlist: Wishlist; unlockToken: string | null; expiresAt: string | null }>> {
  rateLimitForIp(`read-unlock:${input.readToken.slice(0, 12)}`, ctx.ip, 20, 15 * 60 * 1000);
  const doc = await readDocument();
  const wishlist = findWishlistByReadToken(doc, input.readToken);
  if (!wishlist) return { ok: false, error: "listMissing" };
  if (!(await verifyReadPassword(wishlist, input.password))) return { ok: false, error: "badPassword" };
  const account = publicAccount(ctx);
  const subscription = account ? findSubscription(doc, wishlist.id, account.id) : null;
  if (account && subscription && subscription.readPasswordHash !== wishlist.readPasswordHash) {
    // L'empreinte vérifiée est celle de `wishlist` : si le mot de passe change pendant la vérification,
    // l'abonnement ne mémorise pas la nouvelle empreinte.
    await updateDocument((current) => ({
      doc: syncSubscriptionUnlock(current, {
        wishlistId: wishlist.id,
        userId: account.id,
        verifiedHash: wishlist.readPasswordHash,
      }),
      result: undefined,
    }));
  }
  const secret = sessionSecret();
  if (!secret || !wishlist.readPasswordHash) return { ok: true, wishlist, unlockToken: null, expiresAt: null };
  const now = Date.now();
  return {
    ok: true,
    wishlist,
    unlockToken: signReadUnlock(wishlist, secret, now),
    expiresAt: new Date(now + READ_UNLOCK_TTL_SEC * 1000).toISOString(),
  };
}

export async function subscribeToList(
  ctx: CommandContext,
  input: {
    urlOrToken: string;
    password?: string;
    isUnlocked?: IsUnlocked;
  },
): Promise<
  | CommandResult<{ subscription: SubscribedListSummaryView; replayed: boolean }>
  | { ok: false; error: "readPasswordRequired"; title: string; readToken: string }
> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  rateLimitForIp(`subscribe:${active.user.id}`, ctx.ip, 30, 15 * 60 * 1000);

  const readToken = extractReadToken(input.urlOrToken);
  if (!readToken) return { ok: false, error: "subscriptionLinkInvalid" };

  const doc = await readDocument();
  const wishlist = findWishlistByReadToken(doc, readToken);
  if (!wishlist) return { ok: false, error: "listMissing" };
  if (findMembership(doc, wishlist.id, active.user.id)) {
    return { ok: false, error: "alreadyMember" };
  }

  if (hasReadPassword(wishlist)) {
    const alreadyUnlocked = input.isUnlocked
      ? await canAccessPublicListWith(doc, wishlist, active.user, input.isUnlocked)
      : false;
    if (!alreadyUnlocked) {
      if (!input.password) {
        return { ok: false, error: "readPasswordRequired", title: wishlist.title, readToken: wishlist.readToken };
      }
      rateLimitForIp(`read-unlock:${wishlist.readToken.slice(0, 12)}`, ctx.ip, 20, 15 * 60 * 1000);
      if (!(await verifyReadPassword(wishlist, input.password))) {
        return { ok: false, error: "badPassword" };
      }
    }
  }

  type Saved =
    | { ok: true; subscription: SubscribedListSummaryView; replayed: boolean }
    | { ok: false; error: string };
  const saved = await updateDocument<Saved>((current) => {
    // L'accès a été vérifié contre `wishlist.readPasswordHash` : le domaine refuse si elle a changé depuis.
    const result = subscribeWishlist(current, {
      wishlistId: wishlist.id,
      userId: active.user.id,
      verifiedHash: wishlist.readPasswordHash,
    });
    if (!result.ok) return { doc: current, result };
    const freshList = result.doc.wishlists.find((entry) => entry.id === wishlist.id)!;
    return {
      doc: result.doc,
      result: {
        ok: true,
        replayed: result.replayed,
        subscription: toSubscribedListSummary(result.doc, freshList, result.subscription, ctx.locale, ctx.origin),
      },
    };
  });
  if (!saved.ok) {
    if (saved.error === "readPasswordChanged") {
      return { ok: false, error: "readPasswordRequired", title: wishlist.title, readToken: wishlist.readToken };
    }
    return saved;
  }
  return saved;
}

export async function unsubscribeFromList(
  ctx: CommandContext,
  input: { readToken: string },
): Promise<CommandResult<{ wishlist: Wishlist }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  const doc = await readDocument();
  const wishlist = findWishlistByReadToken(doc, input.readToken);
  if (!wishlist) return { ok: false, error: "listMissing" };
  const result = await updateDocument<CommandResult>((current) => {
    const saved = unsubscribeWishlist(current, { wishlistId: wishlist.id, userId: active.user.id });
    return saved.ok ? { doc: saved.doc, result: { ok: true } } : { doc: current, result: saved };
  });
  if (!result.ok) return result;
  return { ok: true, wishlist };
}

export async function reserve(
  ctx: CommandContext,
  input: {
    readToken: string;
    itemId: string;
    typeId?: string;
    fromName?: string;
    note?: string;
    isUnlocked: IsUnlocked;
  },
): Promise<CommandResult<{ wishlist: Wishlist; reservation: Reservation; claim: string | null }>> {
  rateLimitForIp(`reserve:${input.readToken.slice(0, 12)}`, ctx.ip, 15, 60 * 60 * 1000);
  const account = publicAccount(ctx);
  const doc = await readDocument();
  const wishlist = findWishlistByReadToken(doc, input.readToken);
  if (!wishlist) return { ok: false, error: "listMissing" };
  if (!(await canAccessPublicListWith(doc, wishlist, account, input.isUnlocked))) {
    return { ok: false, error: "readPasswordRequired" };
  }
  type Reserved = { ok: true; reservation: Reservation } | { ok: false; error: string };
  const result = await updateDocument<Reserved>((current) => {
    const saved = reserveItem(current, {
      wishlistId: wishlist.id,
      itemId: input.itemId,
      typeId: input.typeId,
      fromName: input.fromName,
      note: input.note,
      userId: account?.id ?? null,
    });
    return { doc: saved.ok ? saved.doc : current, result: saved };
  });
  if (!result.ok) return result;
  const secret = sessionSecret();
  const claim = secret ? signReservationClaim(input.readToken, result.reservation.id, secret) : null;
  return { ok: true, wishlist, reservation: result.reservation, claim };
}

export async function cancelOwn(
  ctx: CommandContext,
  input: { readToken: string; reservationId: string; claimedIds: ReadonlySet<string> },
): Promise<CommandResult<{ wishlist: Wishlist }>> {
  const doc = await readDocument();
  const wishlist = findWishlistByReadToken(doc, input.readToken);
  if (!wishlist) return { ok: false, error: "listMissing" };
  const result = await updateDocument((current) => {
    const saved = cancelOwnReservation(current, {
      wishlistId: wishlist.id,
      reservationId: input.reservationId,
      userId: publicAccount(ctx)?.id ?? null,
      claimedIds: input.claimedIds,
    });
    return { doc: saved.ok ? saved.doc : current, result: saved };
  });
  if (!result.ok) return result;
  return { ok: true, wishlist };
}
