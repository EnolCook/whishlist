import { router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, NetworkError, ok } from "@/api/client";
import { refreshMe, useSession } from "@/auth/session";
import { AuthLayout } from "@/features/account/AuthLayout";
import { VerificationBanner } from "@/features/account/VerificationBanner";
import { errorText } from "@/features/errors";
import { appPathForUrl } from "@/links/routes";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

type Outcome =
  | { status: "pending" }
  | { status: "done"; purpose: "verify" | "change"; ownAccount: boolean; suite: string | null }
  | { status: "failed"; message: string; retry: boolean };

/**
 * Lien de confirmation d'adresse ouvert dans l'app (011, R6) : confirmé dès l'ouverture, sans bouton.
 * Le site garde son bouton parce que les antivirus de messagerie ouvrent les liens web ; ils n'ouvrent pas l'app.
 * L'adresse n'est jamais affichée : le lien peut être celui d'un autre compte.
 */
export default function ConfirmEmailLink() {
  const { t } = useTranslation(["auth", "mobile"]);
  const { token, suite } = useLocalSearchParams<{ token: string; suite?: string }>();
  const session = useSession();
  const signedIn = session.status === "signedIn";
  const [outcome, setOutcome] = useState<Outcome>({ status: "pending" });
  const started = useRef(false);

  const confirm = useCallback(async () => {
    setOutcome({ status: "pending" });
    try {
      const answer = await ok(api.POST("/auth/email-confirmation", { body: { token, suite: suite || undefined } }));
      setOutcome({ status: "done", ...answer });
      // Le bandeau « confirmez votre adresse » et « Mon compte » suivent le compte relu.
      await refreshMe().catch(() => undefined);
    } catch (error) {
      setOutcome({ status: "failed", message: errorText(error), retry: error instanceof NetworkError });
    }
  }, [token, suite]);

  useEffect(() => {
    // Une seule tentative à l'ouverture : un second envoi du même jeton serait refusé (déjà utilisé).
    if (started.current) return;
    started.current = true;
    void confirm();
  }, [confirm]);

  const next = nextStep(outcome, signedIn, t);
  return (
    <AuthLayout title={t("auth:confirmEmail.title")} testID="confirm-email.screen">
      {outcome.status === "pending" ? <Text testID="confirm-email.pending">{t("mobile:links.confirming")}</Text> : null}
      {outcome.status === "done" ? (
        <Alert testID="confirm-email.status">
          {t(outcome.purpose === "change" ? "auth:confirmEmail.changed" : "auth:confirmEmail.verified")}
        </Alert>
      ) : null}
      {outcome.status === "failed" ? (
        <>
          <Alert testID="confirm-email.error" variant="destructive">
            {outcome.message}
          </Alert>
          {outcome.retry ? (
            <Button testID="confirm-email.retry" title={t("mobile:retry")} variant="neutral" onPress={() => void confirm()} />
          ) : null}
          {/* Comme la page du site : sans session, comment redemander un lien. */}
          {!signedIn && !outcome.retry ? <Text testID="confirm-email.login-to-resend">{t("auth:confirmEmail.loginToResend")}</Text> : null}
          <VerificationBanner />
        </>
      ) : null}
      {next ? (
        <Button testID="confirm-email.next" title={next.label} fullWidth onPress={() => router.replace(next.href)} />
      ) : null}
    </AuthLayout>
  );
}

/**
 * Suite proposée, comme la page du site : l'invitation en cours, ses listes, « Mon compte » après un changement,
 * ou la connexion.
 */
function nextStep(
  outcome: Outcome,
  signedIn: boolean,
  t: (key: string) => string,
): { href: Href; label: string } | null {
  if (outcome.status === "pending" || (outcome.status === "failed" && outcome.retry)) return null;
  // Inscription depuis une invitation : on la reprend, comme la page du site (010, US1-6).
  const invite = outcome.status === "done" && outcome.suite?.startsWith("/inviter/") ? appPathForUrl(outcome.suite) : null;
  if (invite) return { href: invite as Href, label: t("auth:confirmEmail.resumeInvite") };
  if (outcome.status === "done" && outcome.purpose === "change" && outcome.ownAccount && signedIn) {
    return { href: "/account", label: t("auth:account.title") };
  }
  return signedIn
    ? { href: "/", label: t("auth:confirmEmail.myLists") }
    : { href: "/login", label: t("auth:confirmEmail.login") };
}
