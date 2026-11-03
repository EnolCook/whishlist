import { useCameraPermissions } from "expo-camera";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";

import { extractReadToken } from "../../../../src/domain/read-link";
import { followList } from "@/data/subscriptions";
import { errorText } from "@/features/errors";
import { QrScanner } from "@/features/follow/QrScanner";
import { translateError } from "@/i18n";
import { useOnline } from "@/network";
import { Alert } from "@/ui/Alert";
import { BackLink } from "@/ui/BackLink";
import { BrandHeader } from "@/ui/BrandHeader";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * Écran « Suivre une liste » : colle un lien public, ou scanne son QR code (écran « Partager » d'un proche,
 * US4), et saisit le mot de passe de lecture si `423`.
 */
export default function FollowSharedList() {
  const { t } = useTranslation("mobile");
  const online = useOnline();
  const [urlOrToken, setUrlOrToken] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [lockedTitle, setLockedTitle] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);

  async function startScan() {
    setError(null);
    const granted = permission?.granted || (await requestPermission()).granted;
    setCameraDenied(!granted);
    setScanning(granted);
  }

  /** Un QR code qui n'est pas le lien d'une liste est refusé ici, sans appel au serveur ; le scan continue. */
  function onScanned(data: string) {
    if (busy) return;
    if (!extractReadToken(data)) {
      setError(t("shared.scanInvalid"));
      return;
    }
    setScanning(false);
    setUrlOrToken(data);
    setNeedsPassword(false);
    setLockedTitle(null);
    setPassword("");
    void submit(data, false);
  }

  async function submit(link = urlOrToken, withPassword = needsPassword) {
    setBusy(true);
    setError(null);
    try {
      const result = await followList({
        urlOrToken: link,
        password: withPassword ? password : undefined,
      });
      if (!result.ok) {
        if ("title" in result) {
          setNeedsPassword(true);
          setLockedTitle(result.title);
          return;
        }
        setError(translateError(result.error));
        return;
      }
      router.replace(`/guest/${result.subscription.readToken}` as Href);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="follow.screen">
      <BrandHeader />
      <BackLink />
      <Card>
        <CardHeader>
          <CardTitle>{t("shared.followTitle")}</CardTitle>
          <CardDescription>{t("shared.followDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label={t("shared.linkLabel")}>
            <Input
              testID="follow.link"
              accessibilityLabel={t("shared.linkLabel")}
              placeholder={t("shared.linkPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              value={urlOrToken}
              onChangeText={(value) => {
                setUrlOrToken(value);
                if (needsPassword) {
                  setNeedsPassword(false);
                  setLockedTitle(null);
                  setPassword("");
                }
              }}
            />
          </Field>
          {scanning ? (
            <>
              <Text size="sm">{t("shared.scanHint")}</Text>
              <QrScanner testID="follow.camera" onScanned={onScanned} />
              <Button testID="follow.scan-stop" title={t("shared.scanStop")} variant="neutral" fullWidth onPress={() => setScanning(false)} />
            </>
          ) : (
            <Button
              testID="follow.scan"
              title={t("shared.scanButton")}
              variant="neutral"
              fullWidth
              disabled={busy || !online}
              onPress={() => void startScan()}
            />
          )}
          {cameraDenied ? (
            <Alert testID="follow.camera-denied">
              {t("shared.cameraDenied")}
            </Alert>
          ) : null}
          {cameraDenied ? (
            <Button
              testID="follow.open-settings"
              title={t("shared.openSettings")}
              variant="link"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          {needsPassword ? (
            <Field label={t("shared.passwordLabel")} description={t("shared.passwordHint")}>
              {lockedTitle ? (
                <Text weight="heading" testID="follow.locked-title">
                  {lockedTitle}
                </Text>
              ) : null}
              <Input
                testID="follow.password"
                accessibilityLabel={t("shared.passwordLabel")}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </Field>
          ) : null}
          {error ? (
            <Alert variant="destructive" testID="follow.error">
              {error}
            </Alert>
          ) : null}
          <NetworkNote />
          <Button
            testID="follow.submit"
            title={t("shared.submitFollow")}
            fullWidth
            disabled={busy || !online}
            onPress={() => void submit()}
          />
        </CardContent>
      </Card>
    </Screen>
  );
}
