import { findMembership } from "../../domain/access";
import { idTaken, isClientId } from "../../domain/client-ids";
import { fetchPageHtml } from "../../domain/fetch-page";
import {
  cancelReservation,
  createItem,
  deleteItem as deleteItemRule,
  setItemArchived as setItemArchivedRule,
  setItemType as setItemTypeRule,
  updateItem,
} from "../../domain/items";
import { estimateLlmImpact, type LlmImpact } from "../../domain/llm-impact";
import { fetchOgImage } from "../../domain/og-image";
import { parsePrice } from "../../domain/price";
import { extractProductHints } from "../../domain/product-from-url";
import { llmConfigured, refineProductWithLlm } from "../../domain/product-llm";
import type { Database, Item } from "../../domain/types";
import { readDocument, updateDocument } from "../../store/db";
import { rateLimitForIp } from "../rate-limit";
import { activeUser, type CommandContext, type CommandResult } from "./context";

function blankUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Image de l'idée : saisie, inchangée, ou cherchée sur la page du lien (appel réseau limité par `beforeFetch`). */
async function resolveImageUrl(input: {
  url: string | null;
  manual: string | null;
  previousUrl: string | null;
  previousImage: string | null;
  beforeFetch: () => void;
}): Promise<string | null> {
  if (input.manual) return input.manual;
  if (!input.url) return null;
  if (input.url === input.previousUrl && input.previousImage) return input.previousImage;
  input.beforeFetch();
  return (await fetchOgImage(input.url)) ?? (input.url === input.previousUrl ? input.previousImage : null);
}

function itemIn(doc: Database, wishlistId: string, itemId: string): Item | undefined {
  return doc.items.find((item) => item.id === itemId && item.wishlistId === wishlistId);
}

type Rule = (doc: Database, actorId: string) => { ok: true; doc: Database } | { ok: false; error: string };

/** Applique des règles de membre dans une seule écriture et rend l'idée telle qu'enregistrée. */
async function writeItem(
  actorId: string,
  wishlistId: string,
  rule: (doc: Database, actorId: string) => { ok: true; doc: Database; itemId: string } | { ok: false; error: string },
): Promise<CommandResult<{ item: Item }>> {
  return updateDocument<CommandResult<{ item: Item }>>((doc) => {
    const saved = rule(doc, actorId);
    if (!saved.ok) return { doc, result: saved };
    const item = itemIn(saved.doc, wishlistId, saved.itemId);
    if (!item) return { doc, result: { ok: false, error: "itemMissing" } };
    return { doc: saved.doc, result: { ok: true, item } };
  });
}

/** Enchaîne des règles sur une idée existante ; la première qui refuse annule tout. */
async function mutateItem(
  ctx: CommandContext,
  wishlistId: string,
  itemId: string,
  rules: Rule[],
): Promise<CommandResult<{ item: Item }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  return writeItem(active.user.id, wishlistId, (doc, actorId) => {
    let current = doc;
    for (const rule of rules) {
      const saved = rule(current, actorId);
      if (!saved.ok) return saved;
      current = saved.doc;
    }
    return { ok: true, doc: current, itemId };
  });
}

export type ItemFields = {
  wishlistId: string;
  itemId?: string;
  /** Création : identifiant choisi par le client ; un renvoi rend l'idée existante. */
  clientId?: string;
  name: string;
  typeId: string;
  personId: string;
  url: string;
  imageUrl: string;
  /** Prix tel que saisi (« 18,50 »). */
  price: string;
  priority: string;
  /** Absent : faux à la création, inchangé en modification. */
  secondHandOk?: boolean;
};

export async function saveItem(
  ctx: CommandContext,
  input: ItemFields,
): Promise<CommandResult<{ item: Item; replayed: boolean }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  const actorId = active.user.id;
  const clientId = input.itemId ? undefined : input.clientId;
  if (clientId !== undefined && !isClientId(clientId)) return { ok: false, error: "idInvalid" };
  const price = parsePrice(input.price);
  if (price === "invalid") return { ok: false, error: "priceInvalid" };
  const doc = await readDocument();
  if (!findMembership(doc, input.wishlistId, actorId)) return { ok: false, error: "notMember" };
  // Renvoi d'une création déjà reçue : rien à recalculer (ni image à chercher).
  const sent = clientId ? replayedItem(doc, input.wishlistId, clientId) : null;
  if (sent) return sent;
  const current = input.itemId ? itemIn(doc, input.wishlistId, input.itemId) : null;
  const url = blankUrl(input.url);
  const imageUrl = await resolveImageUrl({
    url,
    manual: blankUrl(input.imageUrl),
    previousUrl: current?.url ?? null,
    previousImage: current?.imageUrl ?? null,
    beforeFetch: () => rateLimitForIp(`item-image:${actorId}`, ctx.ip, 60, 60 * 60 * 1000),
  });
  const fields = {
    wishlistId: input.wishlistId,
    actorId,
    name: input.name,
    typeId: input.typeId,
    personId: input.personId,
    url,
    imageUrl,
    priceCents: price,
    priority: input.priority,
    secondHandOk: input.secondHandOk,
  };
  const itemId = input.itemId;
  let replayed = false;
  const saved = await writeItem(actorId, input.wishlistId, (latest) => {
    if (itemId) {
      const updated = updateItem(latest, { ...fields, itemId });
      return updated.ok ? { ...updated, itemId } : updated;
    }
    // Vérifié de nouveau dans l'écriture : deux envois simultanés ne font qu'une idée.
    if (clientId) {
      const again = replayedItem(latest, input.wishlistId, clientId);
      if (again) {
        replayed = again.ok;
        return again.ok ? { ok: true, doc: latest, itemId: clientId } : again;
      }
    }
    const created = createItem(latest, { ...fields, id: clientId });
    return created.ok ? { ok: true, doc: created.doc, itemId: created.item.id } : created;
  });
  return saved.ok ? { ...saved, replayed } : saved;
}

/** Idée déjà créée avec cet identifiant : la même liste → renvoi ; ailleurs → conflit ; sinon null. */
function replayedItem(
  doc: Database,
  wishlistId: string,
  clientId: string,
): { ok: true; item: Item; replayed: true } | { ok: false; error: string } | null {
  if (!idTaken(doc, clientId)) return null;
  const item = itemIn(doc, wishlistId, clientId);
  return item ? { ok: true, item, replayed: true } : { ok: false, error: "idConflict" };
}

export function setItemType(ctx: CommandContext, input: { wishlistId: string; itemId: string; typeId: string }) {
  return patchItem(ctx, input);
}

export function setItemArchived(
  ctx: CommandContext,
  input: { wishlistId: string; itemId: string; archived: boolean },
) {
  return patchItem(ctx, input);
}

/** Catégorie et/ou archivage en une seule écriture : un refus ne laisse rien d'enregistré. */
export function patchItem(
  ctx: CommandContext,
  input: { wishlistId: string; itemId: string; typeId?: string; archived?: boolean },
) {
  const { wishlistId, itemId, typeId, archived } = input;
  const rules: Rule[] = [];
  if (typeId !== undefined) rules.push((doc, actorId) => setItemTypeRule(doc, { wishlistId, itemId, typeId, actorId }));
  if (archived !== undefined) {
    rules.push((doc, actorId) => setItemArchivedRule(doc, { wishlistId, itemId, archived, actorId }));
  }
  return mutateItem(ctx, wishlistId, itemId, rules);
}

export async function deleteItem(
  ctx: CommandContext,
  input: { wishlistId: string; itemId: string },
): Promise<CommandResult> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  return updateDocument<CommandResult>((doc) => {
    const saved = deleteItemRule(doc, { ...input, actorId: active.user.id });
    return saved.ok ? { doc: saved.doc, result: { ok: true } } : { doc, result: saved };
  });
}

/** Annulation d'une réservation par un membre de la liste (principe III). */
export async function cancelReservationAsMember(
  ctx: CommandContext,
  input: { wishlistId: string; reservationId: string },
): Promise<CommandResult> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  return updateDocument<CommandResult>((doc) => {
    const saved = cancelReservation(doc, { ...input, actorId: active.user.id });
    return saved.ok ? { doc: saved.doc, result: { ok: true } } : { doc, result: saved };
  });
}

export async function enrichFromUrl(
  ctx: CommandContext,
  input: { wishlistId: string; url: string },
): Promise<
  CommandResult<{
    name: string;
    price: string;
    imageUrl: string;
    typeId: string;
    usedLlm: boolean;
    impact: LlmImpact | null;
  }>
> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  rateLimitForIp(`enrich:${active.user.id}`, ctx.ip, 30, 60 * 60 * 1000);
  const wishlistId = input.wishlistId.trim();
  const trimmed = input.url.trim();
  const doc = await readDocument();
  if (!findMembership(doc, wishlistId, active.user.id)) return { ok: false, error: "notMember" };
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { ok: false, error: "urlInvalid" };
  }
  const types = doc.types
    .filter((type) => type.wishlistId === wishlistId)
    .map((type) => ({ id: type.id, label: type.label }));
  const page = await fetchPageHtml(trimmed);
  if (!page) return { ok: false, error: "pageLoadFailed" };
  let hints = extractProductHints(page.html, page.finalUrl);
  const usedLlm = llmConfigured();
  let impact: LlmImpact | null = null;
  if (usedLlm) {
    const refined = await refineProductWithLlm(page.finalUrl, page.html, hints, types);
    hints = refined.hints;
    if (refined.usage.totalTokens > 0) {
      impact = estimateLlmImpact(refined.usage.totalTokens);
    }
  }
  if (!hints.name && !hints.price && !hints.imageUrl) {
    return { ok: false, error: usedLlm ? "enrichEmpty" : "enrichEmptyNoLlm" };
  }
  return {
    ok: true,
    name: hints.name ?? "",
    price: hints.price ?? "",
    imageUrl: hints.imageUrl ?? "",
    typeId: hints.typeId ?? "",
    usedLlm,
    impact,
  };
}
