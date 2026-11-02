import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { api, configureClient, done, NetworkError, ok, type Schemas } from "@/api/client";
import { resetStore } from "@/data/store";
import { removeExportFiles } from "@/features/account/exportData";
import { clearGuestAccess } from "@/features/guest/storage";
import { currentLocale } from "@/i18n";
import { clearAll, ensureUser, getSnapshot, putSnapshot } from "@/offline/snapshot";

type Me = Schemas["Me"];

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut"; expired: boolean; deleted?: boolean }
  | { status: "mustChangePassword"; user: Me }
  | { status: "signedIn"; user: Me | null };

// Clés du stockage sécurisé (data-model.md, « Connexion »).
const TOKEN = "session.token";
const EXPIRES_AT = "session.expiresAt";
const USER_ID = "session.userId";
// Le compte est gardé dans la copie locale pour l'afficher hors ligne.
const ME = "me";

let token: string | null = null;
let state: SessionState = { status: "loading" };
const listeners = new Set<() => void>();

function setState(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

export function getSession(): SessionState {
  return state;
}

export function onSessionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): SessionState {
  return useSyncExternalStore(onSessionChange, getSession);
}

async function forgetToken() {
  token = null;
  await Promise.all([TOKEN, EXPIRES_AT, USER_ID].map((key) => SecureStore.deleteItemAsync(key)));
}

function stateFor(user: Me): SessionState {
  return user.mustChangePassword ? { status: "mustChangePassword", user } : { status: "signedIn", user };
}

// Un 401 alors qu'on était connecté : connexion expirée ou invalidée (FR-004).
// Les changements en attente sont gardés pour la reconnexion du même compte.
configureClient({
  getToken: () => token,
  getLocale: currentLocale,
  onUnauthorized: () => {
    if (!token) return;
    void forgetToken().then(() => setState({ status: "signedOut", expired: true }));
  },
});

/** Au démarrage : jeton stocké → connecté tout de suite, puis vérifié par `GET /me` (R3). */
export async function restore(): Promise<void> {
  const [stored, expiresAt, userId] = await Promise.all(
    [TOKEN, EXPIRES_AT, USER_ID].map((key) => SecureStore.getItemAsync(key)),
  );
  if (!stored || !userId || (expiresAt && Date.parse(expiresAt) <= Date.now())) {
    await forgetToken();
    setState({ status: "signedOut", expired: false });
    return;
  }
  token = stored;
  await ensureUser(userId);
  const cached = await getSnapshot<Me>(ME);
  setState(cached ? stateFor(cached.body) : { status: "signedIn", user: null });
  await refreshMe();
}

/** Relit le compte ; sans réseau, garde l'état actuel. */
export async function refreshMe(): Promise<void> {
  if (!token) return;
  try {
    const me = await ok(api.GET("/me"));
    await putSnapshot(ME, me);
    setState(stateFor(me));
  } catch (error) {
    // 401 : déjà traité par onUnauthorized. Réseau : on reste sur la copie.
    if (error instanceof NetworkError) return;
    if (!token) return;
    throw error;
  }
}

// Au retour au premier plan : le compte a pu changer ailleurs (adresse confirmée dans le navigateur, 010).
AppState.addEventListener("change", (status) => {
  if (status === "active") refreshMe().catch(() => undefined);
});

/** Enregistre la connexion rendue par login, register ou /me/password. */
export async function signIn(session: Schemas["Session"]): Promise<void> {
  await ensureUser(session.user.id);
  await Promise.all([
    SecureStore.setItemAsync(TOKEN, session.token),
    SecureStore.setItemAsync(EXPIRES_AT, session.expiresAt),
    SecureStore.setItemAsync(USER_ID, session.user.id),
  ]);
  token = session.token;
  await putSnapshot(ME, session.user);
  setState(stateFor(session.user));
}

/** Met à jour le compte affiché (nom changé). */
export async function updateMe(me: Me): Promise<void> {
  await putSnapshot(ME, me);
  setState(stateFor(me));
}

/** Oublie tout sur le téléphone : jeton, copie locale, fichiers d'export du cache. */
async function forgetEverything(next: SessionState): Promise<void> {
  await forgetToken();
  await clearAll();
  removeExportFiles();
  resetStore();
  setState(next);
}

/** Invalide la connexion côté serveur si possible (FR-003), puis oublie tout sur le téléphone. */
export async function signOut(): Promise<void> {
  try {
    await api.POST("/auth/logout");
  } catch {
    // Hors ligne : le jeton expirera de lui-même ; on l'oublie quand même.
  }
  // Seulement à la déconnexion et à la suppression, pas à l'expiration : les claims servent à annuler
  // une réservation faite en invité (011).
  await clearGuestAccess();
  await forgetEverything({ status: "signedOut", expired: false });
}

/**
 * Supprime le compte sur le serveur (mot de passe exigé), puis efface tout sur le téléphone,
 * comme `signOut` mais sans `/auth/logout` : le jeton ne vaut déjà plus rien (R9).
 * Une erreur (mot de passe faux, réseau…) remonte et ne change rien.
 */
export async function deleteAccount(password: string): Promise<void> {
  await done(api.POST("/me/deletion", { body: { password } }));
  await clearGuestAccess();
  await forgetEverything({ status: "signedOut", expired: false, deleted: true });
}
