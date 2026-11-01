import { ChevronDownIcon, ChevronUpIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { reorderTypes } from "@/data/labels";
import { errorText } from "@/features/errors";
import { useOnline } from "@/network";
import type { ViewItem, ViewList } from "@/offline/optimistic";
import { tokens } from "@/theme/tokens";
import { AccordionChevron, AccordionContent, AccordionTrigger, useAccordion } from "@/ui/Accordion";
import { Alert } from "@/ui/Alert";
import { Shadow } from "@/ui/Shadow";
import { Text } from "@/ui/Text";

import { ItemCard } from "./ItemCard";

function Arrow({ up, label, disabled, onPress }: { up: boolean; label: string; disabled: boolean; onPress: () => void }) {
  const Icon = up ? ChevronUpIcon : ChevronDownIcon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 32, height: 28, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}
    >
      <Icon size={16} color={tokens.colors.black} />
    </Pressable>
  );
}

/**
 * Catégories en accordéon, comme `components/site/ideas-accordion.tsx` : flèches pour l'ordre,
 * nom en gras, nombre d'idées, chevron ; ouverte (avec l'animation de `@/ui/Accordion`), elle montre ses idées.
 * Réordonner exige le serveur (réglage de liste, FR-029b).
 */
export function IdeasAccordion({ list }: { list: ViewList }) {
  const { t } = useTranslation("list");
  const online = useOnline();
  const [error, setError] = useState<string | null>(null);
  const categories = [...list.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const active = list.items.filter((item) => !item.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const canReorder = online && !list.localOnly;

  async function move(index: number, delta: number) {
    const ids = categories.map((category) => category.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    setError(null);
    try {
      await reorderTypes(list.id, ids);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <View style={{ gap: tokens.space[3] }}>
      <Text size="sm" color={tokens.colors.mutedForeground}>
        {t("accordion.hint")}
      </Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {categories.map((category, index) => {
        const items = active.filter((item) => item.typeId === category.id);
        return (
          <CategorySection
            key={category.id}
            list={list}
            category={category}
            items={items}
            canMoveUp={canReorder && index > 0}
            canMoveDown={canReorder && index < categories.length - 1}
            onMove={(delta) => void move(index, delta)}
          />
        );
      })}
    </View>
  );
}

/** Une catégorie : flèches d'ordre, en-tête qui déplie (animé, voir `@/ui/Accordion`), ses idées. */
function CategorySection({
  list,
  category,
  items,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  list: ViewList;
  category: ViewList["categories"][number];
  items: ViewItem[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: number) => void;
}) {
  const { t } = useTranslation("list");
  const { expanded, shown, toggle, progress } = useAccordion();
  return (
    <Shadow>
      <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: tokens.space[1] }}>
        <View>
          <Arrow up label={t("accordion.moveUp", { name: category.label })} disabled={!canMoveUp} onPress={() => onMove(-1)} />
          <Arrow up={false} label={t("accordion.moveDown", { name: category.label })} disabled={!canMoveDown} onPress={() => onMove(1)} />
        </View>
        <AccordionTrigger
          expanded={expanded}
          onPress={toggle}
          testID={`list.category-${category.id}`}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: tokens.space[2], paddingVertical: tokens.space[3], paddingHorizontal: tokens.space[2] }}
        >
          <Text weight="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
            {category.label}
          </Text>
          <Text size="xs" color={tokens.colors.mutedForeground}>
            {items.length}
          </Text>
          <AccordionChevron progress={progress} color={tokens.colors.black} testID={`list.category-${category.id}-chevron`} />
        </AccordionTrigger>
      </View>
      {/* Les idées ne sont montées que dépliées : une longue liste reste légère, et aucun bouton caché. */}
      <AccordionContent
        expanded={expanded}
        progress={progress}
        mounted={shown}
        testID={`list.category-${category.id}-content`}
        style={{ gap: tokens.space[3], paddingHorizontal: tokens.space[3], paddingBottom: tokens.space[3] + tokens.shadowOffset }}
      >
        {items.length === 0 ? (
          <View
            style={{
              borderWidth: tokens.borderWidth,
              borderStyle: "dashed",
              borderRadius: tokens.radius,
              paddingHorizontal: tokens.space[3],
              paddingVertical: tokens.space[4],
            }}
          >
            <Text size="sm" color={tokens.colors.mutedForeground}>
              {t("accordion.emptyCategory")}
            </Text>
          </View>
        ) : (
          items.map((item) => <ItemCard key={item.id} list={list} item={item} />)
        )}
      </AccordionContent>
    </Shadow>
  );
}
