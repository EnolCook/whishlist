import { clone } from "./access";
import { verifyPassword } from "./passwords";
import { hashSecretToken, newId, newSecretToken } from "./tokens";
import type { Database, EmailConfirmation, User } from "./types";
import { normalizeEmail, setUserEmail, validateNewEmail } from "./users";

/** Validité d'un lien de confirmation : 24 h (contre 1 h pour la réinitialisation, plus sensible). */
const TTL_MS = 24 * 60 * 60 * 1000;

type Err = { ok: false; error: string };

export function isEmailVerified(user: User): boolean {
  return user.emailVerifiedAt !== null;
}

/** Le compte doit encore confirmer son adresse : la validation est exigée (envoi d'e-mail actif) et l'adresse n'est pas confirmée. */
export function mustConfirmEmail(user: User, verificationRequired: boolean): boolean {
  return verificationRequired && !isEmailVerified(user);
}

/** `camille@example.test` → `ca•••@example.test` : assez pour reconnaître son adresse, pas pour la lire. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const shown = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${shown}•••${email.slice(at)}`;
}

/** Remplace la demande de ce motif du compte : seul le dernier lien envoyé reste valable. */
function issue(
  doc: Database,
  input: { userId: string; purpose: EmailConfirmation["purpose"]; email: string; now: Date },
): { doc: Database; token: string } {
  const token = newSecretToken();
  const next = clone(doc);
  next.emailConfirmations = next.emailConfirmations.filter(
    (entry) => !(entry.userId === input.userId && entry.purpose === input.purpose),
  );
  next.emailConfirmations.push({
    id: newId(),
    userId: input.userId,
    purpose: input.purpose,
    email: input.email,
    tokenHash: hashSecretToken(token),
    expiresAt: new Date(input.now.getTime() + TTL_MS).toISOString(),
    createdAt: input.now.toISOString(),
  });
  return { doc: next, token };
}

/** Lien de confirmation de l'adresse actuelle du compte. */
export function createEmailVerification(
  doc: Database,
  input: { userId: string; now?: Date },
): { ok: true; doc: Database; token: string; email: string } | Err {
  const user = doc.users.find((entry) => entry.id === input.userId);
  if (!user) return { ok: false, error: "accountMissing" };
  const issued = issue(doc, { userId: user.id, purpose: "verify", email: user.email, now: input.now ?? new Date() });
  return { ok: true, doc: issued.doc, token: issued.token, email: user.email };
}

/**
 * Demande de changement d'adresse (mot de passe actuel exigé). Avec `immediate` (pas d'envoi d'e-mail),
 * l'adresse change tout de suite ; sinon un lien part vers la nouvelle et rien ne change avant son ouverture.
 * Une adresse en attente n'est pas réservée : le premier compte qui confirme l'obtient.
 * L'adresse d'un autre compte reçoit la même réponse qu'une adresse libre (`taken` : aucun e-mail ne doit
 * partir), pour ne pas révéler les comptes, comme l'inscription ; la confirmation la refuserait.
 */
export async function requestEmailChange(
  doc: Database,
  input: { userId: string; email: string; currentPassword: string; immediate: boolean; now?: Date },
): Promise<
  { ok: true; doc: Database; token: string | null; email: string; previousEmail: string; taken: boolean } | Err
> {
  const user = doc.users.find((entry) => entry.id === input.userId);
  if (!user) return { ok: false, error: "accountMissing" };
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    return { ok: false, error: "wrongCurrentPassword" };
  }
  const checked = validateNewEmail(doc, user.id, input.email);
  const taken = !checked.ok && checked.error === "emailTaken";
  // Sans envoi d'e-mail, l'adresse s'appliquerait tout de suite : celle d'un autre compte est refusée.
  if (!checked.ok && (!taken || input.immediate)) return checked;
  const email = checked.ok ? checked.email : normalizeEmail(input.email);
  if (email === user.email) return { ok: false, error: "emailUnchanged" };
  const now = input.now ?? new Date();
  if (input.immediate) {
    const saved = setUserEmail(doc, { userId: user.id, email, now });
    if (!saved.ok) return saved;
    saved.doc.emailConfirmations = saved.doc.emailConfirmations.filter((entry) => entry.userId !== user.id);
    return { ok: true, doc: saved.doc, token: null, email, previousEmail: user.email, taken: false };
  }
  const issued = issue(doc, { userId: user.id, purpose: "change", email, now });
  return { ok: true, doc: issued.doc, token: issued.token, email, previousEmail: user.email, taken };
}

/** Annule le changement en attente : son lien ne vaut plus rien. Sans demande, ne fait rien. */
export function cancelEmailChange(doc: Database, input: { userId: string }): Database {
  const next = clone(doc);
  next.emailConfirmations = next.emailConfirmations.filter(
    (entry) => !(entry.userId === input.userId && entry.purpose === "change"),
  );
  return next;
}

/** Nouvelle adresse en attente de confirmation (lien encore valable), ou null. */
export function pendingEmailChange(doc: Database, userId: string, now = new Date()): string | null {
  const pending = doc.emailConfirmations.find(
    (entry) => entry.userId === userId && entry.purpose === "change" && Date.parse(entry.expiresAt) > now.getTime(),
  );
  return pending?.email ?? null;
}

/**
 * Demande valide pour ce jeton, sans rien écrire (page de confirmation avant le clic).
 * Une demande `verify` dont l'adresse n'est plus celle du compte ne vaut plus rien.
 */
export function findEmailConfirmation(
  doc: Database,
  input: { token: string; now?: Date },
): { ok: true; confirmation: EmailConfirmation; user: User } | Err {
  const token = input.token.trim();
  if (!token) return { ok: false, error: "confirmationLinkInvalid" };
  const tokenHash = hashSecretToken(token);
  const confirmation = doc.emailConfirmations.find((entry) => entry.tokenHash === tokenHash);
  if (!confirmation) return { ok: false, error: "confirmationLinkInvalid" };
  const user = doc.users.find((entry) => entry.id === confirmation.userId);
  if (!user) return { ok: false, error: "confirmationLinkInvalid" };
  if (confirmation.purpose === "verify" && confirmation.email !== user.email) {
    return { ok: false, error: "confirmationLinkInvalid" };
  }
  if (Date.parse(confirmation.expiresAt) <= (input.now ?? new Date()).getTime()) {
    return { ok: false, error: "confirmationLinkExpired" };
  }
  return { ok: true, confirmation, user };
}

/**
 * Confirme le lien (usage unique). `verify` : l'adresse actuelle est vérifiée. `change` : la nouvelle adresse
 * devient l'adresse de connexion, vérifiée, si aucun autre compte ne l'a prise entre-temps ; sinon `emailTaken`,
 * et la demande, devenue impossible, disparaît (`doc` rendu avec le refus).
 */
export function confirmEmail(
  doc: Database,
  input: { token: string; now?: Date },
):
  | { ok: true; doc: Database; purpose: EmailConfirmation["purpose"]; userId: string; email: string; previousEmail: string }
  | (Err & { doc?: Database }) {
  const now = input.now ?? new Date();
  const found = findEmailConfirmation(doc, { token: input.token, now });
  if (!found.ok) return found;
  const { confirmation } = found;
  const previousEmail = found.user.email;
  if (confirmation.purpose === "change") {
    const saved = setUserEmail(doc, { userId: confirmation.userId, email: confirmation.email, now });
    if (!saved.ok) {
      return { ...saved, doc: cancelEmailChange(doc, { userId: confirmation.userId }) };
    }
    saved.doc.emailConfirmations = saved.doc.emailConfirmations.filter((entry) => entry.userId !== confirmation.userId);
    return { ok: true, doc: saved.doc, purpose: "change", userId: confirmation.userId, email: confirmation.email, previousEmail };
  }
  const next = clone(doc);
  const user = next.users.find((entry) => entry.id === confirmation.userId);
  if (!user) return { ok: false, error: "confirmationLinkInvalid" };
  if (user.emailVerifiedAt === null) user.emailVerifiedAt = now.toISOString();
  next.emailConfirmations = next.emailConfirmations.filter(
    (entry) => !(entry.userId === user.id && entry.purpose === "verify"),
  );
  return { ok: true, doc: next, purpose: confirmation.purpose, userId: user.id, email: user.email, previousEmail };
}
