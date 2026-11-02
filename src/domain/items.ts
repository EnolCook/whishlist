import { clone, findMembership } from "./access";
import { normalizePriority } from "./priority";
import { newId } from "./tokens";
import type { Database, Item } from "./types";

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function validUrl(url: string | null): boolean {
  if (url === null) return true;
  return url.startsWith("http://") || url.startsWith("https://");
}

export function createItem(
  doc: Database,
  input: {
    wishlistId: string;
    actorId: string;
    name: string;
    typeId: string;
    personId: string;
    url?: string | null;
    imageUrl?: string | null;
    priceCents?: number | null;
    priority?: string | null;
    id?: string;
  },
): { ok: true; doc: Database; item: Item } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "itemNeedsName" };
  if (!doc.types.some((t) => t.id === input.typeId && t.wishlistId === input.wishlistId)) {
    return { ok: false, error: "typeNotInList" };
  }
  if (!doc.people.some((p) => p.id === input.personId && p.wishlistId === input.wishlistId)) {
    return { ok: false, error: "personNotInList" };
  }
  const url = blankToNull(input.url);
  const imageUrl = blankToNull(input.imageUrl);
  if (!validUrl(url)) return { ok: false, error: "urlMustBeHttp" };
  if (!validUrl(imageUrl)) return { ok: false, error: "imageMustBeHttp" };
  if (input.priceCents !== undefined && input.priceCents !== null && input.priceCents < 0) {
    return { ok: false, error: "priceNegative" };
  }
  const priority = normalizePriority(input.priority);
  if (!priority.ok) return priority;
  const sortOrder =
    doc.items.filter((i) => i.wishlistId === input.wishlistId).reduce((max, i) => Math.max(max, i.sortOrder), 0) +
    1;
  const item: Item = {
    id: input.id ?? newId(),
    wishlistId: input.wishlistId,
    name,
    typeId: input.typeId,
    personId: input.personId,
    url,
    imageUrl,
    priceCents: input.priceCents ?? null,
    priority: priority.value,
    sortOrder,
    archived: false,
  };
  const next = clone(doc);
  next.items.push(item);
  return { ok: true, doc: next, item };
}

export function updateItem(
  doc: Database,
  input: {
    wishlistId: string;
    actorId: string;
    itemId: string;
    name: string;
    typeId: string;
    personId: string;
    url?: string | null;
    imageUrl?: string | null;
    priceCents?: number | null;
    priority?: string | null;
  },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "itemNeedsName" };
  if (!doc.types.some((t) => t.id === input.typeId && t.wishlistId === input.wishlistId)) {
    return { ok: false, error: "typeNotInList" };
  }
  if (!doc.people.some((p) => p.id === input.personId && p.wishlistId === input.wishlistId)) {
    return { ok: false, error: "personNotInList" };
  }
  const url = blankToNull(input.url);
  const imageUrl = blankToNull(input.imageUrl);
  if (!validUrl(url)) return { ok: false, error: "urlMustBeHttp" };
  if (!validUrl(imageUrl)) return { ok: false, error: "imageMustBeHttp" };
  if (input.priceCents !== undefined && input.priceCents !== null && input.priceCents < 0) {
    return { ok: false, error: "priceNegative" };
  }
  const priority = normalizePriority(input.priority);
  if (!priority.ok) return priority;
  const next = clone(doc);
  const item = next.items.find((i) => i.id === input.itemId && i.wishlistId === input.wishlistId);
  if (!item) return { ok: false, error: "itemMissing" };
  item.name = name;
  item.typeId = input.typeId;
  item.personId = input.personId;
  item.url = url;
  item.imageUrl = imageUrl;
  item.priceCents = input.priceCents ?? null;
  item.priority = priority.value;
  return { ok: true, doc: next };
}

export function setItemType(
  doc: Database,
  input: { wishlistId: string; actorId: string; itemId: string; typeId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  if (!doc.types.some((t) => t.id === input.typeId && t.wishlistId === input.wishlistId)) {
    return { ok: false, error: "typeNotInList" };
  }
  const next = clone(doc);
  const item = next.items.find((i) => i.id === input.itemId && i.wishlistId === input.wishlistId);
  if (!item) return { ok: false, error: "itemMissing" };
  item.typeId = input.typeId;
  return { ok: true, doc: next };
}

export function setItemArchived(
  doc: Database,
  input: { wishlistId: string; actorId: string; itemId: string; archived: boolean },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const next = clone(doc);
  const item = next.items.find((i) => i.id === input.itemId && i.wishlistId === input.wishlistId);
  if (!item) return { ok: false, error: "itemMissing" };
  item.archived = input.archived;
  return { ok: true, doc: next };
}

type TransferInput = {
  wishlistId: string;
  actorId: string;
  itemId: string;
  /** Liste d'arrivée (peut être la même pour une copie). */
  targetWishlistId: string;
  /** Catégorie et « pour qui » de la liste d'arrivée. */
  typeId: string;
  personId: string;
};

/** Droits sur les deux listes, idée de départ, catégorie et « pour qui » pris dans la liste d'arrivée. */
function checkTransfer(doc: Database, input: TransferInput): { ok: true; item: Item } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) return { ok: false, error: "notMember" };
  if (!findMembership(doc, input.targetWishlistId, input.actorId)) return { ok: false, error: "notMember" };
  const item = doc.items.find((i) => i.id === input.itemId && i.wishlistId === input.wishlistId);
  if (!item) return { ok: false, error: "itemMissing" };
  if (!doc.types.some((t) => t.id === input.typeId && t.wishlistId === input.targetWishlistId)) {
    return { ok: false, error: "typeNotInList" };
  }
  if (!doc.people.some((p) => p.id === input.personId && p.wishlistId === input.targetWishlistId)) {
    return { ok: false, error: "personNotInList" };
  }
  return { ok: true, item };
}

function lastSortOrder(doc: Database, wishlistId: string): number {
  return doc.items.filter((i) => i.wishlistId === wishlistId).reduce((max, i) => Math.max(max, i.sortOrder), 0);
}

/**
 * Change l'idée de liste (elle garde son identifiant). Refusé si elle est réservée : la personne qui a
 * réservé ne peut annuler que depuis le lien de la liste d'origine, elle perdrait sa réservation.
 */
export function moveItem(doc: Database, input: TransferInput): { ok: true; doc: Database } | { ok: false; error: string } {
  const checked = checkTransfer(doc, input);
  if (!checked.ok) return checked;
  if (doc.reservations.some((r) => r.itemId === input.itemId)) return { ok: false, error: "itemReservedCannotMove" };
  const next = clone(doc);
  const item = next.items.find((i) => i.id === input.itemId)!;
  if (input.targetWishlistId !== input.wishlistId) item.sortOrder = lastSortOrder(next, input.targetWishlistId) + 1;
  item.wishlistId = input.targetWishlistId;
  item.typeId = input.typeId;
  item.personId = input.personId;
  return { ok: true, doc: next };
}

/**
 * Copie de l'idée, sans sa réservation. Tous les champs suivent (l'idée est clonée, un champ ajouté plus
 * tard suit aussi). Dans la même liste, la copie se place juste après l'original.
 */
export function copyItem(
  doc: Database,
  input: TransferInput & { id?: string },
): { ok: true; doc: Database; item: Item } | { ok: false; error: string } {
  const checked = checkTransfer(doc, input);
  if (!checked.ok) return checked;
  const next = clone(doc);
  const sameList = input.targetWishlistId === input.wishlistId;
  if (sameList) {
    for (const other of next.items) {
      if (other.wishlistId === input.wishlistId && other.sortOrder > checked.item.sortOrder) other.sortOrder += 1;
    }
  }
  const item: Item = {
    ...structuredClone(checked.item),
    id: input.id ?? newId(),
    wishlistId: input.targetWishlistId,
    typeId: input.typeId,
    personId: input.personId,
    sortOrder: sameList ? checked.item.sortOrder + 1 : lastSortOrder(next, input.targetWishlistId) + 1,
    archived: false,
  };
  next.items.push(item);
  return { ok: true, doc: next, item };
}

export function deleteItem(
  doc: Database,
  input: { wishlistId: string; actorId: string; itemId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  if (doc.reservations.some((r) => r.itemId === input.itemId)) {
    return { ok: false, error: "itemHasReservation" };
  }
  const next = clone(doc);
  const before = next.items.length;
  next.items = next.items.filter((i) => !(i.id === input.itemId && i.wishlistId === input.wishlistId));
  if (next.items.length === before) return { ok: false, error: "itemMissing" };
  return { ok: true, doc: next };
}

export function addType(
  doc: Database,
  input: { wishlistId: string; actorId: string; label: string; id?: string },
): { ok: true; doc: Database; typeId: string } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const label = input.label.trim();
  if (!label) return { ok: false, error: "typeNeedsName" };
  const wishlist = doc.wishlists.find((w) => w.id === input.wishlistId);
  if (!wishlist) return { ok: false, error: "listMissing" };
  const typeId = input.id ?? newId();
  const next = clone(doc);
  const sortOrder =
    next.types
      .filter((type) => type.wishlistId === input.wishlistId)
      .reduce((max, type) => Math.max(max, type.sortOrder ?? 0), -1) + 1;
  next.types.push({ id: typeId, wishlistId: input.wishlistId, label, sortOrder });
  next.views.push({
    id: newId(),
    wishlistId: input.wishlistId,
    label,
    kind: "types",
    typeIds: [typeId],
    personId: null,
    pinned: false,
  });
  return { ok: true, doc: next, typeId };
}

export function renameType(
  doc: Database,
  input: { wishlistId: string; actorId: string; typeId: string; label: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const label = input.label.trim();
  if (!label) return { ok: false, error: "typeNeedsName" };
  const next = clone(doc);
  const type = next.types.find((t) => t.id === input.typeId && t.wishlistId === input.wishlistId);
  if (!type) return { ok: false, error: "typeMissing" };
  type.label = label;
  for (const view of next.views) {
    if (
      view.wishlistId === input.wishlistId &&
      !view.pinned &&
      view.kind === "types" &&
      view.typeIds.length === 1 &&
      view.typeIds[0] === input.typeId
    ) {
      view.label = label;
    }
  }
  return { ok: true, doc: next };
}

export function deleteType(
  doc: Database,
  input: { wishlistId: string; actorId: string; typeId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const type = doc.types.find((t) => t.id === input.typeId && t.wishlistId === input.wishlistId);
  if (!type) return { ok: false, error: "typeMissing" };
  if (doc.items.some((item) => item.wishlistId === input.wishlistId && item.typeId === input.typeId)) {
    return { ok: false, error: "typeInUse" };
  }
  const next = clone(doc);
  next.types = next.types.filter((t) => !(t.id === input.typeId && t.wishlistId === input.wishlistId));
  for (const view of next.views) {
    if (view.wishlistId === input.wishlistId && view.kind === "types") {
      view.typeIds = view.typeIds.filter((id) => id !== input.typeId);
    }
  }
  next.views = next.views.filter(
    (view) =>
      !(
        view.wishlistId === input.wishlistId &&
        view.kind === "types" &&
        !view.pinned &&
        view.typeIds.length === 0
      ),
  );
  return { ok: true, doc: next };
}

export function reorderTypes(
  doc: Database,
  input: { wishlistId: string; actorId: string; orderedTypeIds: string[] },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const current = doc.types.filter((type) => type.wishlistId === input.wishlistId);
  if (current.length === 0) return { ok: true, doc };
  if (input.orderedTypeIds.length !== current.length) {
    return { ok: false, error: "typeMissing" };
  }
  const currentIds = new Set(current.map((type) => type.id));
  if (input.orderedTypeIds.some((id) => !currentIds.has(id))) {
    return { ok: false, error: "typeMissing" };
  }
  if (new Set(input.orderedTypeIds).size !== input.orderedTypeIds.length) {
    return { ok: false, error: "typeMissing" };
  }
  const next = clone(doc);
  const order = new Map(input.orderedTypeIds.map((id, index) => [id, index]));
  for (const type of next.types) {
    if (type.wishlistId !== input.wishlistId) continue;
    type.sortOrder = order.get(type.id) ?? type.sortOrder;
  }
  return { ok: true, doc: next };
}

export function addPerson(
  doc: Database,
  input: { wishlistId: string; actorId: string; label: string; id?: string },
): { ok: true; doc: Database; personId: string } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const label = input.label.trim();
  if (!label) return { ok: false, error: "personNeedsName" };
  const wishlist = doc.wishlists.find((w) => w.id === input.wishlistId);
  if (!wishlist) return { ok: false, error: "listMissing" };
  const personId = input.id ?? newId();
  const next = clone(doc);
  next.people.push({ id: personId, wishlistId: input.wishlistId, label });
  next.views.push({
    id: newId(),
    wishlistId: input.wishlistId,
    label,
    kind: "person",
    typeIds: [],
    personId,
    pinned: false,
  });
  return { ok: true, doc: next, personId };
}

export function renamePerson(
  doc: Database,
  input: { wishlistId: string; actorId: string; personId: string; label: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const label = input.label.trim();
  if (!label) return { ok: false, error: "personNeedsName" };
  const next = clone(doc);
  const person = next.people.find((p) => p.id === input.personId && p.wishlistId === input.wishlistId);
  if (!person) return { ok: false, error: "personMissing" };
  person.label = label;
  for (const view of next.views) {
    if (
      view.wishlistId === input.wishlistId &&
      !view.pinned &&
      view.kind === "person" &&
      view.personId === input.personId
    ) {
      view.label = label;
    }
  }
  return { ok: true, doc: next };
}

export function deletePerson(
  doc: Database,
  input: { wishlistId: string; actorId: string; personId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const person = doc.people.find((p) => p.id === input.personId && p.wishlistId === input.wishlistId);
  if (!person) return { ok: false, error: "personMissing" };
  if (doc.items.some((item) => item.wishlistId === input.wishlistId && item.personId === input.personId)) {
    return { ok: false, error: "personInUse" };
  }
  const next = clone(doc);
  next.people = next.people.filter((p) => !(p.id === input.personId && p.wishlistId === input.wishlistId));
  next.views = next.views.filter(
    (view) =>
      !(view.wishlistId === input.wishlistId && view.kind === "person" && view.personId === input.personId),
  );
  return { ok: true, doc: next };
}

function removeReservation(doc: Database, wishlistId: string, reservationId: string): Database | null {
  const next = clone(doc);
  const reservation = next.reservations.find(
    (r) => r.id === reservationId && r.wishlistId === wishlistId,
  );
  if (!reservation) return null;
  const item = next.items.find((i) => i.id === reservation.itemId && i.wishlistId === wishlistId);
  if (item) item.archived = false;
  next.reservations = next.reservations.filter((r) => r.id !== reservation.id);
  return next;
}

export function cancelReservation(
  doc: Database,
  input: { wishlistId: string; actorId: string; reservationId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!findMembership(doc, input.wishlistId, input.actorId)) {
    return { ok: false, error: "notMember" };
  }
  const next = removeReservation(doc, input.wishlistId, input.reservationId);
  if (!next) return { ok: false, error: "reservationMissing" };
  return { ok: true, doc: next };
}

/** Annulation par le réservant (compte lié ou claim cookie). */
export function cancelOwnReservation(
  doc: Database,
  input: {
    wishlistId: string;
    reservationId: string;
    userId: string | null;
    claimedIds: ReadonlySet<string>;
  },
): { ok: true; doc: Database } | { ok: false; error: string } {
  const reservation = doc.reservations.find(
    (r) => r.id === input.reservationId && r.wishlistId === input.wishlistId,
  );
  if (!reservation) return { ok: false, error: "reservationMissing" };
  const byAccount = Boolean(input.userId && reservation.userId === input.userId);
  const byClaim = input.claimedIds.has(reservation.id);
  if (!byAccount && !byClaim) return { ok: false, error: "accessDenied" };
  const next = removeReservation(doc, input.wishlistId, input.reservationId);
  if (!next) return { ok: false, error: "reservationMissing" };
  return { ok: true, doc: next };
}
