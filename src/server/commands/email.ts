import {
  cancelEmailChange,
  confirmEmail,
  createEmailVerification,
  findEmailConfirmation,
  maskEmail,
  pendingEmailChange,
  requestEmailChange,
} from "../../domain/email-confirmation";
import type { EmailConfirmation } from "../../domain/types";
import { internalPath, withLocale } from "../../i18n/locale-path";
import { readDocument, updateDocument } from "../../store/db";
import { toMe, type MeView } from "../api/views";
import {
  emailVerificationRequired,
  sendEmailChangedNoticeMail,
  sendEmailChangeMail,
  sendEmailVerificationMail,
} from "../mail";
import { rateLimitForIp } from "../rate-limit";
import { activeUser, emailConfirmationPending, type CommandContext, type CommandResult } from "./context";

function confirmUrl(ctx: CommandContext, token: string, suite: string | null): string {
  const page = `${ctx.origin}${withLocale(ctx.locale, `/confirmer-email/${token}`)}`;
  return suite ? `${page}?suite=${encodeURIComponent(suite)}` : page;
}

/** Le lien n'est rendu qu'en dev quand l'e-mail n'est pas parti (affichage du site), jamais en production. */
function revealed(url: string, sent: boolean): string | null {
  return !sent && process.env.NODE_ENV !== "production" ? url : null;
}

/**
 * Crée (ou remplace) le lien de confirmation de l'adresse actuelle et l'envoie, hors de la transaction.
 * `suite` : où reprendre après la confirmation (une invitation, par exemple).
 */
export async function sendVerificationLink(
  ctx: CommandContext,
  input: { userId: string; suite?: string | null },
): Promise<CommandResult<{ sent: boolean; failed: boolean; verificationUrl: string | null }>> {
  const created = await updateDocument((doc) => {
    const issued = createEmailVerification(doc, { userId: input.userId });
    return { doc: issued.ok ? issued.doc : doc, result: issued };
  });
  if (!created.ok) return created;
  const url = confirmUrl(ctx, created.token, internalPath(input.suite));
  const mail = await sendEmailVerificationMail({ to: created.email, confirmUrl: url, locale: ctx.locale });
  return { ok: true, sent: mail.sent, failed: mail.failed, verificationUrl: revealed(url, mail.sent) };
}

/** Renvoie le lien de confirmation (bandeau, « Mon compte ») ; le lien précédent cesse de valoir (US2). */
export async function resendEmailVerification(
  ctx: CommandContext,
): Promise<CommandResult<{ sent: boolean; failed: boolean; verificationUrl: string | null }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  rateLimitForIp(`email-verification:${active.user.id}`, ctx.ip, 5, 60 * 60 * 1000);
  if (!emailConfirmationPending(active.user)) return { ok: false, error: "emailAlreadyVerified" };
  return sendVerificationLink(ctx, { userId: active.user.id });
}

/**
 * Ce que montre la page de confirmation avant le clic, sans rien écrire.
 * L'adresse n'est lisible en entier que par le compte concerné, connecté.
 */
export async function previewEmailConfirmation(
  ctx: CommandContext,
  input: { token: string },
): Promise<CommandResult<{ purpose: EmailConfirmation["purpose"]; email: string; ownAccount: boolean }>> {
  const found = findEmailConfirmation(await readDocument(), { token: input.token });
  if (!found.ok) return found;
  const ownAccount = ctx.user?.id === found.user.id;
  const email = found.confirmation.email;
  return { ok: true, purpose: found.confirmation.purpose, email: ownAccount ? email : maskEmail(email), ownAccount };
}

/** Confirme le lien (bouton de la page, jamais à l'ouverture : les antivirus de messagerie ouvrent les liens). */
export async function confirmEmailWithToken(
  ctx: CommandContext,
  input: { token: string; suite?: string | null },
): Promise<CommandResult<{ purpose: EmailConfirmation["purpose"]; suite: string | null; ownAccount: boolean }>> {
  rateLimitForIp("confirm-email", ctx.ip, 20, 15 * 60 * 1000);
  const confirmed = await updateDocument((doc) => {
    const saved = confirmEmail(doc, { token: input.token });
    return { doc: saved.ok ? saved.doc : (saved.doc ?? doc), result: saved };
  });
  if (!confirmed.ok) return { ok: false, error: confirmed.error };
  if (confirmed.purpose === "change") {
    // L'ancienne adresse est prévenue, sans lien d'action : si ce n'était pas elle, le contact.
    await sendEmailChangedNoticeMail({
      to: confirmed.previousEmail,
      maskedNewEmail: maskEmail(confirmed.email),
      locale: ctx.locale,
    });
  }
  return {
    ok: true,
    purpose: confirmed.purpose,
    suite: internalPath(input.suite),
    ownAccount: ctx.user?.id === confirmed.userId,
  };
}

/**
 * Demande de changement d'adresse (US3), mot de passe actuel exigé. Avec l'envoi d'e-mail actif, un lien part
 * vers la nouvelle adresse et l'adresse de connexion ne change qu'à sa confirmation ; sinon elle change tout de suite.
 */
export async function requestOwnEmailChange(
  ctx: CommandContext,
  input: { email: string; currentPassword: string },
): Promise<CommandResult<{ me: MeView; sent: boolean; confirmUrl: string | null }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  rateLimitForIp(`email-change:${active.user.id}`, ctx.ip, 5, 60 * 60 * 1000);
  const immediate = !emailVerificationRequired();
  type Requested = CommandResult<{ me: MeView; token: string | null; email: string; taken: boolean }>;
  const requested = await updateDocument<Requested>(async (doc) => {
    const saved = await requestEmailChange(doc, { userId: active.user.id, ...input, immediate });
    if (!saved.ok) return { doc, result: saved };
    const user = saved.doc.users.find((entry) => entry.id === active.user.id);
    if (!user) return { doc, result: { ok: false, error: "accountMissing" } };
    const me = toMe(user, pendingEmailChange(saved.doc, user.id));
    return { doc: saved.doc, result: { ok: true, me, token: saved.token, email: saved.email, taken: saved.taken } };
  });
  if (!requested.ok) return requested;
  if (!requested.token) return { ok: true, me: requested.me, sent: false, confirmUrl: null };
  // Adresse d'un autre compte : rien ne part vers elle, et la réponse ne doit pas le laisser voir.
  if (requested.taken) return { ok: true, me: requested.me, sent: true, confirmUrl: null };
  const url = confirmUrl(ctx, requested.token, null);
  const mail = await sendEmailChangeMail({ to: requested.email, confirmUrl: url, locale: ctx.locale });
  return { ok: true, me: requested.me, sent: mail.sent, confirmUrl: revealed(url, mail.sent) };
}

/** Annule le changement d'adresse en attente ; sans demande, ne fait rien. */
export async function cancelOwnEmailChange(ctx: CommandContext): Promise<CommandResult<{ me: MeView }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  const me = await updateDocument((doc) => {
    const next = cancelEmailChange(doc, { userId: active.user.id });
    const user = next.users.find((entry) => entry.id === active.user.id);
    return { doc: next, result: user ? toMe(user, null) : null };
  });
  if (!me) return { ok: false, error: "accountMissing" };
  return { ok: true, me };
}
