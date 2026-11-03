import { clone } from "../domain/access";
import { hashSecretToken, newId, newSecretToken } from "../domain/tokens";
import type { ApiSession, Database, User } from "../domain/types";
import { API_KEY_PREFIX } from "./api-keys";
import { SESSION_TTL_SEC } from "./session";

/** Même durée qu'une session du site. */
const TTL_MS = SESSION_TTL_SEC * 1000;

export const hashApiToken = hashSecretToken;

export function issueApiSession(
  doc: Database,
  user: User,
  nowMs = Date.now(),
  newToken: () => string = newSecretToken,
): { doc: Database; token: string; session: ApiSession } {
  // Un jeton qui commencerait par le préfixe des clés serait lu comme une clé et refusé partout.
  let token = newToken();
  while (token.startsWith(API_KEY_PREFIX)) token = newToken();
  const session: ApiSession = {
    id: newId(),
    userId: user.id,
    tokenHash: hashApiToken(token),
    sessionVersion: user.sessionVersion ?? 0,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + TTL_MS).toISOString(),
  };
  const next = clone(doc);
  next.apiSessions.push(session);
  return { doc: next, token, session };
}

function isLive(doc: Database, session: ApiSession, nowMs: number): User | null {
  if (Date.parse(session.expiresAt) <= nowMs) return null;
  const user = doc.users.find((entry) => entry.id === session.userId);
  if (!user || (user.sessionVersion ?? 0) !== session.sessionVersion) return null;
  return user;
}

export function findApiSessionUser(doc: Database, token: string, nowMs = Date.now()): User | null {
  if (!token) return null;
  const hash = hashApiToken(token);
  const session = doc.apiSessions.find((entry) => entry.tokenHash === hash);
  return session ? isLive(doc, session, nowMs) : null;
}

export function revokeApiSession(doc: Database, token: string): Database {
  const hash = hashApiToken(token);
  const next = clone(doc);
  next.apiSessions = next.apiSessions.filter((entry) => entry.tokenHash !== hash);
  return next;
}

/** Retire les sessions expirées ou périmées par un changement de mot de passe. */
export function pruneApiSessions(doc: Database, nowMs = Date.now()): Database {
  const next = clone(doc);
  next.apiSessions = next.apiSessions.filter((entry) => isLive(next, entry, nowMs));
  return next;
}
