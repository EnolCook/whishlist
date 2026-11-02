import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ApiError, ok } from "@/api/client";
import { getSession, signIn } from "@/auth/session";
import { AuthLayout } from "@/features/account/AuthLayout";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";

const DEAD_LINK = new Set(["resetLinkInvalid", "resetLinkExpired"]);

/**
 * Lien de réinitialisation ouvert dans l'app (011, R7) : même formulaire que `/reinitialiser/{token}`.
 * Sans personne de connecté, le serveur ouvre aussi une session et l'app va aux listes ; connecté à un
 * autre compte, la session de l'app ne change pas. La règle de longueur est celle du serveur.
 */
export default function ResetPasswordLink() {
  const { t } = useTranslation(["auth", "mobile"]);
  const { token } = useLocalSearchParams<{ token: string }>();
  const online = useOnline();
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [deadLink, setDeadLink] = useState(false);
  const save = useServerAction(
    useCallback(async () => {
      setDeadLink(false);
      const wantSession = getSession().status === "signedOut";
      try {
        const answer = await ok(
          api.POST("/auth/password-reset/confirm", { body: { token, password, signIn: wantSession } }),
        );
        if (answer.session) {
          await signIn(answer.session);
          router.replace("/");
          return;
        }
        setSaved(true);
      } catch (error) {
        if (error instanceof ApiError && DEAD_LINK.has(error.code)) setDeadLink(true);
        throw error;
      }
    }, [token, password]),
  );

  if (saved) {
    return (
      <AuthLayout title={t("auth:reset.title")} testID="reset-password.screen">
        <Alert testID="reset-password.done">{t("mobile:links.passwordSaved")}</Alert>
        <Button testID="reset-password.login" title={t("auth:confirmEmail.login")} fullWidth onPress={() => router.replace("/login")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth:reset.title")} description={t("auth:reset.description")} testID="reset-password.screen">
      <Field label={t("auth:reset.password")} description={t("auth:reset.passwordHint")}>
        <Input
          testID="reset-password.password"
          accessibilityLabel={t("auth:reset.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
      </Field>
      {save.error ? (
        <Alert testID="reset-password.error" variant="destructive">
          {save.error}
        </Alert>
      ) : null}
      {deadLink ? (
        <Button
          testID="reset-password.new-link"
          title={t("auth:reset.newLink")}
          variant="neutral"
          onPress={() => router.replace("/forgot-password")}
        />
      ) : null}
      <Button
        testID="reset-password.submit"
        title={t("auth:reset.submit")}
        fullWidth
        disabled={!online || save.busy || deadLink}
        onPress={() => void save.run()}
      />
      <NetworkNote />
    </AuthLayout>
  );
}
