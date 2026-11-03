import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { api, ApiError, done, NetworkError, ok, type Schemas } from "@/api/client";
import { currentLocale, intlLocale } from "@/i18n";
import { viewList, viewLists, type ViewList, type ViewListSummary } from "@/offline/optimistic";
import { createListBody, listChanges, onOutboxChange, resetSending, type Change } from "@/offline/outbox";
import {
  getSnapshot,
  listKey,
  listsKey,
  putSnapshot,
  removeSnapshot,
  subscriptionsKey,
  type Snapshot,
} from "@/offline/snapshot";
import { setTransport, syncNow, type Transport } from "@/offline/sync";
import { onNetworkChange, getOnline } from "@/network";

type ListsBody = Schemas["ListSummary"][];
type SubscriptionsBody = Schemas["SubscribedListSummary"][];
type ListBody = Schemas["MemberList"];

/** Ce que les écrans lisent : copies du serveur et file de changements (en mémoire, rechargées de SQLite). */
type State = {
  lists: Snapshot<ListsBody> | null;
  subscriptions: Snapshot<SubscriptionsBody> | null;
  list: Record<string, Snapshot<ListBody> | null>;
  /** Listes supprimées côté serveur ou dont la personne n'est plus membre (404). */
  missing: Record<string, true>;
  changes: Change[];
  /** La file a été lue au moins une fois depuis SQLite. */
  changesLoaded: boolean;
};

const empty: State = {
  lists: null,
  subscriptions: null,
  list: {},
  missing: {},
  changes: [],
  changesLoaded: false,
};
let state: State = empty;
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useStore(): State {
  return useSyncExternalStore(subscribe, () => state);
}

async function reloadChanges() {
  update({ changes: await listChanges(), changesLoaded: true });
}

/** Les écrans lisent la file même avant le démarrage du moteur (liste créée hors ligne). */
async function ensureChanges() {
  if (!state.changesLoaded) await reloadChanges();
}

async function loadLists() {
  const [lists, subscriptions] = await Promise.all([
    getSnapshot<ListsBody>(listsKey),
    getSnapshot<SubscriptionsBody>(subscriptionsKey),
  ]);
  update({ lists, subscriptions });
}

async function loadList(listId: string) {
  update({ list: { ...state.list, [listId]: await getSnapshot<ListBody>(listKey(listId)) } });
}

/** Relit « Mes listes » et les listes suivies sur le serveur ; sans réseau, garde la copie. */
export async function refreshLists(): Promise<void> {
  try {
    const body = await ok(api.GET("/lists"));
    const fetchedAt = new Date().toISOString();
    await putSnapshot(listsKey, body.lists, fetchedAt);
    await putSnapshot(subscriptionsKey, body.subscriptions ?? [], fetchedAt);
    await loadLists();
  } catch (error) {
    if (!(error instanceof NetworkError || error instanceof ApiError)) throw error;
  }
}

/** Relit une liste ; un 404 la retire de la copie (data-model.md, « snapshot »). */
export async function refreshList(listId: string): Promise<void> {
  // Une liste encore en attente de création n'existe pas sur le serveur.
  if (state.changes.some((change) => change.kind === "createList" && change.targetId === listId)) return;
  try {
    const list = await ok(api.GET("/lists/{listId}", { params: { path: { listId } } }));
    await putSnapshot(listKey(listId), list);
    update({ missing: Object.fromEntries(Object.entries(state.missing).filter(([id]) => id !== listId)) });
    await loadList(listId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      await removeSnapshot(listKey(listId));
      update({ missing: { ...state.missing, [listId]: true }, list: { ...state.list, [listId]: null } });
      return;
    }
    if (!(error instanceof NetworkError || error instanceof ApiError)) throw error;
  }
}

/** Envoi d'un changement de la file, route par route (contrat 004 + api-v1-additions). */
async function send(change: Change): Promise<void> {
  const path = { listId: change.listId };
  switch (change.kind) {
    case "createList":
      await ok(api.POST("/lists", { body: createListBody(change.payload) }));
      return;
    case "createItem":
      await ok(api.POST("/lists/{listId}/items", { params: { path }, body: change.payload }));
      return;
    case "updateItem":
      await ok(api.PUT("/lists/{listId}/items/{itemId}", { params: { path: { ...path, itemId: change.targetId } }, body: change.payload }));
      return;
    case "patchItem":
      await ok(api.PATCH("/lists/{listId}/items/{itemId}", { params: { path: { ...path, itemId: change.targetId } }, body: change.payload }));
      return;
    case "deleteItem":
      await done(api.DELETE("/lists/{listId}/items/{itemId}", { params: { path: { ...path, itemId: change.targetId } } }));
      return;
    case "moveItem": {
      const { preview: _preview, ...body } = change.payload;
      await ok(api.POST("/lists/{listId}/items/{itemId}/move", { params: { path: { ...path, itemId: change.targetId } }, body }));
      return;
    }
    case "copyItem": {
      const { preview, ...body } = change.payload;
      await ok(api.POST("/lists/{listId}/items/{itemId}/copy", { params: { path: { ...path, itemId: preview.id } }, body }));
      return;
    }
  }
}

export const apiTransport: Transport = {
  send,
  refresh: async (listIds) => {
    await Promise.all([refreshLists(), ...listIds.map(refreshList)]);
  },
};

let started = false;

/**
 * Démarre le moteur hors ligne (une fois, connecté) : la file reprend où elle en était, puis
 * s'envoie au démarrage, au retour du réseau, au retour de l'app au premier plan (R6).
 */
export async function startOfflineEngine(): Promise<void> {
  if (started) return;
  started = true;
  setTransport(apiTransport);
  await resetSending();
  await reloadChanges();
  onOutboxChange(() => void reloadChanges());
  onNetworkChange(() => {
    if (getOnline()) void syncNow();
  });
  AppState.addEventListener("change", (status) => {
    if (status === "active") void syncNow();
  });
  void syncNow();
}

/** Après une déconnexion : rien de l'ancien compte ne reste en mémoire. */
export function resetStore(): void {
  update(empty);
}

/** Rafraîchit au montage et au retour de l'app au premier plan (FR-017). */
function useRefreshing(refresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  // Le premier chargement de cette source (liste) est terminé, réussi ou non.
  const [settledFor, setSettledFor] = useState<(() => Promise<void>) | null>(null);
  const run = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  useEffect(() => {
    void refresh().finally(() => setSettledFor(() => refresh));
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  return { refreshing, settled: settledFor === refresh, refresh: run };
}

export function useMyLists(): {
  lists: ViewListSummary[];
  subscriptions: SubscriptionsBody;
  loaded: boolean;
  fetchedAt: string | null;
  refreshing: boolean;
  settled: boolean;
  refresh: () => Promise<void>;
} {
  const store = useStore();
  const refresh = useCallback(async () => {
    await ensureChanges();
    if (!state.lists || !state.subscriptions) await loadLists();
    await refreshLists();
  }, []);
  const refreshing = useRefreshing(refresh);
  const lists = useMemo(() => viewLists(store.lists?.body ?? null, store.changes), [store.lists, store.changes]);
  const subscriptions = store.subscriptions?.body ?? [];
  return {
    lists,
    subscriptions,
    loaded: store.lists !== null || lists.length > 0 || subscriptions.length > 0,
    fetchedAt: store.lists?.fetchedAt ?? store.subscriptions?.fetchedAt ?? null,
    ...refreshing,
  };
}

/**
 * La liste de ce lien est dans « Listes suivies » (copie locale de `GET /lists`). Sert quand la liste
 * elle-même ne se lit pas (mot de passe changé) : on peut quand même ne plus la suivre.
 */
export function useIsFollowed(readToken: string): boolean {
  const store = useStore();
  useEffect(() => {
    if (!state.subscriptions) void loadLists();
  }, []);
  return store.subscriptions?.body.some((subscription) => subscription.readToken === readToken) ?? false;
}

export function useMemberList(listId: string): {
  list: ViewList | null;
  /** Copie locale et file lues : `list` null veut alors dire « inconnue sur ce téléphone ». */
  loaded: boolean;
  /** La liste n'existe plus pour ce compte (404). */
  missing: boolean;
  fetchedAt: string | null;
  refreshing: boolean;
  settled: boolean;
  refresh: () => Promise<void>;
} {
  const store = useStore();
  const refresh = useCallback(async () => {
    await ensureChanges();
    if (state.list[listId] === undefined) await loadList(listId);
    await refreshList(listId);
  }, [listId]);
  const refreshing = useRefreshing(refresh);
  const snapshot = store.list[listId] ?? null;
  const list = useMemo(
    () => viewList(snapshot?.body ?? null, listId, store.changes, intlLocale(currentLocale())),
    [snapshot, listId, store.changes],
  );
  const loaded = store.changesLoaded && store.list[listId] !== undefined;
  return { list, loaded, missing: store.missing[listId] === true, fetchedAt: snapshot?.fetchedAt ?? null, ...refreshing };
}

/** Changements pas encore acceptés (bandeau hors ligne, avertissement à la déconnexion). */
export function usePendingCount(): number {
  return useStore().changes.filter((change) => change.state !== "rejected").length;
}

/** Date de la copie la plus récente affichée (bandeau « dernière mise à jour à … »). */
export function useLastFetchedAt(listId?: string): string | null {
  const store = useStore();
  return (listId ? store.list[listId]?.fetchedAt : store.lists?.fetchedAt) ?? null;
}
