import { clone } from "../domain/access";
import { hashSecretToken, newId, newSecretToken } from "../domain/tokens";
import type { ApiKey, Database, User } from "../domain/types";
import { API_KEY_PREFIX, MAX_API_KEY_NAME, MAX_API_KEYS } from "./api-key-limits";

export { API_KEY_PREFIX, MAX_API_KEY_NAME, MAX_API_KEYS };

/** `lastUsedAt` n'est réécrit qu'au-delà de ce délai : une requête de lecture n'écrit pas à chaque fois. */
const TOUCH_EVERY_MS = 60 * 60 * 1000;

export type ApiKeyView = Pick<ApiKey, "id" | "name" | "hint" | "createdAt" | "lastUsedAt">;

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

/** Crée une clé ; le jeton en clair n'est rendu qu'ici, une fois. */
export function createApiKey(
  doc: Database,
  user: User,
  input: { name: string },
  nowMs = Date.now(),
): { ok: true; doc: Database; token: string; key: ApiKeyView } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "apiKeyNeedsName" };
  if (name.length > MAX_API_KEY_NAME) return { ok: false, error: "apiKeyNameTooLong" };
  if (doc.apiKeys.filter((key) => key.userId === user.id).length >= MAX_API_KEYS) {
    return { ok: false, error: "apiKeyLimit" };
  }
  const token = `${API_KEY_PREFIX}${newSecretToken()}`;
  const key: ApiKey = {
    id: newId(),
    userId: user.id,
    name,
    tokenHash: hashSecretToken(token),
    hint: token.slice(-4),
    createdAt: new Date(nowMs).toISOString(),
    lastUsedAt: null,
  };
  const next = clone(doc);
  next.apiKeys.push(key);
  return { ok: true, doc: next, token, key: viewOf(key) };
}

function viewOf(key: ApiKey): ApiKeyView {
  return { id: key.id, name: key.name, hint: key.hint, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt };
}

/** Les clés du compte, les plus récentes d'abord, sans leur hachage. */
export function listApiKeys(doc: Database, userId: string): ApiKeyView[] {
  return doc.apiKeys
    .filter((key) => key.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(viewOf);
}

/** La clé et son compte, ou null (clé inconnue, révoquée, compte supprimé). */
export function findApiKey(doc: Database, token: string): { key: ApiKey; user: User } | null {
  if (!isApiKeyToken(token)) return null;
  const hash = hashSecretToken(token);
  const key = doc.apiKeys.find((entry) => entry.tokenHash === hash);
  const user = key ? doc.users.find((entry) => entry.id === key.userId) : undefined;
  return key && user ? { key, user } : null;
}

export function revokeApiKey(
  doc: Database,
  input: { userId: string; keyId: string },
): { ok: true; doc: Database } | { ok: false; error: string } {
  if (!doc.apiKeys.some((key) => key.id === input.keyId && key.userId === input.userId)) {
    return { ok: false, error: "apiKeyMissing" };
  }
  const next = clone(doc);
  next.apiKeys = next.apiKeys.filter((key) => !(key.id === input.keyId && key.userId === input.userId));
  return { ok: true, doc: next };
}

/** Note l'utilisation de la clé ; null s'il n'y a rien à écrire (utilisée il y a moins d'une heure). */
export function touchApiKey(doc: Database, keyId: string, nowMs = Date.now()): Database | null {
  const key = doc.apiKeys.find((entry) => entry.id === keyId);
  if (!key) return null;
  if (key.lastUsedAt && nowMs - Date.parse(key.lastUsedAt) < TOUCH_EVERY_MS) return null;
  const next = clone(doc);
  next.apiKeys.find((entry) => entry.id === keyId)!.lastUsedAt = new Date(nowMs).toISOString();
  return next;
}
