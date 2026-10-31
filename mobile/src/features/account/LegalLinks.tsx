import { router } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { tokens } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

/** Sous les formulaires sans connexion : « Mentions légales · Données personnelles » (FR-002). */
export function LegalLinks() {
  const { t } = useTranslation("content");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: tokens.space[2] }}>
      <Button title={t("legal.title")} variant="link" size="xs" onPress={() => router.push("/legal/mentions")} testID="legal-links.mentions" />
      <Text size="xs" color={tokens.colors.mutedForeground} accessibilityElementsHidden importantForAccessibility="no">
        ·
      </Text>
      <Button title={t("privacy.title")} variant="link" size="xs" onPress={() => router.push("/legal/privacy")} testID="legal-links.privacy" />
    </View>
  );
}
