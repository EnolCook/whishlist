import type { components, paths } from "@/api/schema";

import { getDb, type Db } from "./db";

type ItemInput = components["schemas"]["ItemInput"];
type CreateListBody = paths["/lists"]["post"]["requestBody"]["content"]["application/json"];
type PatchItemBody = paths["/lists/{listId}/items/{itemId}"]["patch"]["requestBody"]["content"]["application/json"];

/** Corps envoyé pour chaque sorte de changement, au format du contrat. */
export type ChangePayloads = {
  // Le serveur remplit une catégorie ou un « qui » absents, mais l'app les demande toujours (data/lists.ts).
  createList: CreateListBody & { title: string; category: string; person: string; id: string; categoryId: string; personId: string };
  createItem: ItemInput & { id: string };
  updateItem: ItemInput;
  patchItem: PatchItemBody;
  deleteItem: Record<string, never>;
};
export type ChangeKind = keyof ChangePayloads;

export type NewChange = {
  [K in ChangeKind]: { kind: K; listId: string; targetId: string; payload: ChangePayloads[K] };
}[ChangeKind];

export type ChangeState = "pending" | "sending" | "rejected";

/** Un changement de la file (data-model.md, « outbox »). */
export type Change = NewChange & {
  seq: number;
  state: ChangeState;
  errorCode: string | null;
  attempts: number;
  createdAt: string;
};

type Row = Omit<Change, "payload"> & { payload: string };

const listeners = new Set<() => void>();

/** Prévient les écrans et la synchronisation qu'un changement a été ajouté ou traité. */
export function onOutboxChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function fromRow(row: Row): Change {
  return { ...row, payload: JSON.parse(row.payload) };
}

export async function listChanges(): Promise<Change[]> {
  const db = await getDb();
  const rows = await db.all<Row>("SELECT * FROM outbox ORDER BY seq");
  return rows.map(fromRow);
}

/**
 * Un changement dépend d'un plus ancien qui vise le même objet, ou qui crée sa liste.
 * Si celui-là est refusé, celui-ci l'est aussi (FR-029a).
 */
export function dependsOn(change: Pick<Change, "listId" | "targetId">, earlier: Pick<Change, "kind" | "targetId">): boolean {
  return earlier.targetId === change.targetId || (earlier.kind === "createList" && earlier.targetId === change.listId);
}

async function insert(db: Db, change: NewChange, state: ChangeState, errorCode: string | null): Promise<number> {
  const result = await db.run(
    "INSERT INTO outbox (kind, listId, targetId, payload, state, errorCode, attempts, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
    [change.kind, change.listId, change.targetId, JSON.stringify(change.payload), state, errorCode, new Date().toISOString()],
  );
  return result.lastInsertRowId;
}

async function setPayload(db: Db, seq: number, payload: unknown) {
  await db.run("UPDATE outbox SET payload = ? WHERE seq = ?", [JSON.stringify(payload), seq]);
}

/**
 * Ajoute un changement à la fin de la file, en compactant les changements encore `pending`
 * de la même idée (data-model.md, « Compaction ») :
 * - `updateItem` remplace un `updateItem` en attente ; `patchItem` se fond dans un `patchItem` en attente ;
 * - après un `createItem` en attente, une modification se fond dans la création ;
 * - `deleteItem` après un `createItem` en attente : les deux disparaissent.
 * Rend le `seq` du changement qui porte l'état final (null si plus rien n'est à envoyer).
 */
export async function enqueue(change: NewChange): Promise<number | null> {
  const db = await getDb();
  let seq: number | null = null;
  await db.transaction(async () => {
    const earlier = (await db.all<Row>("SELECT * FROM outbox ORDER BY seq")).map(fromRow);
    const rejectedParent = earlier.find((row) => row.state === "rejected" && dependsOn(change, row));
    if (rejectedParent) {
      seq = await insert(db, change, "rejected", rejectedParent.errorCode);
      return;
    }
    const sameItem = earlier.filter((row) => row.state === "pending" && row.targetId === change.targetId);
    const created = sameItem.find((row) => row.kind === "createItem");

    if (change.kind === "deleteItem") {
      for (const row of sameItem) await db.run("DELETE FROM outbox WHERE seq = ?", [row.seq]);
      // Une idée jamais envoyée : rien à supprimer sur le serveur.
      if (!created) seq = await insert(db, change, "pending", null);
      return;
    }
    if (created && created.kind === "createItem" && change.kind === "updateItem") {
      await setPayload(db, created.seq, { ...change.payload, id: created.payload.id });
      seq = created.seq;
      return;
    }
    if (created && created.kind === "createItem" && change.kind === "patchItem" && change.payload.typeId !== undefined && change.payload.archived === undefined) {
      await setPayload(db, created.seq, { ...created.payload, typeId: change.payload.typeId });
      seq = created.seq;
      return;
    }
    const previous = sameItem.find((row) => row.kind === change.kind);
    if (previous && previous.kind === "patchItem" && change.kind === "patchItem") {
      await setPayload(db, previous.seq, { ...previous.payload, ...change.payload });
      seq = previous.seq;
      return;
    }
    if (previous && change.kind === "updateItem") await db.run("DELETE FROM outbox WHERE seq = ?", [previous.seq]);
    seq = await insert(db, change, "pending", null);
  });
  emit();
  return seq;
}

export async function getChange(seq: number): Promise<Change | null> {
  const db = await getDb();
  const row = await db.first<Row>("SELECT * FROM outbox WHERE seq = ?", [seq]);
  return row ? fromRow(row) : null;
}

/** Prochain changement à envoyer, dans l'ordre. */
export async function nextPending(): Promise<Change | null> {
  const db = await getDb();
  const row = await db.first<Row>("SELECT * FROM outbox WHERE state = 'pending' ORDER BY seq LIMIT 1");
  return row ? fromRow(row) : null;
}

export async function markSending(seq: number): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE outbox SET state = 'sending', attempts = attempts + 1 WHERE seq = ?", [seq]);
}

/** Accepté par le serveur : retiré de la file. */
export async function markSent(seq: number): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM outbox WHERE seq = ?", [seq]);
  emit();
}

/** Pas de réponse (réseau, 5xx, 401) : il repart en attente, pour un nouvel essai. */
export async function markPending(seq: number): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE outbox SET state = 'pending' WHERE seq = ?", [seq]);
}

/** Refus du serveur : le changement et ceux qui en dépendent passent `rejected` avec le même code. */
export async function reject(seq: number, errorCode: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async () => {
    const all = (await db.all<Row>("SELECT * FROM outbox ORDER BY seq")).map(fromRow);
    const refused = all.find((row) => row.seq === seq);
    if (!refused) return;
    const cascade = [refused, ...all.filter((row) => row.seq > seq && row.state !== "rejected" && dependsOn(row, refused))];
    for (const row of cascade) {
      await db.run("UPDATE outbox SET state = 'rejected', errorCode = ? WHERE seq = ?", [errorCode, row.seq]);
    }
  });
  emit();
}

/** Changements refusés à cause de `seq` (même code, plus récents, dépendants). */
function followers(all: Change[], parent: Change): Change[] {
  return all.filter(
    (row) => row.seq > parent.seq && row.state === "rejected" && row.errorCode === parent.errorCode && dependsOn(row, parent),
  );
}

/** « Corriger » : le changement refusé repart avec un corps modifié, et ceux qui en dépendaient avec lui. */
export async function retry(seq: number, payload: NewChange["payload"]): Promise<void> {
  const db = await getDb();
  await db.transaction(async () => {
    const all = (await db.all<Row>("SELECT * FROM outbox ORDER BY seq")).map(fromRow);
    const parent = all.find((row) => row.seq === seq);
    if (!parent) return;
    for (const row of followers(all, parent)) {
      await db.run("UPDATE outbox SET state = 'pending', errorCode = NULL WHERE seq = ?", [row.seq]);
    }
    await db.run("UPDATE outbox SET state = 'pending', errorCode = NULL, payload = ? WHERE seq = ?", [JSON.stringify(payload), seq]);
  });
  emit();
}

/** « Abandonner » : le changement refusé disparaît, avec ceux qui en dépendaient. */
export async function discard(seq: number): Promise<void> {
  const db = await getDb();
  await db.transaction(async () => {
    const all = (await db.all<Row>("SELECT * FROM outbox ORDER BY seq")).map(fromRow);
    const parent = all.find((row) => row.seq === seq);
    if (!parent) return;
    for (const row of [parent, ...followers(all, parent)]) await db.run("DELETE FROM outbox WHERE seq = ?", [row.seq]);
  });
  emit();
}

/** Au démarrage : un envoi interrompu (app tuée) repart en attente ; le renvoi est sans risque (R5). */
export async function resetSending(): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE outbox SET state = 'pending' WHERE state = 'sending'");
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM outbox WHERE state != 'rejected'");
  return row?.count ?? 0;
}
