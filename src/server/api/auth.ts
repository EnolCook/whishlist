import type { NextRequest } from "next/server";
import { findApiKey, isApiKeyToken } from "../../auth/api-keys";
import { touchApiKey } from "../../domain/api-keys";
import { findApiSessionUser } from "../../auth/api-session";
import { verifyReadUnlock } from "../../auth/read-unlock";
import { verifyReservationClaims } from "../../auth/reservation-claim";
import { sessionSecret } from "../../auth/session";
import type { User, Wishlist } from "../../domain/types";
import { readDocument, updateDocument } from "../../store/db";
import { bucketExhausted, RateLimitError, rateLimitForIp, takeToken } from "../rate-limit";

/** Jeton d'un en-tête `Authorization: Bearer …`, ou null. */
export function bearerFrom(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return match ? match[1]! : null;
}

export function bearerToken(req: NextRequest): string | null {
  return bearerFrom(req.headers.get("authorization"));
}

/** Requêtes par minute et par clé d'API, en plus des limites par action. */
export const API_KEY_RATE = { limit: 120, windowMs: 60 * 1000 };

/**
 * Échecs par IP (clé `oys_…` inconnue ou révoquée) avant refus : le budget des échecs de connexion
 * (`login`, 20 par 15 minutes). Seuls les échecs comptent : une clé valide n'use pas ce budget.
 */
export const API_KEY_FAILURE_RATE = { limit: 20, windowMs: 15 * 60 * 1000 };
const API_KEY_FAILURE_SCOPE = "api-key-failure";

/** Une clé d'API (`oys_…`) plutôt qu'un jeton de session de l'app. */
export function usesApiKey(req: NextRequest): boolean {
  const token = bearerToken(req);
  return token !== null && isApiKeyToken(token);
}

/**
 * Compte d'une clé d'API, ou null. Limite le débit de la clé et note son utilisation (au plus une écriture
 * par heure). Utilisé par le serveur MCP, seul à accepter une clé.
 *
 * Une clé inconnue ou révoquée compte un échec pour l'IP (`ip`, celle du proxy). Une fois ses échecs épuisés,
 * l'IP est refusée (`rateLimited`) avant toute recherche, pour qu'on ne puisse plus tester de clé depuis elle.
 * Sans IP de confiance, même règle que `rateLimitForIp` : en production un échec est refusé.
 */
export async function apiKeyUser(token: string, ip: string | null = null): Promise<User | null> {
  if (ip && bucketExhausted(`${API_KEY_FAILURE_SCOPE}:${ip}`, API_KEY_FAILURE_RATE.limit)) {
    throw new RateLimitError(API_KEY_FAILURE_SCOPE);
  }
  const current = await readDocument();
  const found = findApiKey(current, token);
  if (!found) {
    rateLimitForIp(API_KEY_FAILURE_SCOPE, ip, API_KEY_FAILURE_RATE.limit, API_KEY_FAILURE_RATE.windowMs);
    return null;
  }
  if (!takeToken(`api-key:${found.key.id}`, API_KEY_RATE.limit, API_KEY_RATE.windowMs)) {
    throw new RateLimitError("api-key");
  }
  // `touchApiKey` ne fait que dire s'il faut écrire ; l'écriture le rejoue sur le document de la transaction.
  if (touchApiKey(current, found.key.id)) {
    await updateDocument((doc) => ({ doc: touchApiKey(doc, found.key.id) ?? doc, result: null }));
  }
  return found.user;
}

/**
 * Compte du jeton de session de l'app, ou null (pas de jeton, jeton invalide). Une clé d'API ne vaut pas ici :
 * `withApi` la refuse avant (`apiKeyNotAllowed`), elle n'ouvre que le serveur MCP.
 */
export async function optionalApiUser(req: NextRequest): Promise<User | null> {
  const token = bearerToken(req);
  if (!token || isApiKeyToken(token)) return null;
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
