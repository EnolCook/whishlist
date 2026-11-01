import type { ReactNode } from "react";
import { View } from "react-native";

import { tokens } from "@/theme/tokens";
import { BrandHeader } from "@/ui/BrandHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Screen } from "@/ui/Screen";

import { LegalLinks } from "./LegalLinks";

/**
 * Écrans sans connexion (`02-connexion.png`, `03-inscription.png`) : en-tête du site, une carte-formulaire,
 * puis les liens vers les mentions légales et les données personnelles (FR-002).
 */
export function AuthLayout({
  title,
  description,
  children,
  below,
  testID,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Sous la carte (bouton « Créer un compte »). */
  below?: ReactNode;
  testID?: string;
}) {
  return (
    <Screen testID={testID}>
      <BrandHeader />
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {/* Centré, comme le lien « Créer un compte » sous la carte du site. */}
      {below ? <View style={{ flexDirection: "row", justifyContent: "center", gap: tokens.space[3] }}>{below}</View> : null}
      <LegalLinks />
    </Screen>
  );
}
