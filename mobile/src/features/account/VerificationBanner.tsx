import { useCallback, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { api, ok } from "@/api/client";
import { useSession } from "@/auth/session";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { NetworkNote } from "@/ui/NetworkNote";

/** Vrai si le serveur exige la validation et que l'adresse du compte n'est pas encore confirmée (010). */
export function useEmailUnverified(): boolean {
  const session = useSession();
  return session.status === "signedIn" && session.user?.emailVerified === false;
}

/**
 * Rappel de confirmer son adresse, comme le bandeau du site, avec « Renvoyer le lien » (US2) ;
 * il disparaît à la relecture du compte.
 */
export function VerificationBanner() {
  const { t } = useTranslation("auth");
  const unverified = useEmailUnverified();
  const online = useOnline();
  const [sent, setSent] = useState<boolean | null>(null);
  const resend = useServerAction(
    useCallback(async () => {
      setSent(null);
      const answer = await ok(api.POST("/me/email-verification"));
      setSent(answer.sent);
    }, []),
  );
  if (!unverified) return null;
  return (
    <View style={{ gap: tokens.space[2] }}>
      <Alert
        testID="verify.banner"
        actions={
          <Button
            testID="verify.resend"
            title={t("verifyBanner.resend")}
            variant="neutral"
            size="sm"
            disabled={!online || resend.busy}
            onPress={() => void resend.run()}
          />
        }
      >
        {t("verifyBanner.message")}
      </Alert>
      {sent !== null ? <Alert testID="verify.sent">{t(sent ? "verifyBanner.sent" : "verifyBanner.failed")}</Alert> : null}
      {resend.error ? <Alert variant="destructive">{resend.error}</Alert> : null}
      <NetworkNote />
    </View>
  );
}
