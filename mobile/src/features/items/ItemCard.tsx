import { router } from "expo-router";
import { ArchiveIcon } from "lucide-react-native";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { patchItem } from "@/data/items";
import type { ViewItem, ViewList } from "@/offline/optimistic";
import { useTheme } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { PendingBadge } from "@/ui/PendingBadge";
import { RejectedAlert } from "@/ui/RejectedAlert";
import { Select } from "@/ui/Select";
import { Shadow } from "@/ui/Shadow";
import { Stars } from "@/ui/Stars";
import { Text } from "@/ui/Text";

import { fixableInForm } from "./draft";

/**
 * Une idée dans sa catégorie, comme l'`article` de `components/site/ideas-accordion.tsx` :
 * nom, étoiles, badges « qui » et prix, puis Modifier, le choix de catégorie et Archiver, en bout de rangée.
 */
export function ItemCard({ list, item }: { list: ViewList; item: ViewItem }) {
  const { t } = useTranslation("list");
  const palette = useTheme();
  const person = list.people.find((entry) => entry.id === item.personId)?.label ?? "";
  const edit = () => router.push(`/lists/${list.id}/items/${item.id}`);
  const categories = [...list.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={{ gap: tokens.space[2] }}>
      <Shadow testID={`list.item-${item.id}`} style={{ backgroundColor: palette.background, padding: tokens.space[3], gap: tokens.space[2] }}>
        <Text>{item.name}</Text>
        <Stars value={item.priority} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[1] }}>
          {person ? <Badge>{person}</Badge> : null}
          {item.priceLabel ? <Badge>{item.priceLabel}</Badge> : null}
          {item.pending ? <PendingBadge /> : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.space[2] }}>
          <Button
            title={t("accordion.edit")}
            accessibilityLabel={t("accordion.editAria", { name: item.name })}
            variant="neutral"
            size="sm"
            onPress={edit}
            testID="item-card.edit"
          />
          {categories.length > 1 ? (
            <View style={{ minWidth: 140, flexGrow: 1 }}>
              <Select
                label={t("accordion.moveAria", { name: item.name })}
                value={item.typeId}
                options={categories.map((category) => ({ value: category.id, label: category.label }))}
                onChange={(typeId) => void patchItem(list.id, item.id, { typeId })}
              />
            </View>
          ) : null}
          <Button
            title={t("accordion.archive")}
            icon={<ArchiveIcon size={16} color={tokens.colors.black} />}
            accessibilityLabel={t("accordion.archiveAria", { name: item.name })}
            variant="ghost"
            size="sm"
            onPress={() => void patchItem(list.id, item.id, { archived: true })}
            style={{ marginStart: "auto" }}
            testID="item-card.archive"
          />
        </View>
      </Shadow>
      {item.rejected ? (
        <RejectedAlert seq={item.rejected.seq} errorCode={item.rejected.errorCode} onFix={fixableInForm(item) ? edit : undefined} />
      ) : null}
    </View>
  );
}
