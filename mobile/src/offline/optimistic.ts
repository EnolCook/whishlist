import type { Schemas } from "@/api/client";

import { formatPrice, parsePrice } from "../../../src/domain/price";
import type { Change, ChangePayloads } from "./outbox";

/** État d'envoi d'un objet affiché : en attente, ou refusé avec la raison du serveur. */
export type Sync = { pending: boolean; rejected: { seq: number; errorCode: string; kind: Change["kind"] } | null };

export type ViewItem = Schemas["MemberItem"] & Sync;
export type ViewList = Omit<Schemas["MemberList"], "items"> & Sync & {
  items: ViewItem[];
  /** Pas encore sur le serveur (création hors ligne) : pas de lien public. */
  localOnly: boolean;
};
export type ViewListSummary = Schemas["ListSummary"] & Sync & { localOnly: boolean };

const synced: Sync = { pending: false, rejected: null };

function syncOf(change: Change): Sync {
  return change.state === "rejected"
    ? { pending: false, rejected: { seq: change.seq, errorCode: change.errorCode ?? "serverError", kind: change.kind } }
    : { pending: true, rejected: null };
}

/** Prix affiché d'une idée pas encore envoyée : même règle et même format que le serveur. */
function priceFields(input: ChangePayloads["updateItem"], intlLocale: string) {
  const cents = parsePrice(input.price ?? "");
  const priceCents = cents === "invalid" ? null : cents;
  return { priceCents, priceLabel: formatPrice(priceCents, intlLocale) };
}

function itemFields(input: ChangePayloads["updateItem"], intlLocale: string) {
  return {
    name: input.name.trim(),
    typeId: input.typeId,
    personId: input.personId,
    url: input.url?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    priority: input.priority?.trim() || null,
    ...priceFields(input, intlLocale),
  };
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

type Transfer = Extract<Change, { kind: "moveItem" | "copyItem" }>;

/**
 * Déplacement ou copie vus depuis `listId` : l'idée quitte la liste de départ (un refus la laisse, avec l'alerte)
 * et arrive dans la liste d'arrivée, d'après l'aperçu gardé dans le changement. Une copie dans la même liste
 * s'affiche juste après l'original.
 */
function applyTransfer(items: ViewItem[], change: Transfer, listId: string): ViewItem[] {
  const { targetListId, typeId, personId, preview } = change.payload;
  const rejected = change.state === "rejected";
  const lastOrder = items.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);
  if (change.kind === "moveItem") {
    if (targetListId === change.listId) return items;
    if (change.listId === listId) {
      return rejected
        ? items.map((item) => (item.id === change.targetId ? { ...item, ...syncOf(change) } : item))
        : items.filter((item) => item.id !== change.targetId);
    }
    if (targetListId !== listId || rejected || items.some((item) => item.id === change.targetId)) return items;
    return [...items, { ...preview, typeId, personId, archived: false, sortOrder: lastOrder, ...syncOf(change) }];
  }
  if (targetListId !== listId || items.some((item) => item.id === change.payload.id)) return items;
  const sortOrder = change.listId === listId ? preview.sortOrder + 0.5 : lastOrder;
  return [...items, { ...preview, id: change.payload.id, typeId, personId, archived: false, sortOrder, ...syncOf(change) }];
}

/** Liste créée sur le téléphone et pas encore acceptée : ce que l'on sait d'elle. */
function localList(change: Extract<Change, { kind: "createList" }>): ViewList {
  const { payload } = change;
  return {
    id: payload.id,
    title: payload.title.trim(),
    subtitle: null,
    coverImageUrl: null,
    theme: {},
    role: "owner",
    readUrl: "",
    inviteUrl: "",
    hasReadPassword: false,
    categories: [{ id: payload.categoryId, label: payload.category.trim(), sortOrder: 0 }],
    people: [{ id: payload.personId, label: payload.person.trim() }],
    items: [],
    reservations: [],
    members: [],
    localOnly: true,
    ...syncOf(change),
  };
}

/**
 * Vue d'une liste = copie du serveur + changements de la file appliqués dans l'ordre
 * (data-model.md, « Vue optimiste »). Rend null si la liste n'existe ni d'un côté ni de l'autre.
 */
export function viewList(
  snapshot: Schemas["MemberList"] | null,
  listId: string,
  changes: Change[],
  intlLocale: string,
): ViewList | null {
  const creation = changes.find((change) => change.kind === "createList" && change.targetId === listId);
  let list: ViewList | null = snapshot
    ? { ...snapshot, items: snapshot.items.map((item) => ({ ...item, ...synced })), localOnly: false, ...synced }
    : creation?.kind === "createList"
      ? localList(creation)
      : null;
  if (!list) return null;

  for (const change of changes) {
    if (change.kind === "moveItem" || change.kind === "copyItem") {
      list = { ...list, items: applyTransfer(list.items, change, listId) };
      continue;
    }
    if (change.listId !== listId || change.kind === "createList") continue;
    const items: ViewItem[] = list.items;
    const index = items.findIndex((item) => item.id === change.targetId);
    const current = index >= 0 ? items[index] : undefined;
    let next: ViewItem[] = items;
    switch (change.kind) {
      case "createItem": {
        if (current) break;
        const sortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);
        next = [
          ...items,
          { id: change.payload.id, archived: false, sortOrder, ...itemFields(change.payload, intlLocale), ...syncOf(change) },
        ];
        break;
      }
      case "updateItem":
        if (current) next = replaceAt(items, index, { ...current, ...itemFields(change.payload, intlLocale), ...syncOf(change) });
        break;
      case "patchItem":
        if (current) next = replaceAt(items, index, { ...current, ...change.payload, ...syncOf(change) });
        break;
      case "deleteItem":
        // Une suppression refusée laisse l'idée visible, avec l'alerte.
        next =
          change.state === "rejected"
            ? items.map((item) => (item.id === change.targetId ? { ...item, ...syncOf(change) } : item))
            : items.filter((item) => item.id !== change.targetId);
        break;
    }
    list = { ...list, items: next };
  }
  return list;
}

/** « Mes listes » = copie du serveur + listes créées sur le téléphone. */
export function viewLists(snapshot: Schemas["ListSummary"][] | null, changes: Change[]): ViewListSummary[] {
  const lists: ViewListSummary[] = (snapshot ?? []).map((list) => ({ ...list, localOnly: false, ...synced }));
  for (const change of changes) {
    if (change.kind !== "createList" || lists.some((list) => list.id === change.targetId)) continue;
    const created = localList(change);
    lists.push({
      id: created.id,
      title: created.title,
      subtitle: null,
      coverImageUrl: null,
      theme: {},
      role: "owner",
      itemCount: changes.filter((other) => other.kind === "createItem" && other.listId === created.id).length,
      readUrl: "",
      localOnly: true,
      ...syncOf(change),
    });
  }
  return lists;
}
