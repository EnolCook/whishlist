import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BackLink } from "@/ui/BackLink";
import { ContentPage } from "@/ui/ContentPage";
import { ContentSection, ContentText } from "@/ui/ContentSection";
import { ScreenList } from "@/ui/Screen";

import licenses from "@/legal/licenses.json";

type License = (typeof licenses)[number];

function LicenseRow({ entry }: { entry: License }) {
  const [open, setOpen] = useState(false);
  return (
    <ContentSection title={entry.name} onPress={() => setOpen((value) => !value)} expanded={open}>
      <ContentText>{`${entry.version} · ${entry.license}`}</ContentText>
      {open && entry.text ? <ContentText>{entry.text}</ContentText> : null}
    </ContentSection>
  );
}

/** Licences des logiciels libres de l'app (FR-041), lues dans le fichier généré : marche hors ligne. */
export default function Licenses() {
  const { t } = useTranslation("mobile");
  return (
    <ScreenList
      testID="legal-licenses.screen"
      header={
        <>
          <BackLink />
          <ContentPage eyebrow={t("legal.licensesEyebrow")} title={t("legal.licensesTitle")} intro={t("legal.licensesIntro")}>
            {null}
          </ContentPage>
        </>
      }
      data={licenses}
      keyExtractor={(entry) => `${entry.name}@${entry.version}`}
      renderItem={({ item }) => <LicenseRow entry={item} />}
    />
  );
}
