import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ok } from "@/api/client";
import { signIn, useSession } from "@/auth/session";
import { AuthLayout } from "@/features/account/AuthLayout";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";

/** Connexion, d'après `02-connexion.png` (FR-001). */
export default function Login() {
  const { t } = useTranslation(["auth", "mobile"]);
  const session = useSession();
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useServerAction(
    useCallback(async () => {
      await signIn(await ok(api.POST("/auth/login", { body: { email: email.trim(), password } })));
    }, [email, password]),
  );

  return (
    <AuthLayout
      testID="login.screen"
      title={t("auth:login.title")}
      description={t("auth:login.description")}
      below={<Button title={t("auth:login.createAccount")} variant="neutral" onPress={() => router.push("/register")} testID="login.create-account" />}
    >
      {session.status === "signedOut" && session.expired ? <Alert>{t("mobile:session.expired")}</Alert> : null}
      {session.status === "signedOut" && session.deleted ? <Alert testID="login.deleted">{t("auth:account.deleted")}</Alert> : null}
      <Field label={t("auth:login.email")}>
        <Input
          testID="login.email"
          accessibilityLabel={t("auth:login.email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
      </Field>
      <Field label={t("auth:login.password")}>
        <Input
          testID="login.password"
          accessibilityLabel={t("auth:login.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => void login.run()}
        />
      </Field>
      {login.error ? <Alert variant="destructive" testID="login.error">{login.error}</Alert> : null}
      <Button
        title={t("auth:login.submit")}
        fullWidth
        testID="login.submit"
        disabled={!online || login.busy}
        onPress={() => void login.run()}
      />
      <NetworkNote />
      <Button title={t("auth:login.forgot")} variant="link" onPress={() => router.push("/forgot-password")} testID="login.forgot" />
    </AuthLayout>
  );
}
