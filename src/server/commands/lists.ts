import { findMembership } from "../../domain/access";
import { idTaken, isClientId } from "../../domain/client-ids";
import { createWishlist } from "../../domain/import";
import { listDefaults, memberListTitles, numberedTitle } from "../../domain/list-defaults";
import { addPerson, addType, splitLabels } from "../../domain/items";
import { updateWishlistSettings } from "../../domain/membership";
import { followedListsOf } from "../../domain/subscription";
import type { WishlistTheme } from "../../domain/types";
import { readDocument, updateDocument } from "../../store/db";
import { getTranslationsFor } from "../../i18n/server";
import {
  toListSummary,
  toMemberListView,
  toSubscribedListSummary,
  type ListSummaryView,
  type MemberListView,
  type SubscribedListSummaryView,
} from "../api/views";
import { activeUser, verifiedUser, type CommandContext, type CommandResult } from "./context";

export async function listMine(
  ctx: CommandContext,
): Promise<CommandResult<{ lists: ListSummaryView[]; subscriptions: SubscribedListSummaryView[] }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  const doc = await readDocument();
  const lists = doc.memberships
    .filter((membership) => membership.userId === active.user.id)
    .flatMap((membership) => {
      const wishlist = doc.wishlists.find((entry) => entry.id === membership.wishlistId);
      return wishlist ? [toListSummary(doc, wishlist, membership.role, ctx.locale, ctx.origin)] : [];
    });
  const subscriptions = followedListsOf(doc, active.user.id).map(({ wishlist, subscription }) =>
    toSubscribedListSummary(doc, wishlist, subscription, ctx.locale, ctx.origin),
  );
  return { ok: true, lists, subscriptions };
}

export async function readMemberList(
  ctx: CommandContext,
  input: { wishlistId: string },
): Promise<CommandResult<{ list: MemberListView }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  return memberListView(ctx, input.wishlistId, active.user.id);
}

/** Vue membre relue après une écriture (création, réglages, invitation acceptée). */
export async function memberListView(
  ctx: CommandContext,
  wishlistId: string,
  userId: string,
): Promise<CommandResult<{ list: MemberListView }>> {
  const doc = await readDocument();
  const membership = findMembership(doc, wishlistId, userId);
  const wishlist = doc.wishlists.find((entry) => entry.id === wishlistId);
  if (!membership || !wishlist) return { ok: false, error: "notMember" };
  return { ok: true, list: toMemberListView(doc, wishlist, membership.role, ctx.locale, ctx.origin) };
}

/**
 * Une liste naît avec sa première catégorie et son premier « qui » ; un champ vide prend sa valeur par défaut.
 * Le client peut choisir leurs identifiants : un renvoi du même `id` par un membre
 * rend la liste existante (`replayed`) au lieu d'en créer une seconde.
 */
export async function createList(
  ctx: CommandContext,
  input: { title: string; category: string; person: string; id?: string; categoryId?: string; personId?: string },
): Promise<CommandResult<{ list: MemberListView; replayed: boolean }>> {
  const active = verifiedUser(ctx);
  if (!active.ok) return active;
  const ids = [input.id, input.categoryId, input.personId].filter((id) => id !== undefined);
  if (!ids.every(isClientId)) return { ok: false, error: "idInvalid" };
  const actorId = active.user.id;
  // Champs non bloquants : laissés vides, ils prennent des valeurs par défaut, dans la langue de la
  // requête (langue de l'URL sur le site, `Accept-Language` pour l'API).
  // Une saisie à virgules en crée plusieurs ; le nom du compte, valeur par défaut, n'est jamais découpé.
  const defaults = listDefaults(active.user.displayName, await getTranslationsFor(ctx.locale, "home"));
  const typed = { categories: splitLabels(input.category), persons: splitLabels(input.person) };
  const categories = typed.categories.length > 0 ? typed.categories : [defaults.category];
  const persons = typed.persons.length > 0 ? typed.persons : [defaults.person];
  // Renvoi reconnu dans la même écriture que la création : deux envois simultanés ne font qu'une liste.
  const created = await updateDocument<CommandResult<{ wishlistId: string; replayed: boolean }>>((doc) => {
    const { id } = input;
    if (id && doc.wishlists.some((list) => list.id === id)) {
      const replayed = findMembership(doc, id, actorId) !== null;
      return { doc, result: replayed ? { ok: true, wishlistId: id, replayed } : { ok: false, error: "idConflict" } };
    }
    if (ids.some((taken) => idTaken(doc, taken))) return { doc, result: { ok: false, error: "idConflict" } };
    const title =
      input.title.trim() ||
      numberedTitle(defaults.titleBase, memberListTitles(doc.memberships, doc.wishlists, actorId));
    const list = createWishlist(doc, { ownerId: actorId, title, importTemplate: false, id });
    if (!list.ok) return { doc, result: list };
    const wishlistId = list.wishlist.id;
    // « Wilh, Nathan » crée deux « qui », comme dans les réglages. L'identifiant choisi par le
    // client ne vaut que pour le premier : il n'en a envoyé qu'un.
    let current = list.doc;
    for (const [index, label] of categories.entries()) {
      const saved = addType(current, { wishlistId, actorId, label, id: index === 0 ? input.categoryId : undefined });
      if (!saved.ok) return { doc, result: saved };
      current = saved.doc;
    }
    for (const [index, label] of persons.entries()) {
      const saved = addPerson(current, { wishlistId, actorId, label, id: index === 0 ? input.personId : undefined });
      if (!saved.ok) return { doc, result: saved };
      current = saved.doc;
    }
    return { doc: current, result: { ok: true, wishlistId, replayed: false } };
  });
  if (!created.ok) return created;
  const view = await memberListView(ctx, created.wishlistId, actorId);
  return view.ok ? { ...view, replayed: created.replayed } : view;
}

/** Réglages de la liste ; un champ absent reste tel quel. */
export async function updateSettings(
  ctx: CommandContext,
  input: {
    wishlistId: string;
    title?: string;
    subtitle?: string | null;
    coverImageUrl?: string | null;
    theme?: Partial<WishlistTheme> | null;
  },
): Promise<CommandResult<{ list: MemberListView }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  const saved = await updateDocument<CommandResult>((doc) => {
    const result = updateWishlistSettings(doc, { ...input, actorId: active.user.id });
    return result.ok ? { doc: result.doc, result: { ok: true } } : { doc, result };
  });
  if (!saved.ok) return saved;
  return memberListView(ctx, input.wishlistId, active.user.id);
}
