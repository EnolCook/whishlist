import { View } from "react-native";

import type { Schemas } from "@/api/client";
import { tokens } from "@/theme/tokens";
import { ListCover } from "@/ui/ListCover";
import { Text } from "@/ui/Text";

/** Couverture, titre et sous-titre de la liste vue en invité, comme l'en-tête de la page publique du site. */
export function GuestListHeader({ list }: { list: Schemas["PublicList"] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3] }}>
      <ListCover coverImageUrl={list.coverImageUrl} theme={list.theme} size={56} />
      <View style={{ flex: 1, gap: tokens.space[1] }}>
        <Text testID="guest.title" size="title" accessibilityRole="header">
          {list.title}
        </Text>
        {list.subtitle ? <Text color={tokens.colors.mutedForeground}>{list.subtitle}</Text> : null}
      </View>
    </View>
  );
}
