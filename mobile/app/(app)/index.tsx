import { router } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { useMyLists, usePendingCount } from "@/data/store";
import { AppHeader } from "@/features/account/AppHeader";
import { tokens } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { GiftMark } from "@/ui/GiftMark";
import { ListCover } from "@/ui/ListCover";
import { LiveGiftMark } from "@/ui/LiveGiftMark";
import { OfflineBanner } from "@/ui/OfflineBanner";
import { PageTitle } from "@/ui/PageTitle";
import { PendingBadge } from "@/ui/PendingBadge";
import { RejectedAlert } from "@/ui/RejectedAlert";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Mes listes, d'après `04-mes-listes.png` (FR-010) ; copie locale et listes créées hors ligne (FR-025). */
export default function MyLists() {
  const { t } = useTranslation("home");
  const { lists, loaded, fetchedAt, refreshing, refresh } = useMyLists();
  const pendingCount = usePendingCount();
  const newList = <Button title={t("mine.newList")} size="sm" onPress={() => router.push("/lists/new")} testID="lists.new" />;

  if (!loaded) return <LiveGiftMark />;

  return (
    <Screen
      testID="lists.screen"
      header={<OfflineBanner fetchedAt={fetchedAt} pendingCount={pendingCount} />}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
    >
      <AppHeader />
      <PageTitle title={t("mine.title")} action={lists.length > 0 ? newList : undefined} />
      {lists.length === 0 ? (
        <Empty testID="lists.empty" title={t("mine.emptyTitle")} description={t("mine.emptyBody")} media={<GiftMark size={64} />}>
          <Button title={t("mine.newList")} onPress={() => router.push("/lists/new")} testID="lists.new" />
        </Empty>
      ) : (
        <View style={{ gap: tokens.space[3] }}>
          {lists.map((list) => (
            <View key={list.id} style={{ gap: tokens.space[2] }}>
              <Card testID={`lists.card-${list.id}`} onPress={() => router.push(`/lists/${list.id}`)} accessibilityLabel={list.title} style={{ paddingVertical: tokens.space[3] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], paddingHorizontal: tokens.space[3] }}>
                  <ListCover coverImageUrl={list.coverImageUrl} theme={list.theme} size={48} framed={false} />
                  <View style={{ flex: 1, gap: tokens.space[1] }}>
                    <Text weight="heading">{list.title}</Text>
                    {list.subtitle ? (
                      <Text size="sm" color={tokens.colors.mutedForeground} numberOfLines={2}>
                        {list.subtitle}
                      </Text>
                    ) : null}
                    {list.pending ? <PendingBadge /> : null}
                  </View>
                </View>
              </Card>
              {list.rejected ? (
                <RejectedAlert
                  seq={list.rejected.seq}
                  errorCode={list.rejected.errorCode}
                  onFix={() => router.push({ pathname: "/lists/new", params: { retry: String(list.rejected?.seq) } })}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
