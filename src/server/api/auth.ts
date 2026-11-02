import type { NextRequest } from "next/server";
import { findApiKey, isApiKeyToken, touchApiKey } from "../../auth/api-keys";
import { findApiSessionUser } from "../../auth/api-session";
import { verifyReadUnlock } from "../../auth/read-unlock";
import { verifyReservationClaims } from "../../auth/reservation-claim";
import { sessionSecret } from "../../auth/session";
import type { User, Wishlist } from "../../domain/types";
import { readDocument, updateDocument } from "../../store/db";
import { RateLimitError, takeToken } from "../rate-limit";

export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1]! : null;
}

/** Requêtes par minute et par clé d'API, en plus des limites par action. */
export const API_KEY_RATE = { limit: 120, windowMs: 60 * 1000 };

/** Une clé d'API (`oys_…`) plutôt qu'un jeton de session de l'app. */
export function usesApiKey(req: NextRequest): boolean {
  const token = bearerToken(req);
  return token !== null && isApiKeyToken(token);
}

/**
 * Compte d'une clé d'API, ou null. Limite le débit de la clé et note son utilisation (au plus une écriture
 * par heure). Partagé par l'API et le serveur MCP.
 */
export async function apiKeyUser(token: string): Promise<User | null> {
  const found = findApiKey(await readDocument(), token);
  if (!found) return null;
  if (!takeToken(`api-key:${found.key.id}`, API_KEY_RATE.limit, API_KEY_RATE.windowMs)) {
    throw new RateLimitError("api-key");
  }
  if (touchApiKey(await readDocument(), found.key.id)) {
    await updateDocument((doc) => ({ doc: touchApiKey(doc, found.key.id) ?? doc, result: null }));
  }
  return found.user;
}

/** Compte du jeton bearer (session de l'app ou clé d'API), ou null (pas de jeton, jeton invalide). */
export async function optionalApiUser(req: NextRequest): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  if (isApiKeyToken(token)) return apiKeyUser(token);
  return findApiSessionUser(await readDocument(), token);
}

/** Preuves invité envoyées en en-tête : déverrouillage et claims de réservation. */
export function guestProofs(req: NextRequest, readToken: string) {
  const secret = sessionSecret();
  const unlock = req.headers.get("x-read-unlock");
  const claims = (req.headers.get("x-reservation-claims") ?? "")
    .split(",")
    .map((claim) => claim.trim())
    .filter(Boolean);
  return {
    isUnlocked: (list: Wishlist) => (secret ? verifyReadUnlock(list, unlock, secret) : !list.readPasswordHash),
    claimedIds: secret ? verifyReservationClaims(readToken, claims, secret) : new Set<string>(),
  };
}
