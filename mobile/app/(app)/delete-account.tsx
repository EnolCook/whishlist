import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { api, ok, type Schemas } from "@/api/client";
import { deleteAccount } from "@/auth/session";
import { usePendingCount } from "@/data/store";
import { errorText, useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";
import { PageTitle } from "@/ui/PageTitle";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

type Preview = Schemas["AccountDeletionPreview"];

/** Titres affichés par groupe ; au-delà, « et N de plus ». */
const SHOWN = 5;

function Titles({ titles }: { titles: string[] }) {
  const { t } = useTranslation("auth");
  const rest = titles.length - SHOWN;
  return (
    <View style={{ gap: tokens.space[1] }}>
      {titles.slice(0, SHOWN).map((title, index) => (
        <Text key={index} size="sm">
          {`• ${title}`}
        </Text>
      ))}
      {rest > 0 ? <Text size="sm">{`• ${t("account.deleteMore", { count: rest })}`}</Text> : null}
    </View>
  );
}

/**
 * Supprimer mon compte, même contenu que la confirmation du site : ce qui part, ce qui reste,
 * les changements jamais envoyés (FR-016), puis le mot de passe. Exige le réseau.
 */
export default function DeleteAccount() {
  const { t } = useTranslation(["auth", "mobile"]);
  const online = useOnline();
  const pendingCount = usePendingCount();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  // Relu à l'ouverture, au retour du réseau, et à chaque « Réessayer ».
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!online) return;
    let active = true;
    void (async () => {
      try {
        const fresh = await ok(api.GET("/me/deletion"));
        if (!active) return;
        setPreview(fresh);
        setLoadError(null);
      } catch (error) {
        if (active) setLoadError(errorText(error));
      }
    })();
    return () => {
      active = false;
    };
  }, [online, attempt]);

  const remove = useServerAction(
    useCallback(async () => {
      try {
        await deleteAccount(password);
      } catch (error) {
        setPassword("");
        throw error;
      }
    }, [password]),
  );

  return (
    <Screen testID="delete-account.screen">
      <BackLink />
      <PageTitle title={t("auth:account.deleteTitle")} />
      {!online ? (
        <NetworkNote />
      ) : loadError ? (
        <Alert variant="destructive" actions={<Button title={t("mobile:retry")} variant="neutral" size="sm" onPress={() => setAttempt((value) => value + 1)} />}>
          {loadError}
        </Alert>
      ) : !preview ? (
        <Text color={tokens.colors.mutedForeground}>{t("mobile:loading")}</Text>
      ) : (
        <>
          <Alert variant="destructive">{t("auth:account.deleteWarning")}</Alert>
          <Card testID="delete-account.summary">
            <CardHeader>
              <CardTitle>{t("auth:account.deleteRemoved")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Text size="sm">{t("auth:account.deleteRemovedAccount")}</Text>
              {preview.deletedLists.length > 0 ? (
                <View style={{ gap: tokens.space[1] }}>
                  <Text size="sm">{t("auth:account.deleteRemovedLists", { count: preview.deletedLists.length })}</Text>
                  <Titles titles={preview.deletedLists.map((list) => list.title)} />
                </View>
              ) : null}
              {/* `followedLists` n'existe pas avant l'API 1.7.0. */}
              {preview.followedLists && preview.followedLists.length > 0 ? (
                <View style={{ gap: tokens.space[1] }}>
                  <Text size="sm">{t("auth:account.deleteRemovedFollowed", { count: preview.followedLists.length })}</Text>
                  <Titles titles={preview.followedLists.map((list) => list.title)} />
                </View>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("auth:account.deleteKept")}</CardTitle>
            </CardHeader>
            <CardContent>
              {preview.transferredLists.length === 0 && preview.reservationsKept === 0 ? (
                <Text size="sm">{t("auth:account.deleteKeptNone")}</Text>
              ) : null}
              {preview.transferredLists.length > 0 ? (
                <View style={{ gap: tokens.space[1] }}>
                  <Text size="sm">{t("auth:account.deleteKeptLists", { count: preview.transferredLists.length })}</Text>
                  <Titles
                    titles={preview.transferredLists.map((list) =>
                      list.newOwnerName
                        ? t("auth:account.deleteNewOwner", { title: list.title, name: list.newOwnerName })
                        : list.title,
                    )}
                  />
                </View>
              ) : null}
              {preview.reservationsKept > 0 ? (
                <Text size="sm">{t("auth:account.deleteKeptReservations", { count: preview.reservationsKept })}</Text>
              ) : null}
            </CardContent>
          </Card>
          {pendingCount > 0 ? (
            <Alert variant="destructive">{t("mobile:offline.deletePending", { count: pendingCount })}</Alert>
          ) : null}
          <Card>
            <CardContent>
              <Field label={t("auth:account.deletePassword")} error={remove.error} errorTestID="delete-account.error">
                <Input
                  testID="delete-account.password"
                  accessibilityLabel={t("auth:account.deletePassword")}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  invalid={Boolean(remove.error)}
                />
              </Field>
              <Button
                testID="delete-account.confirm"
                title={t("auth:account.deleteConfirm")}
                variant="destructive"
                fullWidth
                disabled={!password || remove.busy}
                onPress={() => void remove.run()}
              />
              <Button testID="delete-account.cancel" title={t("auth:account.deleteCancel")} variant="link" onPress={() => router.back()} />
            </CardContent>
          </Card>
        </>
      )}
    </Screen>
  );
}
