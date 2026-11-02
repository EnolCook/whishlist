import { api, ok, type Schemas } from "@/api/client";
import { newClientId } from "@/offline/ids";
import type { ChangePayloads } from "@/offline/outbox";

import { parsePrice } from "../../../src/domain/price";
import { write, type WriteResult } from "./write";

export type ItemInput = ChangePayloads["updateItem"];

/** Ce que le téléphone vérifie avant l'envoi : de quoi construire une requête valide (data-model.md). */
function localError(input: ItemInput): string | null {
  if (!input.name.trim()) return "itemNeedsName";
  if (parsePrice(input.price ?? "") === "invalid") return "priceInvalid";
  return null;
}

/**
 * Ajoute ou modifie une idée, en passant par la file de changements.
 * Création : sans `itemId`, ou `create` pour corriger une création refusée (même identifiant).
 * Le prix part tel que saisi (« 24,90 ») : le serveur le lit avec la même règle que le site.
 */
export async function saveItem(
  listId: string,
  input: ItemInput,
  options: { itemId?: string; create?: boolean; retrySeq?: number | null } = {},
): Promise<WriteResult & { itemId: string }> {
  const itemId = options.itemId ?? newClientId();
  const error = localError(input);
  if (error) return { ok: false, error, seq: options.retrySeq ?? null, itemId };
  const create = options.create ?? options.itemId === undefined;
  const result = create
    ? await write({ kind: "createItem", listId, targetId: itemId, payload: { ...input, id: itemId } }, options.retrySeq)
    : await write({ kind: "updateItem", listId, targetId: itemId, payload: input }, options.retrySeq);
  return { ...result, itemId };
}

/** Archiver / désarchiver, ou changer de catégorie. */
export function patchItem(listId: string, itemId: string, payload: ChangePayloads["patchItem"]): Promise<WriteResult> {
  return write({ kind: "patchItem", listId, targetId: itemId, payload });
}

/** Supprimer une idée (après confirmation, FR-013). */
export function deleteItem(listId: string, itemId: string): Promise<WriteResult> {
  return write({ kind: "deleteItem", listId, targetId: itemId, payload: {} });
}

export type Enriched = { name: string; price: string; imageUrl: string; typeId: string; description: string; usedLlm: boolean };

/**
 * Préremplissage depuis un lien produit : ne crée rien, exige le réseau (FR-029b).
 * Le serveur lit toujours la page ; `capabilities.enrich` dit s'il s'aide en plus d'une IA.
 */
export async function enrich(listId: string, url: string): Promise<Enriched> {
  const { name, price, imageUrl, typeId, description, usedLlm } = await ok(
    api.POST("/lists/{listId}/enrich", { params: { path: { listId } }, body: { url } }),
  );
  // Un serveur antérieur à 1.5.0 n'en renvoie pas.
  return { name, price, imageUrl, typeId, description: description ?? "", usedLlm };
}

export type MemberItem = Schemas["MemberItem"];
