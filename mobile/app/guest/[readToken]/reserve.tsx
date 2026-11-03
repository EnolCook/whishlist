import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, type Schemas } from "@/api/client";
import { reserveGuestItem } from "@/features/guest/api";
import { useGuestList } from "@/features/guest/useGuestList";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { ListThemeProvider } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";
import { Screen } from "@/ui/Screen";
import { Select } from "@/ui/Select";
import { Text } from "@/ui/Text";

/**
 * « Réserver un cadeau » de la vue invité (011, US4), comme `/l/{readToken}/reserver` du site : l'idée
 * choisie, ou une catégorie puis une idée, le nom et le message facultatifs. Toujours en ligne : une
 * réservation n'est jamais mise en attente (FR-010b). Une idée prise entre-temps est refusée par le serveur.
 */
export default function GuestReserve() {
  const { t } = useTranslation(["public", "mobile"]);
  const { readToken, itemId, typeId } = useLocalSearchParams<{ readToken: string; itemId?: string; typeId?: string }>();
  const { state, reload } = useGuestList(readToken);

  if (state.status !== "ready") {
    return (
      <Screen testID="guest-reserve.screen">
        <BackLink />
        {state.status === "loading" ? <Text>{t("mobile:loading")}</Text> : null}
        {state.status === "failed" ? (
          <>
            <Alert variant="destructive">{state.message}</Alert>
            <Button title={t("mobile:retry")} variant="neutral" onPress={reload} />
          </>
        ) : null}
        {state.status === "missing" ? <Alert variant="destructive">{t("public:missingList")}</Alert> : null}
        {state.status === "locked" ? (
          // Le mot de passe se saisit sur la vue de la liste.
          <Button title={t("public:reserve.back")} onPress={() => router.replace(`/guest/${readToken}` as Href)} />
        ) : null}
      </Screen>
    );
  }
  return (
    <ListThemeProvider theme={state.list.theme}>
      <ReserveForm readToken={readToken} list={state.list} itemId={itemId} typeId={typeId} reload={reload} />
    </ListThemeProvider>
  );
}

function ReserveForm({
  readToken,
  list,
  itemId,
  typeId,
  reload,
}: {
  readToken: string;
  list: Schemas["PublicList"];
  itemId?: string;
  typeId?: string;
  reload: () => void;
}) {
  const { t } = useTranslation("public");
  const online = useOnline();
  const free = list.items.filter((item) => !item.mine);
  const picked = itemId ? free.find((item) => item.id === itemId) : undefined;
  const categories = [...list.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((category) => free.some((item) => item.typeId === category.id));
  const [category, setCategory] = useState(categories.some((entry) => entry.id === typeId) ? typeId! : "");
  const choices = category ? free.filter((item) => item.typeId === category) : free;
  const [chosen, setChosen] = useState("");
  const target = picked?.id ?? (choices.some((item) => item.id === chosen) ? chosen : "");
  const [fromName, setFromName] = useState("");
  const [note, setNote] = useState("");

  // Sans useCallback : le React Compiler mémorise déjà ce composant.
  const reserve = useServerAction(async () => {
    try {
      await reserveGuestItem(readToken, { itemId: target, typeId: category || undefined, fromName, note });
    } catch (error) {
      // Idée prise entre-temps (sur le site ou un autre téléphone) : la liste relue ne la propose plus.
      if (error instanceof ApiError && error.status === 409) reload();
      throw error;
    }
    // Retour à la vue de la liste déjà ouverte (elle se relit au retour), sans l'empiler une seconde fois.
    if (router.canGoBack()) router.back();
    else router.replace(`/guest/${readToken}` as Href);
  });

  const unavailable = Boolean(itemId) && !picked;
  return (
    <Screen testID="guest-reserve.screen">
      <BackLink />
      <Text size="title" accessibilityRole="header">
        {t("reserve.title")}
      </Text>
      <Text color={tokens.colors.mutedForeground}>{t("reserve.listContext", { title: list.title })}</Text>
      {unavailable ? (
        <Alert testID="guest-reserve.unavailable" variant="destructive">
          {t("reserve.unavailable")}
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{picked ? t("reserve.offerTitle", { name: picked.name }) : t("reserve.typeTitle")}</CardTitle>
          <CardDescription>{t("reserve.noPurchaseHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!picked ? (
            <>
              {categories.length > 1 ? (
                <Field label={t("reserve.filterLabel")}>
                  <Select
                    label={t("reserve.filterLabel")}
                    value={category}
                    options={[
                      { value: "", label: t("reserve.allTypes") },
                      ...categories.map((entry) => ({ value: entry.id, label: entry.label })),
                    ]}
                    onChange={(value) => {
                      setCategory(value);
                      setChosen("");
                    }}
                  />
                </Field>
              ) : null}
              <Field label={t("reserve.giftLabel")}>
                <Select
                  label={t("reserve.giftLabel")}
                  value={target}
                  placeholder={t("reserve.giftLabel")}
                  options={choices.map((item) => ({ value: item.id, label: item.name }))}
                  onChange={setChosen}
                />
              </Field>
            </>
          ) : null}
          <Field label={t("reserve.fromName")}>
            <Input
              testID="guest-reserve.from-name"
              accessibilityLabel={t("reserve.fromName")}
              value={fromName}
              onChangeText={setFromName}
              autoComplete="name"
              maxLength={200}
            />
          </Field>
          <Field label={t("reserve.note")} description={t("reserve.privacyHint")}>
            <Input
              testID="guest-reserve.note"
              accessibilityLabel={t("reserve.note")}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={2000}
            />
          </Field>
          {reserve.error ? (
            <Alert testID="guest-reserve.error" variant="destructive">
              {reserve.error}
            </Alert>
          ) : null}
          <Button
            testID="guest-reserve.submit"
            title={t("reserve.submit")}
            fullWidth
            disabled={!online || reserve.busy || !target}
            onPress={() => void reserve.run()}
          />
          <NetworkNote />
        </CardContent>
      </Card>
    </Screen>
  );
}
