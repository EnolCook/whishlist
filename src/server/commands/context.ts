import { mustConfirmEmail } from "../../domain/email-confirmation";
import type { User } from "../../domain/types";
import type { Locale } from "../../i18n/config";
import { emailVerificationRequired } from "../mail";

/**
 * Ce qu'une commande sait de la requête, sans dépendre de Next :
 * les server actions le construisent depuis les cookies, l'API depuis les en-têtes.
 */
export type CommandContext = {
  user: User | null;
  ip: string | null;
  locale: Locale;
  /** Origine publique pour les liens (invitation, reset). */
  origin: string;
};

export type CommandResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Compte connecté qui n'a pas de changement de mot de passe en attente. */
export function activeUser(ctx: CommandContext): { ok: true; user: User } | { ok: false; error: string } {
  if (!ctx.user) return { ok: false, error: "unauthorized" };
  if (ctx.user.mustChangePassword) return { ok: false, error: "mustChangePassword" };
  return { ok: true, user: ctx.user };
}

/**
 * Compte actif dont l'adresse est confirmée, quand la validation est exigée (envoi d'e-mail actif) :
 * seul ce compte crée une liste, en rejoint une ou invite (010, FR-005).
 */
export function verifiedUser(ctx: CommandContext): { ok: true; user: User } | { ok: false; error: string } {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  if (emailConfirmationPending(active.user)) return { ok: false, error: "emailNotVerified" };
  return active;
}

/**
 * Compte actif qui doit encore confirmer son adresse, avec la configuration de ce serveur :
 * bandeau du site, renvoi du lien. Un compte qui doit changer son mot de passe le fait d'abord.
 */
export function emailConfirmationPending(user: User): boolean {
  return !user.mustChangePassword && mustConfirmEmail(user, emailVerificationRequired());
}

/**
 * Compte à prendre en compte côté public (accès membre, réservation liée, annulation par compte).
 * Un compte qui doit changer son mot de passe n'agit qu'en invité (FR-023).
 */
export function publicAccount(ctx: CommandContext): User | null {
  return ctx.user && !ctx.user.mustChangePassword ? ctx.user : null;
}
