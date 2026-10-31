import Constants from "expo-constants";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";

import { api, ok } from "@/api/client";
import { signOut, updateMe, useSession } from "@/auth/session";
import { usePendingCount } from "@/data/store";
import { exportData } from "@/features/account/exportData";
import { PasswordForm } from "@/features/account/PasswordForm";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";
import { PageTitle } from "@/ui/PageTitle";
import { Screen } from "@/ui/Screen";
import { Separator } from "@/ui/Separator";
import { Text } from "@/ui/Text";

import { CONTACT_EMAIL } from "../../../src/site/contact";

/**
 * Mon compte, d'après `11-compte.png`, ouvert par le bouton du haut de « Mes listes » :
 * nom affiché, mot de passe, puis tout en bas (FR-001 de la 006) : données et informations,
 * déconnexion, et suppression du compte en dernier.
 * Hors ligne, seuls le nom, les pages légales et la déconnexion restent utilisables.
 */
export default function Account() {
  const { t } = useTranslation(["auth", "common", "content", "mobile"]);
  const session = useSession();
  const online = useOnline();
  const pendingCount = usePendingCount();
  const user = session.status === "signedIn" ? session.user : null;
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameSaved, setNameSaved] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const saveName = useServerAction(
    useCallback(async () => {
      setNameSaved(false);
      await updateMe(await ok(api.PATCH("/me", { body: { displayName: displayName.trim() } })));
      setNameSaved(true);
    }, [displayName]),
  );

  const download = useServerAction(
    useCallback(async () => {
      await exportData(t("auth:account.exportAction"));
    }, [t]),
  );

  function logout() {
    // Des changements jamais envoyés seraient perdus : on demande d'abord (FR-029c).
    if (pendingCount > 0) setConfirmLogout(true);
    else void signOut();
  }

  return (
    <Screen testID="account.screen">
      <BackLink />
      <PageTitle title={t("auth:account.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("auth:account.profile")}</CardTitle>
          <CardDescription>{t("auth:account.profileHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label={t("auth:account.displayName")}>
            <Input
              testID="account.name"
              accessibilityLabel={t("auth:account.displayName")}
              value={displayName}
              onChangeText={setDisplayName}
              editable={online}
              autoComplete="name"
            />
          </Field>
          <Field label={t("auth:account.email")} description={t("auth:account.emailHint")}>
            <Input accessibilityLabel={t("auth:account.email")} value={user?.email ?? ""} editable={false} muted />
          </Field>
          {saveName.error ? <Alert variant="destructive">{saveName.error}</Alert> : null}
          {nameSaved ? <Alert>{t("auth:account.nameSaved")}</Alert> : null}
          <Button testID="account.save-name" title={t("auth:account.saveName")} fullWidth disabled={!online || saveName.busy} onPress={() => void saveName.run()} />
          <NetworkNote />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("auth:changePassword.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("auth:account.dataTitle")}</CardTitle>
          <CardDescription>{t("auth:account.dataHint")}</CardDescription>
        </CardHeader>
        <CardContent style={{ alignItems: "flex-start" }}>
          <Button testID="account.legal" title={t("content:legal.title")} variant="link" onPress={() => router.push("/legal/mentions")} />
          <Button testID="account.privacy" title={t("content:privacy.title")} variant="link" onPress={() => router.push("/legal/privacy")} />
          <View style={{ gap: tokens.space[1] }}>
            <Button
              testID="account.export"
              title={t("auth:account.exportAction")}
              variant="link"
              disabled={!online || download.busy}
              onPress={() => void download.run()}
            />
            <Text size="sm" color={tokens.colors.mutedForeground}>
              {t("auth:account.exportHint")}
            </Text>
            {download.error ? <Alert variant="destructive" testID="account.export-error">{download.error}</Alert> : null}
            <NetworkNote />
          </View>
          <Button testID="account.licenses" title={t("mobile:account.licenses")} variant="link" onPress={() => router.push("/legal/licenses")} />
          <Button
            testID="account.contact"
            title={t("mobile:account.contact")}
            variant="link"
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          />
          <Text testID="account.version" size="sm" color={tokens.colors.mutedForeground}>
            {t("mobile:account.version", { version: Constants.expoConfig?.version ?? "" })}
          </Text>
        </CardContent>
      </Card>
      <Button testID="account.logout" title={t("common:nav.logout")} variant="neutral" fullWidth onPress={logout} />
      <Separator />
      <View style={{ gap: tokens.space[2], marginBottom: tokens.space[2] }}>
        <Button
          title={t("auth:account.deleteAction")}
          variant="destructive"
          fullWidth
          disabled={!online}
          onPress={() => router.push("/delete-account")}
          testID="delete-account"
        />
        <NetworkNote />
      </View>
      <ConfirmDialog
        visible={confirmLogout}
        title={t("mobile:offline.logoutTitle")}
        body={t("mobile:offline.logoutWarning", { count: pendingCount })}
        confirmLabel={t("mobile:offline.logoutConfirm")}
        keepLabel={t("mobile:offline.logoutKeep")}
        onConfirm={() => {
          setConfirmLogout(false);
          void signOut();
        }}
        onKeep={() => setConfirmLogout(false)}
        testID="account.logout-confirm"
      />
    </Screen>
  );
}
