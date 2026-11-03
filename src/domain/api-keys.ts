import { clone } from "./access";
import { MAX_API_KEY_NAME, MAX_API_KEYS } from "./api-key-limits";
import { newId } from "./tokens";
import type { ApiKey, Database, User } from "./types";

export { MAX_API_KEY_NAME, MAX_API_KEYS };

/** `lastUsedAt` n'est réécrit qu'au-delà de ce délai : une requête de lecture n'écrit pas à chaque fois. */
const TOUCH_EVERY_MS = 60 * 60 * 1000;

export type ApiKeyView = Pick<ApiKey, "id" | "name" | "hint" | "createdAt" | "lastUsedAt">;

/** Code d'erreur du nom d'une clé (déjà nettoyé de ses espaces), ou null s'il est valable. */
export function apiKeyNameError(name: string): string | null {
  if (!name) return "apiKeyNeedsName";
  if (name.length > MAX_API_KEY_NAME) return "apiKeyNameTooLong";
  return null;
}

/**
 * Ajoute au compte une clé dont le jeton a déjà été tiré et haché (`src/auth/api-keys.ts`) :
 * nom obligatoire, au plus MAX_API_KEY_NAME caractères, au plus MAX_API_KEYS clés par compte.
 */
export function addApiKey(
  doc: Database,
  user: User,
  input: { name: string; tokenHash: string; hint: string },
  nowMs = Date.now(),
): { ok: true; doc: Database; key: ApiKeyView } | { ok: false; error: string } {
  const name = input.name.trim();
  const nameError = apiKeyNameError(name);
  if (nameError) return { ok: false, error: nameError };
  if (doc.apiKeys.filter((key) => key.userId === user.id).length >= MAX_API_KEYS) {
    return { ok: false, error: "apiKeyLimit" };
  }
  const key: ApiKey = {
    id: newId(),
    userId: user.id,
    name,
    tokenHash: input.tokenHash,
    hint: input.hint,
    createdAt: new Date(nowMs).toISOString(),
    lastUsedAt: null,
  };
  const next = clone(doc);
  next.apiKeys.push(key);
  return { ok: true, doc: next, key: viewOf(key) };
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

/** La clé de ce hachage et son compte, ou null (clé inconnue, révoquée, compte supprimé). */
export function findApiKeyByHash(doc: Database, tokenHash: string): { key: ApiKey; user: User } | null {
  const key = doc.apiKeys.find((entry) => entry.tokenHash === tokenHash);
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
