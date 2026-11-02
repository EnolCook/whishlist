"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { DevLinkAlert } from "@/components/site/dev-link-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { stripLocalePrefix } from "@/src/i18n/locale-path";
import { resendEmailVerificationAction } from "@/src/server/actions";

/** Clé du message de retour d'un renvoi (`?verify=`), ou null pour une valeur inconnue. */
function feedbackKey(verify: string | null): string | null {
  switch (verify) {
    case "sent":
      return "verifyBanner.sent";
    case "failed":
      return "verifyBanner.failed";
    case "rate":
      return "verifyBanner.rateLimited";
    case "already":
      return "verifyBanner.already";
    default:
      return null;
  }
}

/** Rappel affiché à un compte dont l'adresse n'est pas confirmée (010, US1), sauf sur la page du lien elle-même. */
export function EmailVerificationBanner({ origin }: { origin: string }) {
  return (
    <Suspense fallback={null}>
      <Banner origin={origin} />
    </Suspense>
  );
}

function Banner({ origin }: { origin: string }) {
  const { t } = useTranslation("auth");
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const path = stripLocalePrefix(pathname).path;
  if (path.startsWith("/confirmer-email/")) return null;

  // Retour sur cette page après le renvoi, sans le résultat d'un renvoi précédent.
  const kept = new URLSearchParams(searchParams.toString());
  const verify = kept.get("verify");
  const devLink = kept.get("lien");
  kept.delete("verify");
  kept.delete("lien");
  const back = kept.size > 0 ? `${path}?${kept.toString()}` : path;
  const key = feedbackKey(verify);
  const feedback = key ? t(key) : null;

  return (
    <Alert>
      <AlertDescription className="flex flex-col gap-2">
        <span>{t("verifyBanner.message")}</span>
        {feedback ? <span role="status">{feedback}</span> : null}
        {verify === "sent" ? <DevLinkAlert label={t("verifyBanner.devLink")} url={devLink} origin={origin} page="/confirmer-email/" /> : null}
        <form action={resendEmailVerificationAction}>
          <input type="hidden" name="back" value={back} />
          <Button type="submit" variant="neutral" size="sm">
            {t("verifyBanner.resend")}
          </Button>
        </form>
      </AlertDescription>
    </Alert>
  );
}
