import type { ReactNode } from "react";
import { FlatList, RefreshControl, ScrollView, View, type ListRenderItem } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";

const contentStyle = {
  padding: tokens.space[4],
  // Place pour l'ombre décalée des derniers blocs.
  paddingBottom: tokens.space[6] + tokens.shadowOffset,
  gap: tokens.space[6],
};

/**
 * Fond du site (ou du thème de liste), marges latérales 16, défilement.
 * `onRefresh` active « tirer pour rafraîchir » (FR-017).
 */
export function Screen({
  children,
  header,
  onRefresh,
  refreshing = false,
  edges = ["top", "left", "right"],
  testID,
}: {
  children: ReactNode;
  /** Bloc fixe au-dessus du contenu (bandeau hors ligne). */
  header?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  edges?: Edge[];
  /** `<écran>.screen` : les parcours e2e l'attendent pour savoir que l'écran est prêt. */
  testID?: string;
}) {
  const palette = useTheme();
  return (
    <SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: palette.background }}>
      {header ? <View style={{ paddingHorizontal: tokens.space[4], paddingTop: tokens.space[2] }}>{header}</View> : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        // Le clavier numérique (prix) n'a pas de touche « OK » sur iOS : faire défiler le ferme.
        keyboardDismissMode="on-drag"
        // Le contenu défile au-dessus du clavier : le bouton d'envoi reste atteignable.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={contentStyle}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.main} colors={[palette.main]} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Même écran que `Screen`, pour une longue liste : seules les lignes visibles sont dessinées. */
export function ScreenList<T>({
  header,
  data,
  renderItem,
  keyExtractor,
  testID,
}: {
  /** Au-dessus des lignes, et qui défile avec elles. */
  header: ReactNode;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
  testID?: string;
}) {
  const palette = useTheme();
  return (
    <SafeAreaView testID={testID} edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={<View style={{ gap: tokens.space[6] }}>{header}</View>}
        contentContainerStyle={contentStyle}
      />
    </SafeAreaView>
  );
}
