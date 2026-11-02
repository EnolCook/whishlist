import { issueApiSession, pruneApiSessions, revokeApiSession } from "../../auth/api-session";
import { pendingEmailChange } from "../../domain/email-confirmation";
import { createPasswordReset, resetPasswordWithToken } from "../../domain/password-reset";
import type { User } from "../../domain/types";
import { authenticate, changePassword, normalizeEmail, registerUser, updateDisplayName } from "../../domain/users";
import { withLocale } from "../../i18n/locale-path";
import { emailVerificationRequired, sendAlreadyRegisteredMail, sendPasswordResetMail } from "../mail";
import { readDocument, updateDocument } from "../../store/db";
import { toMe, type MeView, type SessionView } from "../api/views";
import { rateLimitForIp } from "../rate-limit";
import { activeUser, type CommandContext, type CommandResult } from "./context";
import { sendVerificationLink } from "./email";

/** Vérifie e-mail et mot de passe, avec la même limite que la connexion du site. */
export async function checkCredentials(
  ctx: CommandContext,
  input: { email: string; password: string },
): Promise<CommandResult<{ user: User }>> {
  rateLimitForIp("login", ctx.ip, 20, 15 * 60 * 1000);
  const user = await authenticate(await readDocument(), input.email, input.password);
  if (!user) return { ok: false, error: "invalidCredentials" };
  return { ok: true, user };
}

/** Émet un jeton d'API pour ce compte, en purgeant les sessions mortes. */
export async function openApiSession(userId: string): Promise<CommandResult<{ session: SessionView }>> {
  return updateDocument<CommandResult<{ session: SessionView }>>((doc) => {
    const user = doc.users.find((entry) => entry.id === userId);
    if (!user) return { doc, result: { ok: false, error: "accountMissing" } };
    const issued = issueApiSession(pruneApiSessions(doc), user);
    return {
      doc: issued.doc,
      result: {
        ok: true,
        session: {
          token: issued.token,
          expiresAt: issued.session.expiresAt,
          user: toMe(user, pendingEmailChange(doc, user.id)),
        },
      },
    };
  });
}

export async function login(
  ctx: CommandContext,
  input: { email: string; password: string },
): Promise<CommandResult<{ session: SessionView }>> {
  const checked = await checkCredentials(ctx, input);
  if (!checked.ok) return checked;
  return openApiSession(checked.user.id);
}

export async function logout(_ctx: CommandContext, input: { token: string }): Promise<CommandResult> {
  await updateDocument((doc) => ({ doc: revokeApiSession(doc, input.token), result: null }));
  return { ok: true };
}

/**
 * Inscription. Un e-mail déjà inscrit ne donne pas d'erreur : un e-mail part vers cette adresse
 * et `user` vaut null (pas de connexion), pour ne pas révéler les comptes existants.
 * Avec l'envoi d'e-mail actif, un lien de confirmation part vers l'adresse (`next` : où reprendre ensuite) ;
 * `verificationUrl` n'est rendu qu'en dev quand l'e-mail n'est pas parti.
 */
export async function register(
  ctx: CommandContext,
  input: { email: string; password: string; displayName: string; next?: string | null },
): Promise<CommandResult<{ user: User | null; verificationUrl: string | null; mailFailed: boolean }>> {
  rateLimitForIp("register", ctx.ip, 5, 60 * 60 * 1000);
  const result = await updateDocument(async (doc) => {
    const created = await registerUser(doc, input);
    return { doc: created.ok ? created.doc : doc, result: created };
  });
  if (result.ok) {
    if (!emailVerificationRequired()) return { ok: true, user: result.value, verificationUrl: null, mailFailed: false };
    const link = await sendVerificationLink(ctx, { userId: result.value.id, suite: input.next });
    if (!link.ok) return { ok: true, user: result.value, verificationUrl: null, mailFailed: true };
    return { ok: true, user: result.value, verificationUrl: link.verificationUrl, mailFailed: link.failed };
  }
  if (result.error !== "emailTaken") return result;
  // `mailFailed` vaut aussi pour cet e-mail : la réponse ne distingue pas un compte existant.
  const mail = await sendAlreadyRegisteredMail({
    to: normalizeEmail(input.email),
    loginUrl: `${ctx.origin}${withLocale(ctx.locale, "/connexion")}`,
    locale: ctx.locale,
  });
  return { ok: true, user: null, verificationUrl: null, mailFailed: mail.failed };
}

/**
 * Change le mot de passe du compte connecté et périme toutes ses connexions.
 * L'ancien mot de passe n'est pas demandé si un changement est imposé.
 * Avec `openApiSession`, un nouveau jeton d'API est émis dans la même écriture.
 */
export async function changeOwnPassword(
  ctx: CommandContext,
  input: { password: string; currentPassword?: string; openApiSession?: boolean },
): Promise<CommandResult<{ user: User; session: SessionView | null }>> {
  const user = ctx.user;
  if (!user) return { ok: false, error: "unauthorized" };
  rateLimitForIp(`change-password:${user.id}`, ctx.ip, 20, 15 * 60 * 1000);
  return updateDocument<CommandResult<{ user: User; session: SessionView | null }>>(async (doc) => {
    const saved = await changePassword(doc, {
      userId: user.id,
      password: input.password,
      currentPassword: user.mustChangePassword ? undefined : (input.currentPassword ?? ""),
    });
    if (!saved.ok) return { doc, result: saved };
    if (!input.openApiSession) return { doc: saved.doc, result: { ok: true, user: saved.value, session: null } };
    const issued = issueApiSession(pruneApiSessions(saved.doc), saved.value);
    return {
      doc: issued.doc,
      result: {
        ok: true,
        user: saved.value,
        session: {
          token: issued.token,
          expiresAt: issued.session.expiresAt,
          user: toMe(saved.value, pendingEmailChange(saved.doc, saved.value.id)),
        },
      },
    };
  });
}

/** Le compte connecté tel que l'API le montre, même s'il doit changer son mot de passe (le client l'apprend ici). */
export async function readMe(ctx: CommandContext): Promise<CommandResult<{ me: MeView }>> {
  if (!ctx.user) return { ok: false, error: "unauthorized" };
  return { ok: true, me: toMe(ctx.user, pendingEmailChange(await readDocument(), ctx.user.id)) };
}

export async function updateOwnDisplayName(
  ctx: CommandContext,
  input: { displayName: string },
): Promise<CommandResult<{ user: User; me: MeView }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  const result = await updateDocument((doc) => {
    const saved = updateDisplayName(doc, { userId: active.user.id, displayName: input.displayName });
    return { doc: saved.ok ? saved.doc : doc, result: saved };
  });
  if (!result.ok) return result;
  return { ok: true, user: result.value, me: toMe(result.value, pendingEmailChange(result.doc, result.value.id)) };
}

/**
 * Envoie un lien de réinitialisation qui ouvre le site. Même réponse que l'e-mail existe ou non.
 * `resetUrl` n'est rendu qu'en dev quand l'e-mail n'est pas parti (affichage du site), jamais en production.
 */
export async function requestPasswordReset(
  ctx: CommandContext,
  input: { email: string },
): Promise<CommandResult<{ resetUrl: string | null }>> {
  rateLimitForIp("password-reset", ctx.ip, 5, 60 * 60 * 1000);
  const created = await updateDocument((doc) => {
    const reset = createPasswordReset(doc, { email: input.email });
    return { doc: reset.doc, result: reset };
  });
  if (!created.token || !created.email) return { ok: true, resetUrl: null };
  const resetUrl = `${ctx.origin}${withLocale(ctx.locale, `/reinitialiser/${created.token}`)}`;
  const mail = await sendPasswordResetMail({ to: created.email, resetUrl, locale: ctx.locale });
  const reveal = !mail.sent && process.env.NODE_ENV !== "production";
  return { ok: true, resetUrl: reveal ? resetUrl : null };
}

/**
 * Nouveau mot de passe choisi depuis le lien reçu par e-mail : page du site et app (011, R7).
 * Le mot de passe change, l'adresse est vérifiée et les autres connexions tombent (`sessionVersion`).
 * Avec `signIn`, une session d'API est ouverte pour ce compte ; le site ouvre la sienne (cookie) lui-même.
 */
export async function resetPasswordWithLink(
  ctx: CommandContext,
  input: { token: string; password: string; signIn: boolean },
): Promise<CommandResult<{ userId: string; sessionVersion: number; session: SessionView | null }>> {
  rateLimitForIp("password-reset-confirm", ctx.ip, 20, 15 * 60 * 1000);
  const reset = await updateDocument(async (doc) => {
    const saved = await resetPasswordWithToken(doc, { token: input.token, password: input.password });
    return { doc: saved.ok ? saved.doc : doc, result: saved };
  });
  if (!reset.ok) return { ok: false, error: reset.error };
  if (!input.signIn) return { ok: true, userId: reset.userId, sessionVersion: reset.sessionVersion, session: null };
  const opened = await openApiSession(reset.userId);
  if (!opened.ok) return opened;
  return { ok: true, userId: reset.userId, sessionVersion: reset.sessionVersion, session: opened.session };
}
