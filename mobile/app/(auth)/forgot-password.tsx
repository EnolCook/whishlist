import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, done } from "@/api/client";
import { AuthLayout } from "@/features/account/AuthLayout";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";

/** Mot de passe oublié, comme la page `/mot-de-passe-oublie` du site : même message que l'e-mail ait un compte ou non (FR-006). */
export default function ForgotPassword() {
  const { t } = useTranslation("auth");
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const request = useServerAction(
    useCallback(async () => {
      await done(api.POST("/auth/password-reset", { body: { email: email.trim() } }));
      setSent(true);
    }, [email]),
  );

  return (
    <AuthLayout
      testID="forgot.screen"
      title={t("forgot.title")}
      description={t("forgot.description")}
      below={<Button title={t("forgot.back")} variant="link" onPress={() => router.replace("/login")} testID="forgot.back" />}
    >
      {sent ? (
        <Alert testID="forgot.sent">{t("forgot.sent")}</Alert>
      ) : (
        <>
          <Field label={t("forgot.email")}>
            <Input
              testID="forgot.email"
              accessibilityLabel={t("forgot.email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          </Field>
          {request.error ? <Alert variant="destructive">{request.error}</Alert> : null}
          <Button testID="forgot.submit" title={t("forgot.submit")} fullWidth disabled={!online || request.busy} onPress={() => void request.run()} />
          <NetworkNote />
        </>
      )}
    </AuthLayout>
  );
}
