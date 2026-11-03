import { api, ApiError, done, ok, type Schemas } from "@/api/client";
import { unlockTokenFor } from "@/features/guest/storage";
import { publicListKey, removeSnapshot } from "@/offline/snapshot";

import { refreshLists } from "./store";

export type FollowResult =
  | { ok: true; subscription: Schemas["SubscribedListSummary"] }
  | { ok: false; error: "readPasswordRequired"; title: string | null }
  | { ok: false; error: string };

/**
 * S'abonne à une liste publique par son lien ou son jeton. Une liste protégée déjà déverrouillée sur ce
 * téléphone (vue de la liste) passe par sa preuve `X-Read-Unlock` ; sinon le serveur répond `423` avec le
 * titre de la liste, et l'écran demande le mot de passe.
 */
export async function followList(input: {
  urlOrToken: string;
  password?: string;
  /** Jeton de la liste, quand on le connaît : sa preuve de déverrouillage accompagne la demande. */
  readToken?: string;
}): Promise<FollowResult> {
  const urlOrToken = input.urlOrToken.trim();
  if (!urlOrToken) return { ok: false, error: "subscriptionLinkInvalid" };
  const unlock = input.readToken ? await unlockTokenFor(input.readToken) : null;
  try {
    const subscription = await ok(
      api.POST("/subscriptions", {
        params: { header: unlock ? { "X-Read-Unlock": unlock } : {} },
        body: { urlOrToken, ...(input.password ? { password: input.password } : {}) },
      }),
    );
    await refreshLists();
    return { ok: true, subscription };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 423) return { ok: false, error: "readPasswordRequired", title: error.title ?? null };
      return { ok: false, error: error.code };
    }
    throw error;
  }
}

/** Ne plus suivre une liste : sa copie hors ligne part avec l'abonnement. */
export async function unfollowList(readToken: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await done(api.DELETE("/subscriptions/{readToken}", { params: { path: { readToken } } }));
    await removeSnapshot(publicListKey(readToken));
    await refreshLists();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.code };
    throw error;
  }
}
