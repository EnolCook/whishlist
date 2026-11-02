import { clone } from "./access";
import { hashPassword, passwordPolicyError } from "./passwords";
import { hashSecretToken, newId, newSecretToken } from "./tokens";
import { normalizeEmail } from "./users";
import type { Database } from "./types";

const TTL_MS = 60 * 60 * 1000;

export function createPasswordReset(
  doc: Database,
  input: { email: string; now?: Date },
): { ok: true; doc: Database; token: string | null; email: string | null } {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    return { ok: true, doc, token: null, email: null };
  }
  const user = doc.users.find((entry) => entry.email === email);
  if (!user) {
    return { ok: true, doc, token: null, email: null };
  }
  const now = input.now ?? new Date();
  const token = newSecretToken();
  const next = clone(doc);
  next.passwordResets = next.passwordResets.filter((entry) => entry.userId !== user.id);
  next.passwordResets.push({
    id: newId(),
    userId: user.id,
    tokenHash: hashSecretToken(token),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  });
  return { ok: true, doc: next, token, email: user.email };
}

export async function resetPasswordWithToken(
  doc: Database,
  input: { token: string; password: string; now?: Date },
): Promise<{ ok: true; doc: Database; userId: string; sessionVersion: number } | { ok: false; error: string }> {
  const password = input.password;
  const policy = passwordPolicyError(password);
  if (policy) return { ok: false, error: policy };
  const token = input.token.trim();
  if (!token) return { ok: false, error: "resetLinkInvalid" };
  const now = input.now ?? new Date();
  const tokenHash = hashSecretToken(token);
  const reset = doc.passwordResets.find((entry) => entry.tokenHash === tokenHash);
  if (!reset) return { ok: false, error: "resetLinkInvalid" };
  if (Date.parse(reset.expiresAt) <= now.getTime()) {
    return { ok: false, error: "resetLinkExpired" };
  }
  const next = clone(doc);
  const user = next.users.find((entry) => entry.id === reset.userId);
  if (!user) return { ok: false, error: "resetLinkInvalid" };
  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = false;
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  // Le lien est arrivé à cette adresse : elle est donc valide (010, FR-007). Compte repris en main :
  // un changement d'adresse demandé avant (peut-être par quelqu'un d'autre) ne vaut plus rien.
  if (user.emailVerifiedAt === null) user.emailVerifiedAt = now.toISOString();
  next.passwordResets = next.passwordResets.filter((entry) => entry.userId !== user.id);
  next.emailConfirmations = next.emailConfirmations.filter((entry) => entry.userId !== user.id);
  // Un reset sert souvent à reprendre un compte compromis : une clé d'API volée ne doit pas survivre.
  next.apiKeys = next.apiKeys.filter((entry) => entry.userId !== user.id);
  return { ok: true, doc: next, userId: user.id, sessionVersion: user.sessionVersion };
}

export function findValidPasswordReset(
  doc: Database,
  token: string,
  now = new Date(),
): boolean {
  const tokenHash = hashSecretToken(token.trim());
  const reset = doc.passwordResets.find((entry) => entry.tokenHash === tokenHash);
  if (!reset) return false;
  return Date.parse(reset.expiresAt) > now.getTime();
}
