import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { BUDGETS, filterAndSortPublicItems, parseBudget } from "../../../../src/domain/filters";
import type { Schemas } from "@/api/client";
import { useSession } from "@/auth/session";
import { useIsFollowed } from "@/data/store";
import { unlockGuestList } from "@/features/guest/api";
import { GuestFollow } from "@/features/guest/GuestFollow";
import { GuestItemCard } from "@/features/guest/GuestItemCard";
import { GuestListHeader } from "@/features/guest/GuestListHeader";
import { memberListIdFor, useGuestList } from "@/features/guest/useGuestList";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { ListThemeProvider } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";
import { OfflineBanner } from "@/ui/OfflineBanner";
import { PillTabs } from "@/ui/PillTabs";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const ALL = "all";

/**
 * Vue publique d'une liste, ouverte par son lien (011, US4) ou depuis « Listes suivies » (012), comme la page
 * `/l/{readToken}` du site : idées libres et celles réservées par ce téléphone (ou ce compte), filtres par
 * catégorie, « Pour qui ? » et budget, tri par envie, « Réserver ce cadeau », et avec un compte « Suivre cette
 * liste » / « Ne plus suivre ». Aucune action de membre (FR-010b). Un membre arrive sur sa vue membre, sauf
 * depuis « Voir comme un invité » (`preview=1`). Une liste suivie se relit hors ligne (copie locale).
 */
export default function GuestList() {
  const { t } = useTranslation(["public", "mobile"]);
  const { readToken, typeId, preview } = useLocalSearchParams<{ readToken: string; typeId?: string; preview?: string }>();
  const session = useSession();
  // Connecté : on cherche d'abord si le compte est membre (copie locale), avant tout appel au serveur (R9).
  const mustCheck = session.status === "signedIn" && preview !== "1";
  const [checked, setChecked] = useState(!mustCheck);
  const { state, reload } = useGuestList(readToken, checked || !mustCheck);
  // De retour sur la liste (après une réservation, par exemple) : relue, pour montrer « Réservé par vous ».
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) reload();
      focusedOnce.current = true;
    }, [reload]),
  );

  useEffect(() => {
    if (!mustCheck) return;
    let active = true;
    void memberListIdFor(readToken).then((listId) => {
      if (!active) return;
      if (listId) router.replace(`/lists/${listId}` as Href);
      else setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [mustCheck, readToken]);

  if (state.status === "loading") {
    return (
      <Screen testID="guest.screen">
        <BackLink />
        <Text>{t("mobile:loading")}</Text>
      </Screen>
    );
  }
  if (state.status === "missing") {
    return (
      <Screen testID="guest.screen">
        <BackLink />
        <Empty testID="guest.missing" title={t("public:missingList")} />
      </Screen>
    );
  }
  if (state.status === "failed") {
    return (
      <Screen testID="guest.screen">
        <BackLink />
        <Alert testID="guest.error" variant="destructive">
          {state.message}
        </Alert>
        <Button testID="guest.retry" title={t("mobile:retry")} variant="neutral" onPress={reload} />
      </Screen>
    );
  }
  if (state.status === "locked") return <Unlock readToken={readToken} onUnlocked={reload} />;
  return (
    <ListThemeProvider theme={state.list.theme}>
      <Ready readToken={readToken} list={state.list} fetchedAt={state.fetchedAt} initialType={typeId} reload={reload} />
    </ListThemeProvider>
  );
}

/**
 * Liste protégée : le mot de passe transmis avec le lien, comme `ReadUnlockForm` du site. Une liste suivie
 * dont le mot de passe a changé se quitte aussi d'ici, sans la déverrouiller.
 */
function Unlock({ readToken, onUnlocked }: { readToken: string; onUnlocked: () => void }) {
  const { t } = useTranslation("public");
  const online = useOnline();
  const followed = useIsFollowed(readToken);
  const [password, setPassword] = useState("");
  const unlock = useServerAction(
    useCallback(async () => {
      await unlockGuestList(readToken, password);
      onUnlocked();
    }, [readToken, password, onUnlocked]),
  );
  return (
    <Screen testID="guest.screen">
      <BackLink />
      <Card>
        <CardHeader>
          <CardTitle>{t("unlock.heading")}</CardTitle>
          <CardDescription>{t("unlock.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label={t("unlock.password")} description={t("unlock.passwordHint")}>
            <Input
              testID="guest.password"
              accessibilityLabel={t("unlock.password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="off"
            />
          </Field>
          {unlock.error ? (
            <Alert testID="guest.unlock-error" variant="destructive">
              {unlock.error}
            </Alert>
          ) : null}
          <Button
            testID="guest.unlock"
            title={t("unlock.submit")}
            fullWidth
            disabled={!online || unlock.busy || !password}
            onPress={() => void unlock.run()}
          />
          <NetworkNote />
        </CardContent>
      </Card>
      {followed ? <GuestFollow readToken={readToken} subscribed onChanged={() => router.replace("/")} /> : null}
    </Screen>
  );
}

function Ready({
  readToken,
  list,
  fetchedAt,
  initialType,
  reload,
}: {
  readToken: string;
  list: Schemas["PublicList"];
  fetchedAt: string | null;
  initialType?: string;
  reload: () => void;
}) {
  const { t } = useTranslation("public");
  const categories = useMemo(
    () =>
      [...list.categories]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((category) => list.items.some((item) => item.typeId === category.id)),
    [list],
  );
  const [type, setType] = useState(categories.find((category) => category.id === initialType)?.id ?? ALL);
  const [who, setWho] = useState(ALL);
  const [budgetKey, setBudgetKey] = useState(ALL);
  const person = list.people.some((entry) => entry.id === who) ? who : null;
  const budget = parseBudget(budgetKey === ALL ? undefined : budgetKey);
  // Mêmes filtres et même ordre que la page publique du site : envie d'abord, puis l'ordre du propriétaire.
  const filtered = filterAndSortPublicItems(list.items, person, budget);
  const items = type === ALL ? filtered : filtered.filter((item) => item.typeId === type);
  const narrowed = person !== null || budget !== null;

  return (
    <Screen
      testID="guest.screen"
      header={fetchedAt ? <OfflineBanner fetchedAt={fetchedAt} pendingCount={0} /> : undefined}
      onRefresh={reload}
    >
      <BackLink />
      <GuestListHeader list={list} />
      <Text size="sm" color={tokens.colors.mutedForeground}>
        {t("intro")}
      </Text>
      <GuestFollow readToken={readToken} subscribed={list.subscribed} isMember={list.isMember} onChanged={reload} />
      {categories.length > 1 ? (
        <PillTabs
          scroll
          tabs={[{ key: ALL, label: t("allList") }, ...categories.map((category) => ({ key: category.id, label: category.label }))]}
          active={type}
          onChange={setType}
        />
      ) : null}
      {list.people.length > 1 ? (
        <View style={{ gap: tokens.space[1] }}>
          <Text size="sm" color={tokens.colors.mutedForeground}>
            {t("who")}
          </Text>
          <PillTabs
            scroll
            tabs={[{ key: ALL, label: t("everyone") }, ...list.people.map((entry) => ({ key: entry.id, label: entry.label }))]}
            active={person ?? ALL}
            onChange={setWho}
          />
        </View>
      ) : null}
      <View style={{ gap: tokens.space[1] }}>
        <Text size="sm" color={tokens.colors.mutedForeground}>
          {t("budget")}
        </Text>
        <PillTabs
          scroll
          tabs={[{ key: ALL, label: t("allPrices") }, ...BUDGETS.map(({ id }) => ({ key: id, label: t(`budgets.${id}`) }))]}
          active={budget ?? ALL}
          onChange={setBudgetKey}
        />
      </View>
      {items.length === 0 ? (
        <Empty
          testID="guest.empty"
          title={narrowed ? t("emptyFiltered") : t("emptyList")}
          description={narrowed ? t("emptyHint") : t("emptyListHint")}
        />
      ) : (
        items.map((item, index) => (
          <GuestItemCard key={item.id} index={index} readToken={readToken} list={list} item={item} onCancelled={reload} />
        ))
      )}
    </Screen>
  );
}
