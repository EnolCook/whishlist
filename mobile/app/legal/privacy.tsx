import { useTranslation } from "react-i18next";

import { useCapabilities } from "@/data/capabilities";
import { LegalScreen } from "@/features/account/LegalScreen";
import { ContentSection, ContentText } from "@/ui/ContentSection";

import { CONTACT_EMAIL } from "../../../src/site/contact";

/**
 * Données personnelles, d'après `14-donnees-personnelles.png` : mêmes textes que le site.
 * Les prestataires optionnels suivent la dernière réponse connue de `/capabilities` ;
 * sans aucune réponse, leurs paragraphes s'affichent (ils disent « quand … est configuré »).
 */
export default function Privacy() {
  const { t } = useTranslation("content");
  const capabilities = useCapabilities();
  const shows = (configured: boolean | undefined) => capabilities === null || configured !== false;
  return (
    <LegalScreen testID="legal-privacy.screen" eyebrow={t("privacy.eyebrow")} title={t("privacy.title")} intro={t("privacy.intro")} sitePath="/donnees-personnelles">
      <ContentSection title={t("privacy.accountTitle")}>
        <ContentText>{t("privacy.accountBody")}</ContentText>
      </ContentSection>
      <ContentSection title={t("privacy.listsTitle")}>
        <ContentText>{t("privacy.listsBody")}</ContentText>
      </ContentSection>
      <ContentSection title={t("privacy.reservationsTitle")}>
        <ContentText>{t("privacy.reservationsBody")}</ContentText>
      </ContentSection>
      <ContentSection title={t("privacy.retentionTitle")}>
        <ContentText>{t("privacy.retentionBody")}</ContentText>
      </ContentSection>
      <ContentSection title={t("privacy.cookiesTitle")}>
        <ContentText>{t("privacy.cookiesBody")}</ContentText>
      </ContentSection>
      <ContentSection title={t("privacy.appTitle")}>
        <ContentText>{t("privacy.appBody")}</ContentText>
      </ContentSection>
      <ContentSection title={t("privacy.providersTitle")}>
        <ContentText>{t("privacy.cloudflareBody")}</ContentText>
        {shows(capabilities?.mail) ? <ContentText>{t("privacy.mailBody")}</ContentText> : null}
        {shows(capabilities?.enrich) ? <ContentText>{t("privacy.aiBody")}</ContentText> : null}
        {shows(capabilities?.analytics) ? <ContentText>{t("privacy.audienceBody")}</ContentText> : null}
      </ContentSection>
      <ContentSection title={t("privacy.rightsTitle")}>
        <ContentText>{t("privacy.rightsBody", { email: CONTACT_EMAIL })}</ContentText>
      </ContentSection>
    </LegalScreen>
  );
}
