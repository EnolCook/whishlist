import { router } from "expo-router";
import type { ReactNode } from "react";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";

import { usePendingCount } from "@/data/store";
import type { ViewList } from "@/offline/optimistic";
import { tokens } from "@/theme/tokens";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { Empty } from "@/ui/Empty";
import { ListCover } from "@/ui/ListCover";
import { LiveGiftMark } from "@/ui/LiveGiftMark";
import { OfflineBanner } from "@/ui/OfflineBanner";
import { PendingBadge } from "@/ui/PendingBadge";
import { PillTabs } from "@/ui/PillTabs";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

import { useList } from "./ListContext";

export type ListTab = "idees" | "archives" | "reservations" | "partage" | "reglages";

const routes: Record<ListTab, string> = {
  idees: "",
  archives: "/archives",
  reservations: "/reservations",
  partage: "/share",
  reglages: "/settings",
};

function tabLabels(list: ViewList, t: (key: string) => string) {
  const active = list.items.filter((item) => !item.archived).length;
  const archived = list.items.length - active;
  return [
    { key: "idees", label: `${t("tabs.idees")} (${active})` },
    { key: "archives", label: `${t("tabs.archives")} (${archived})` },
    { key: "reservations", label: `${t("tabs.reservations")} (${list.reservations.length})` },
    { key: "partage", label: t("tabs.partage") },
    { key: "reglages", label: t("tabs.reglages") },
  ];
}

function isTab(key: string): key is ListTab {
  return key in routes;
}

/**
 * Écran d'une liste, d'après `06-liste-idees.png` : cadeau encadré + titre, « Voir la liste partagée »,
 * onglets en pastilles avec leurs compteurs, puis le contenu de l'onglet. Rafraîchi en tirant (FR-017).
 */
export function ListScreen({ tab, children }: { tab: ListTab; children: (list: ViewList) => ReactNode }) {
  const { t } = useTranslation(["list", "mobile", "home"]);
  const { list, listId, loaded, settled, missing, fetchedAt, refreshing, refresh } = useList();
  const pendingCount = usePendingCount();

  if (missing) {
    return (
      <Screen>
        <BackLink />
        <Empty title={t("mobile:lists.missing")}>
          <Button title={t("home:mine.title")} onPress={() => router.replace("/")} />
        </Empty>
      </Screen>
    );
  }
  if (!list && loaded && settled && !refreshing) {
    // Jamais ouverte sur ce téléphone, et le serveur ne répond pas.
    return (
      <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
        <BackLink />
        <Empty title={t("mobile:offline.unreachable")}>
          <Button title={t("mobile:retry")} onPress={() => void refresh()} />
        </Empty>
      </Screen>
    );
  }
  if (!list) return <LiveGiftMark />;

  return (
    <Screen
      testID="list.screen"
      header={<OfflineBanner fetchedAt={fetchedAt} pendingCount={pendingCount} />}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
    >
      <BackLink />
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3] }}>
        <ListCover coverImageUrl={list.coverImageUrl} theme={list.theme} size={56} />
        <View style={{ flex: 1, gap: tokens.space[1] }}>
          <Text size="title" accessibilityRole="header">
            {list.title}
          </Text>
          {list.pending ? <PendingBadge /> : null}
        </View>
      </View>
      {list.readUrl ? (
        <Button title={t("list:viewAsGuest")} variant="neutral" onPress={() => void Linking.openURL(list.readUrl)} />
      ) : null}
      <PillTabs
        tabs={tabLabels(list, (key) => t(`list:${key}`))}
        active={tab}
        onChange={(key) => {
          if (isTab(key) && key !== tab) router.replace(`/lists/${listId}${routes[key]}`);
        }}
      />
      {children(list)}
    </Screen>
  );
}
