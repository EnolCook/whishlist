import { router } from "expo-router";
import { ChevronLeftIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { tokens } from "@/theme/tokens";

import { Button } from "./Button";

/**
 * Retour à l'écran précédent. Le site n'en a pas besoin (le navigateur s'en charge) :
 * c'est un lien du site, avec un chevron, et non l'en-tête du système.
 */
export function BackLink({ fallback = "/" }: { fallback?: "/" | `/lists/${string}` }) {
  const { t } = useTranslation("mobile");
  return (
    <Button
      title={t("back")}
      variant="link"
      icon={<ChevronLeftIcon size={18} color={tokens.colors.black} />}
      testID="back-link.back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
    />
  );
}
