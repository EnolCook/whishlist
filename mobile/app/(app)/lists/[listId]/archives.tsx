import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { deleteItem, patchItem } from "@/data/items";
import { ListScreen } from "@/features/lists/ListScreen";
import type { ViewItem } from "@/offline/optimistic";
import { tokens } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card, CardContent } from "@/ui/Card";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Empty } from "@/ui/Empty";
import { PendingBadge } from "@/ui/PendingBadge";
import { RejectedAlert } from "@/ui/RejectedAlert";
import { Text } from "@/ui/Text";

/** Onglet Archives, d'après `07-liste-archives.png` : remettre dans la liste, supprimer définitivement (FR-013). */
export default function Archives() {
  const { t } = useTranslation("list");
  const [toDelete, setToDelete] = useState<ViewItem | null>(null);
  return (
    <ListScreen tab="archives">
      {(list) => {
        const archived = list.items.filter((item) => item.archived);
        return (
          <>
            <View style={{ gap: tokens.space[3] }}>
              <Text size="lg" accessibilityRole="header">
                {t("archives.title")}
              </Text>
              <Text color={tokens.colors.mutedForeground}>{t("archives.hint")}</Text>
            </View>
            {archived.length === 0 ? <Empty title={t("archives.empty")} description={t("archives.emptyHint")} /> : null}
            {archived.map((item) => (
              <View key={item.id} style={{ gap: tokens.space[2] }}>
                <Card testID={`archives.item-${item.id}`}>
                  <CardContent>
                    <Text weight="heading">{item.name}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[1] }}>
                      <Badge variant="highlight">{list.categories.find((c) => c.id === item.typeId)?.label ?? ""}</Badge>
                      <Badge>{list.people.find((p) => p.id === item.personId)?.label ?? ""}</Badge>
                      {item.pending ? <PendingBadge /> : null}
                    </View>
                    <Button testID="archives.restore" title={t("archives.restore")} variant="neutral" onPress={() => void patchItem(list.id, item.id, { archived: false })} />
                    <Button testID="archives.delete" title={t("archives.deleteForever")} variant="destructive" onPress={() => setToDelete(item)} />
                  </CardContent>
                </Card>
                {item.rejected ? <RejectedAlert seq={item.rejected.seq} errorCode={item.rejected.errorCode} /> : null}
              </View>
            ))}
            <ConfirmDialog
              visible={toDelete !== null}
              title={t("confirm.deleteArchiveTitle")}
              body={t("confirm.deleteArchiveBody", { name: toDelete?.name ?? "" })}
              confirmLabel={t("confirm.deleteArchiveConfirm")}
              keepLabel={t("confirm.deleteArchiveKeep")}
              onKeep={() => setToDelete(null)}
              onConfirm={() => {
                if (toDelete) void deleteItem(list.id, toDelete.id);
                setToDelete(null);
              }}
            />
          </>
        );
      }}
    </ListScreen>
  );
}
