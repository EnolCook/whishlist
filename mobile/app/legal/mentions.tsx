import { Linking } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { LegalScreen } from "@/features/account/LegalScreen";
import { Button } from "@/ui/Button";
import { ContentSection, ContentText } from "@/ui/ContentSection";

import { CONTACT_EMAIL } from "../../../src/site/contact";

/** Mentions légales, d'après `13-mentions-legales.png` : mêmes textes que le site (FR-030). */
export default function LegalMentions() {
  const { t } = useTranslation("content");
  return (
    <LegalScreen testID="legal-mentions.screen" eyebrow={t("legal.eyebrow")} title={t("legal.title")} intro={t("legal.intro")} sitePath="/mentions-legales">
      <ContentSection title={t("legal.publisherTitle")}>
        <ContentText>{t("legal.publisherBody")}</ContentText>
        <ContentText>{t("legal.publisherLaw")}</ContentText>
      </ContentSection>
      <ContentSection title={t("legal.hostTitle")}>
        <ContentText>{t("legal.hostName")}</ContentText>
        <ContentText>{t("legal.hostAddress")}</ContentText>
        <Button
          title={t("legal.hostWebsite")}
          variant="link"
          onPress={() => void Linking.openURL("https://www.cloudflare.com")}
        />
      </ContentSection>
      <ContentSection title={t("legal.privacyTitle")}>
        <Button title={t("legal.privacyLink")} variant="link" onPress={() => router.push("/legal/privacy")} />
        <Button
          title={t("legal.contact", { email: CONTACT_EMAIL })}
          variant="link"
          onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
        />
      </ContentSection>
    </LegalScreen>
  );
}
