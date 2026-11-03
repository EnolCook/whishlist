import { addApiKey, findApiKeyByHash, type ApiKeyView } from "../domain/api-keys";
import { hashSecretToken, newSecretToken } from "../domain/tokens";
import type { ApiKey, Database, User } from "../domain/types";

/** Préfixe des clés : on les reconnaît (et les distingue d'un jeton de session) sans base. */
export const API_KEY_PREFIX = "oys_";

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

/** Tire le jeton d'une nouvelle clé et l'ajoute au compte ; le jeton en clair n'est rendu qu'ici, une fois. */
export function createApiKey(
  doc: Database,
  user: User,
  input: { name: string },
  nowMs = Date.now(),
): { ok: true; doc: Database; token: string; key: ApiKeyView } | { ok: false; error: string } {
  const token = `${API_KEY_PREFIX}${newSecretToken()}`;
  const added = addApiKey(doc, user, { name: input.name, tokenHash: hashSecretToken(token), hint: token.slice(-4) }, nowMs);
  return added.ok ? { ...added, token } : added;
}

/** La clé de ce jeton et son compte, ou null (pas une clé, clé inconnue, révoquée, compte supprimé). */
export function findApiKey(doc: Database, token: string): { key: ApiKey; user: User } | null {
  if (!isApiKeyToken(token)) return null;
  return findApiKeyByHash(doc, hashSecretToken(token));
}
