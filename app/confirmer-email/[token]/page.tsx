import type { Metadata } from "next";
import { currentUser } from "../../../src/auth/current";
import { confirmEmailAction, resendEmailVerificationAction } from "../../../src/server/actions";
import { actionContext } from "../../../src/server/action-context";
import { previewEmailConfirmation } from "../../../src/server/commands/email";
import { LinkButton } from "@/components/site/link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { internalPath } from "@/src/i18n/locale-path";
import { getTranslations, translateError } from "@/src/i18n/server";
import { emailConfirmationPending } from "@/src/server/commands/context";
import { emailVerificationRequired } from "@/src/server/mail";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("confirmEmail.metaTitle") };
}

/**
 * Page du lien reçu par e-mail. La confirmation passe par le bouton (POST), jamais par l'ouverture du lien :
 * les antivirus de messagerie ouvrent les liens avant la personne.
 */
export default async function ConfirmEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string; ok?: string; suite?: string; compte?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const [t, user] = await Promise.all([getTranslations("auth"), currentUser()]);
  const suite = internalPath(query.suite);

  if (query.ok === "change") {
    return (
      <ConfirmCard title={t("confirmEmail.title")}>
        <Alert>
          <AlertDescription>
            {/* L'adresse vient de la session, jamais de l'URL : seul son propre compte s'affiche. */}
            {user && query.compte === "1" ? t("confirmEmail.changedTo", { email: user.email }) : t("confirmEmail.changed")}
          </AlertDescription>
        </Alert>
        <LinkButton href={user ? "/compte" : "/connexion"}>{user ? t("account.title") : t("confirmEmail.login")}</LinkButton>
      </ConfirmCard>
    );
  }

  if (query.ok === "verify") {
    const next = suite?.startsWith("/inviter/")
      ? { href: suite, label: t("confirmEmail.resumeInvite") }
      : user
        ? { href: "/", label: t("confirmEmail.myLists") }
        : { href: `/connexion?next=${encodeURIComponent(suite ?? "/")}`, label: t("confirmEmail.login") };
    return (
      <ConfirmCard title={t("confirmEmail.title")}>
        <Alert>
          <AlertDescription>{t("confirmEmail.verified")}</AlertDescription>
        </Alert>
        <LinkButton href={next.href}>{next.label}</LinkButton>
      </ConfirmCard>
    );
  }

  const preview = query.e ? null : await previewEmailConfirmation(await actionContext(), { token });
  if (!preview || !preview.ok) {
    const code = query.e ?? (preview && !preview.ok ? preview.error : "confirmationLinkInvalid");
    const message = code === "rate" ? t("confirmEmail.rateLimited") : await translateError(code);
    // Compte connecté encore à confirmer : un nouveau lien, sans repasser par le bandeau (US2).
    const canResend = Boolean(user && emailConfirmationPending(user));
    return (
      <ConfirmCard title={t("confirmEmail.invalidTitle")}>
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        {canResend ? (
          <form action={resendEmailVerificationAction} className="flex flex-col gap-2">
            <p className="text-muted-foreground">{t("confirmEmail.resendHint")}</p>
            <input type="hidden" name="back" value="/" />
            <Button type="submit" variant="neutral">
              {t("verifyBanner.resend")}
            </Button>
          </form>
        ) : null}
        {!user && emailVerificationRequired() ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground">{t("confirmEmail.loginToResend")}</p>
            <LinkButton href="/connexion" variant="neutral">
              {t("confirmEmail.login")}
            </LinkButton>
          </div>
        ) : null}
      </ConfirmCard>
    );
  }

  return (
    <ConfirmCard
      title={t("confirmEmail.title")}
      description={
        preview.purpose === "change"
          ? t("confirmEmail.changeDescription", { email: preview.email })
          : t("confirmEmail.verifyDescription", { email: preview.email })
      }
    >
      <form action={confirmEmailAction}>
        <input type="hidden" name="token" value={token} />
        {suite ? <input type="hidden" name="suite" value={suite} /> : null}
        <Button type="submit">{t("confirmEmail.submit")}</Button>
      </form>
    </ConfirmCard>
  );
}

function ConfirmCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
    </main>
  );
}
