import { router, type Href } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { useMyLists, usePendingCount } from "@/data/store";
import { AppHeader } from "@/features/account/AppHeader";
import { useEmailUnverified, VerificationBanner } from "@/features/account/VerificationBanner";
import { tokens } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
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

/** Mes listes et listes suivies, d'après `04-mes-listes.png` (FR-010, FR-025) et `012-list-subscriptions`. */
export default function MyLists() {
  const { t } = useTranslation(["home", "mobile", "errors"]);
  const { lists, subscriptions, loaded, fetchedAt, refreshing, refresh } = useMyLists();
  const pendingCount = usePendingCount();
  // Adresse pas encore confirmée : le serveur refuserait la création (010, FR-005).
  const unverified = useEmailUnverified();
  const newList = (
    <Button title={t("home:mine.newList")} size="sm" onPress={() => router.push("/lists/new")} disabled={unverified} testID="lists.new" />
  );
  const followList = (
    <Button
      title={t("mobile:shared.followButton")}
      variant="neutral"
      size="sm"
      onPress={() => router.push("/shared/follow")}
      testID="lists.follow-open"
    />
  );

  if (!loaded) return <LiveGiftMark />;

  return (
    <Screen
      testID="lists.screen"
      header={<OfflineBanner fetchedAt={fetchedAt} pendingCount={pendingCount} />}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
    >
      <AppHeader />
      <VerificationBanner />
      <PageTitle title={t("home:mine.title")} action={lists.length > 0 ? newList : undefined} />
      {unverified ? (
        <Text testID="lists.new-locked" size="sm" color={tokens.colors.mutedForeground}>
          {t("errors:emailNotVerified")}
        </Text>
      ) : null}
      {lists.length === 0 ? (
        <Empty testID="lists.empty" title={t("home:mine.emptyTitle")} description={t("home:mine.emptyBody")} media={<GiftMark size={64} />}>
          <Button title={t("home:mine.newList")} onPress={() => router.push("/lists/new")} disabled={unverified} testID="lists.new" />
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
      <View testID="lists.subscriptions-section" style={{ gap: tokens.space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3] }}>
          <Text size="lg" weight="heading" accessibilityRole="header">
            {t("home:followed.title")}
          </Text>
          {followList}
        </View>
        {subscriptions.length === 0 ? (
          <Text testID="lists.subscriptions-empty" size="sm" color={tokens.colors.mutedForeground}>
            {t("home:followed.empty")}
          </Text>
        ) : (
          <View style={{ gap: tokens.space[3] }}>
            {subscriptions.map((sub) => (
              <Card
                key={sub.readToken}
                testID={`lists.shared-card-${sub.readToken}`}
                onPress={() => router.push(`/guest/${sub.readToken}` as Href)}
                accessibilityLabel={sub.title}
                style={{ paddingVertical: tokens.space[3] }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], paddingHorizontal: tokens.space[3] }}>
                  <ListCover coverImageUrl={sub.coverImageUrl} theme={sub.theme} size={48} framed={false} />
                  <View style={{ flex: 1, gap: tokens.space[1] }}>
                    <Text weight="heading">{sub.title}</Text>
                    {sub.subtitle ? (
                      <Text size="sm" color={tokens.colors.mutedForeground} numberOfLines={2}>
                        {sub.subtitle}
                      </Text>
                    ) : null}
                    {sub.locked ? <Badge>{t("home:followed.lockedBadge")}</Badge> : null}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
