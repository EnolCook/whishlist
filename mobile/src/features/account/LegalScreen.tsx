import type { ReactNode } from "react";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";

import { siteOrigin } from "@/api/client";
import { currentLocale, withLocale } from "@/i18n";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { ContentPage } from "@/ui/ContentPage";
import { Screen } from "@/ui/Screen";

/** Page de contenu de l'app, avec le lien vers la même page du site, dans la langue de l'app. */
export function LegalScreen({
  eyebrow,
  title,
  intro,
  sitePath,
  children,
  testID,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  /** Page du site au même contenu ; aucune pour les licences de l'app. */
  sitePath?: string;
  children: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation("mobile");
  return (
    <Screen testID={testID}>
      <BackLink />
      <ContentPage eyebrow={eyebrow} title={title} intro={intro}>
        {children}
      </ContentPage>
      {sitePath ? (
        <Button
          title={t("legal.viewOnSite")}
          variant="link"
          onPress={() => void Linking.openURL(`${siteOrigin()}${withLocale(currentLocale(), sitePath)}`)}
        />
      ) : null}
    </Screen>
  );
}
