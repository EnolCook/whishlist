import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, apiErrorFrom } from "@/api/client";
import { signIn } from "@/auth/session";
import { AuthLayout } from "@/features/account/AuthLayout";
import { useServerAction } from "@/features/errors";
import { useNextLink } from "@/links/pending";
import { useOnline } from "@/network";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";

/** Création de compte, d'après `03-inscription.png` (FR-001). */
export default function Register() {
  const { t } = useTranslation("auth");
  const online = useOnline();
  useNextLink();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // 202 : l'e-mail a déjà un compte ; même message que le site, sans connexion.
  const [checkEmail, setCheckEmail] = useState(false);

  const register = useServerAction(
    useCallback(async () => {
      const { data, error, response } = await api.POST("/auth/register", {
        body: { email: email.trim(), password, displayName: displayName.trim() },
      });
      if (response.status === 202) {
        setCheckEmail(true);
        return;
      }
      if (!data || !("token" in data)) throw await apiErrorFrom(response, error);
      await signIn(data);
    }, [email, password, displayName]),
  );

  if (checkEmail) {
    return (
      <AuthLayout testID="register.screen" title={t("register.title")}>
        <Alert testID="register.sent">{t("register.sent")}</Alert>
        <Button title={t("register.sentContinue")} fullWidth onPress={() => router.replace("/login")} testID="register.sent-continue" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      testID="register.screen"
      title={t("register.title")}
      description={t("register.description")}
      below={<Button title={t("register.hasAccount")} variant="link" onPress={() => router.replace("/login")} />}
    >
      <Field label={t("register.name")} description={t("register.nameHint")}>
        <Input testID="register.name" accessibilityLabel={t("register.name")} value={displayName} onChangeText={setDisplayName} autoComplete="name" />
      </Field>
      <Field label={t("register.email")}>
        <Input
          testID="register.email"
          accessibilityLabel={t("register.email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
      </Field>
      <Field label={t("register.password")} description={t("register.passwordHint")}>
        <Input
          testID="register.password"
          accessibilityLabel={t("register.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </Field>
      {register.error ? <Alert variant="destructive" testID="register.error">{register.error}</Alert> : null}
      <Button testID="register.submit" title={t("register.submit")} fullWidth disabled={!online || register.busy} onPress={() => void register.run()} />
      <NetworkNote />
    </AuthLayout>
  );
}
