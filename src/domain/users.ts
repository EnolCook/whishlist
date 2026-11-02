import { findMembership, clone } from "./access";
import { hashPassword, passwordPolicyError, verifyPassword } from "./passwords";
import { newId } from "./tokens";
import type { Database, User } from "./types";

export interface Ok<T> {
  ok: true;
  doc: Database;
  value: T;
}

export interface Err {
  ok: false;
  error: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(
  doc: Database,
  input: { email: string; password: string; displayName: string; now?: Date; id?: string },
): Promise<Ok<User> | Err> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const password = input.password;
  if (!email || !email.includes("@") || !password || !displayName) {
    return { ok: false, error: "registerFields" };
  }
  const policy = passwordPolicyError(password);
  if (policy) return { ok: false, error: policy };
  if (doc.users.some((u) => u.email === email)) {
    return { ok: false, error: "emailTaken" };
  }
  const user: User = {
    id: input.id ?? newId(),
    email,
    passwordHash: await hashPassword(password),
    displayName,
    createdAt: (input.now ?? new Date()).toISOString(),
    mustChangePassword: false,
    sessionVersion: 0,
    emailVerifiedAt: null,
  };
  const next = clone(doc);
  next.users.push(user);
  return { ok: true, doc: next, value: user };
}

export async function authenticate(doc: Database, email: string, password: string): Promise<User | null> {
  const user = doc.users.find((u) => u.email === normalizeEmail(email));
  if (!user) {
    await hashPassword(password);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return user;
}

export async function changePassword(
  doc: Database,
  input: { userId: string; password: string; currentPassword?: string },
): Promise<Ok<User> | Err> {
  const password = input.password;
  const policy = passwordPolicyError(password);
  if (policy) return { ok: false, error: policy };
  const next = clone(doc);
  const user = next.users.find((entry) => entry.id === input.userId);
  if (!user) return { ok: false, error: "accountMissing" };
  if (input.currentPassword !== undefined) {
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return { ok: false, error: "wrongCurrentPassword" };
    }
  }
  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = false;
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  // Compte repris en main : un changement d'adresse demandé avant ne vaut plus rien (010).
  next.emailConfirmations = next.emailConfirmations.filter(
    (entry) => !(entry.userId === user.id && entry.purpose === "change"),
  );
  // Comme les sessions : changer son mot de passe après une fuite doit aussi couper une clé d'API volée.
  next.apiKeys = next.apiKeys.filter((entry) => entry.userId !== user.id);
  return { ok: true, doc: next, value: user };
}

/** Adresse normalisée, valide et qu'aucun autre compte n'utilise. */
export function validateNewEmail(doc: Database, userId: string, value: string): { ok: true; email: string } | Err {
  const email = normalizeEmail(value);
  if (!email || !email.includes("@")) return { ok: false, error: "emailInvalid" };
  if (doc.users.some((u) => u.email === email && u.id !== userId)) return { ok: false, error: "emailTaken" };
  return { ok: true, email };
}

/** Nouvelle adresse de connexion, confirmée à `now` (lien ouvert, ou sans envoi d'e-mail). */
export function setUserEmail(
  doc: Database,
  input: { userId: string; email: string; now?: Date },
): Ok<User> | Err {
  const checked = validateNewEmail(doc, input.userId, input.email);
  if (!checked.ok) return checked;
  const { email } = checked;
  const next = clone(doc);
  const user = next.users.find((entry) => entry.id === input.userId);
  if (!user) return { ok: false, error: "accountMissing" };
  user.email = email;
  user.emailVerifiedAt = (input.now ?? new Date()).toISOString();
  return { ok: true, doc: next, value: user };
}

export function updateDisplayName(
  doc: Database,
  input: { userId: string; displayName: string },
): Ok<User> | Err {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "displayNameRequired" };
  if (displayName.length > 80) return { ok: false, error: "displayNameTooLong" };
  const next = clone(doc);
  const user = next.users.find((entry) => entry.id === input.userId);
  if (!user) return { ok: false, error: "accountMissing" };
  user.displayName = displayName;
  return { ok: true, doc: next, value: user };
}

export { findMembership };
