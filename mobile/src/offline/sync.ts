import { ApiError, NetworkError } from "@/api/client";

import { getChange, markPending, markSending, markSent, nextPending, reject, type Change } from "./outbox";

/** Ce que la synchronisation demande au serveur ; les tests le remplacent par un faux. */
export interface Transport {
  /** Envoie un changement ; lève `ApiError` (refus) ou `NetworkError`. */
  send(change: Change): Promise<void>;
  /** Recharge la copie locale de « Mes listes » et des listes touchées. */
  refresh(listIds: string[]): Promise<void>;
}

/** Listes à relire après un changement : la sienne, et la liste d'arrivée d'un déplacement ou d'une copie. */
function listsOf(change: Change): string[] {
  return change.kind === "moveItem" || change.kind === "copyItem" ? [change.listId, change.payload.targetListId] : [change.listId];
}

/** Attente avant un nouvel essai : 1 s, 2 s, 4 s… plafonnée à 1 minute (R6). */
export function retryDelay(attempts: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

/** Réponse qui ne dit rien du changement : on réessaiera plus tard, sans le refuser. */
function isTransient(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (!(error instanceof ApiError)) return false;
  return error.status >= 500 || error.status === 401 || error.status === 410 || error.status === 429;
}

let transport: Transport | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function setTransport(next: Transport): void {
  transport = next;
}

function schedule(delay: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delay);
}

/** Un passage sur la file ; rend `false` s'il s'est arrêté faute de réponse. */
async function run(send: Transport): Promise<boolean> {
  const touched = new Set<string>();
  try {
    for (let change = await nextPending(); change; change = await nextPending()) {
      await markSending(change.seq);
      try {
        await send.send(change);
        await markSent(change.seq);
        for (const id of listsOf(change)) touched.add(id);
      } catch (error) {
        // Une idée déjà supprimée : le renvoi d'une suppression est un succès (contrat api-v1-additions).
        if (change.kind === "deleteItem" && error instanceof ApiError && error.code === "itemMissing") {
          await markSent(change.seq);
          touched.add(change.listId);
          continue;
        }
        if (isTransient(error)) {
          await markPending(change.seq);
          // 401 : la session gère la reconnexion ; la file est gardée pour le même compte.
          if (!(error instanceof ApiError && error.status === 401)) schedule(retryDelay(change.attempts + 1));
          return false;
        }
        // Refus métier : signalé, et les autres changements continuent (FR-029a).
        await reject(change.seq, error instanceof ApiError ? error.code : "serverError");
        for (const id of listsOf(change)) touched.add(id);
      }
    }
  } finally {
    if (touched.size > 0) await send.refresh([...touched]).catch(() => {});
  }
  return true;
}

/**
 * Envoie la file un changement à la fois, dans l'ordre (FR-028). Un seul envoi à la fois :
 * un appel pendant un envoi attend le même, qui prend aussi les changements ajoutés entre-temps.
 */
export function syncNow(): Promise<void> {
  if (!transport) return Promise.resolve();
  if (running) {
    // Un changement ajouté pendant l'envoi : un nouveau passage le prendra.
    again = true;
    return running;
  }
  const current = transport;
  running = (async () => {
    try {
      let completed: boolean;
      do {
        again = false;
        completed = await run(current);
      } while (again && completed);
    } finally {
      running = null;
    }
  })();
  return running;
}

export type Outcome = { status: "sent" } | { status: "pending" } | { status: "rejected"; errorCode: string };

/** Après un ajout : envoie tout de suite si possible, et dit ce qu'il est advenu du changement. */
export async function sendAndWait(seq: number | null): Promise<Outcome> {
  if (seq === null) return { status: "sent" };
  await syncNow();
  const after = await getChange(seq);
  if (!after) return { status: "sent" };
  if (after.state === "rejected") return { status: "rejected", errorCode: after.errorCode ?? "serverError" };
  return { status: "pending" };
}

/** Tests : arrête le nouvel essai programmé. */
export function stopSync(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
