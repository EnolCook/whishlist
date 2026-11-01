import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { ListThemeProvider } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { Badge } from "@/ui/Badge";
import { BrandHeader } from "@/ui/BrandHeader";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, CollapsibleCard } from "@/ui/Card";
import { ContentPage } from "@/ui/ContentPage";
import { ContentSection, ContentText } from "@/ui/ContentSection";
import { Empty } from "@/ui/Empty";
import { Field } from "@/ui/Field";
import { GiftMark } from "@/ui/GiftMark";
import { Input } from "@/ui/Input";
import { PillTabs } from "@/ui/PillTabs";
import { Screen } from "@/ui/Screen";
import { Select } from "@/ui/Select";
import { Separator } from "@/ui/Separator";
import { StarPicker, Stars } from "@/ui/Stars";
import { Text } from "@/ui/Text";

// Écran de développement (T032) : tous les composants, à comparer à ceux du site.
// Textes en dur : il n'existe que dans le client de développement, jamais dans un build distribué.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: tokens.space[3] }}>
      <Text size="lg" weight="heading">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Components() {
  const [tab, setTab] = useState("ideas");
  const [category, setCategory] = useState("books");
  const [priority, setPriority] = useState("3");
  return (
    <>
      <Section title="Boutons">
        <Button title="Se connecter" fullWidth />
        <Button title="Voir la liste partagée" variant="neutral" />
        <Button title="Supprimer" variant="destructive" />
        <Button title="Remplir depuis le lien" variant="neutral" disabled fullWidth />
        <Button title="Mot de passe oublié ?" variant="link" />
        <View style={{ flexDirection: "row", gap: tokens.space[3] }}>
          <Button title="xs" size="xs" />
          <Button title="sm" size="sm" />
          <Button title="lg" size="lg" />
        </View>
      </Section>
      <Section title="Onglets">
        <PillTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "ideas", label: "Idées (8)" },
            { key: "archives", label: "Archives (1)" },
            { key: "reservations", label: "Réservations (1)" },
            { key: "share", label: "Partage" },
            { key: "settings", label: "Réglages" },
          ]}
        />
      </Section>
      <Section title="Carte et champs">
        <Card>
          <CardHeader>
            <CardTitle>Ajouter une idée cadeau</CardTitle>
            <CardDescription>Collez un lien pour récupérer les informations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Nom du cadeau" description="Une aide sous le champ.">
              <Input placeholder="Ex. : 18,50" accessibilityLabel="Nom du cadeau" />
            </Field>
            <Field label="Prix (€)" error="Saisissez un prix valide, par exemple 18,50.">
              <Input invalid defaultValue="abc" accessibilityLabel="Prix" />
            </Field>
            <Field label="Catégorie">
              <Select
                label="Catégorie"
                value={category}
                onChange={setCategory}
                options={[
                  { value: "books", label: "Livres" },
                  { value: "games", label: "Jeux" },
                ]}
              />
            </Field>
            <Field label="Niveau d'envie">
              <StarPicker value={priority} onChange={setPriority} />
            </Field>
          </CardContent>
          <CardFooter>
            <Button title="Ajouter l'idée" fullWidth />
          </CardFooter>
        </Card>
        <Card onPress={() => {}} accessibilityLabel="Carte cliquable">
          <CardHeader>
            <CardTitle>Carte cliquable</CardTitle>
            <CardDescription>{"Elle s’enfonce à l’appui."}</CardDescription>
          </CardHeader>
        </Card>
        <CollapsibleCard title="Carte repliable" description="Touchez l’en-tête pour la déplier.">
          <Field label="Nom affiché">
            <Input accessibilityLabel="Nom affiché" />
          </Field>
        </CollapsibleCard>
        <CollapsibleCard title="Carte dépliée au départ" defaultExpanded>
          <Button title="Enregistrer" fullWidth />
        </CollapsibleCard>
      </Section>
      <Section title="Badges et étoiles">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[3] }}>
          <Badge>Alex</Badge>
          <Badge>24,90 €</Badge>
          <Badge variant="default">Bleu</Badge>
          <Badge variant="highlight">En attente</Badge>
          <Badge variant="destructive">Refusé</Badge>
        </View>
        <Stars value="4" />
      </Section>
      <Section title="Alertes et vide">
        <Alert title="Hors ligne · dernière mise à jour à 14 h 05">2 changements en attente.</Alert>
        <Alert
          variant="destructive"
          title="Cette idée n'existe pas."
          actions={
            <>
              <Button title="Corriger" variant="neutral" size="sm" />
              <Button title="Abandonner" variant="neutral" size="sm" />
            </>
          }
        />
        <Empty title="Aucune liste" description="Créez votre première liste." />
      </Section>
      <Section title="Page de contenu">
        <ContentPage eyebrow="Informations légales" title="Mentions légales" intro="Qui publie le site, comment il est hébergé, et où écrire.">
          <ContentSection title="Éditeur">
            <ContentText>Ce site est édité à titre non professionnel, par un particulier.</ContentText>
          </ContentSection>
        </ContentPage>
        <Separator />
      </Section>
      <Section title="Cadeau">
        <View style={{ flexDirection: "row", gap: tokens.space[4], alignItems: "center" }}>
          <GiftMark size={48} />
          <GiftMark size={48} framed={false} />
        </View>
      </Section>
    </>
  );
}

export default function Catalog() {
  if (!Constants.expoConfig?.extra?.devCatalog) return <Redirect href="/" />;
  return (
    <Screen>
      <BrandHeader />
      <Components />
      <Text size="title">Thème de liste</Text>
      <ListThemeProvider theme={{ primary: "#b4235a", accent: "#1f7a4d", highlight: "#f4a300", background: "#fff1f5" }}>
        <View style={{ backgroundColor: "#fff1f5", gap: tokens.space[6], padding: tokens.space[3] }}>
          <Components />
        </View>
      </ListThemeProvider>
    </Screen>
  );
}
