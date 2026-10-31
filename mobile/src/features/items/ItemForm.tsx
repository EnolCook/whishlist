import { useState } from "react";
import { Image, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useCapabilities } from "@/data/capabilities";
import { enrich, type ItemInput } from "@/data/items";
import { errorText } from "@/features/errors";
import { translateError } from "@/i18n";
import { useOnline } from "@/network";
import type { ViewList } from "@/offline/optimistic";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";
import { Select } from "@/ui/Select";
import { Shadow } from "@/ui/Shadow";
import { StarPicker } from "@/ui/Stars";
import { Text } from "@/ui/Text";

export type Draft = Required<ItemInput>;

/** Brouillon vide : première catégorie et premier « qui » de la liste, comme sur le site. */
export function emptyDraft(list: ViewList): Draft {
  return {
    name: "",
    typeId: list.categories[0]?.id ?? "",
    personId: list.people[0]?.id ?? "",
    url: "",
    imageUrl: "",
    price: "",
    priority: "",
  };
}

/**
 * Formulaire d'idée, d'après la carte « Ajouter une idée cadeau » de `06-liste-idees.png`
 * et `components/site/item-form.tsx` : mêmes champs, mêmes libellés, mêmes aides.
 * Une erreur s'affiche sous le formulaire et tous les champs restent remplis (FR-014).
 */
export function ItemForm({
  list,
  initial,
  error,
  busy,
  submitLabel,
  onSubmit,
}: {
  list: ViewList;
  initial: Draft;
  /** Code d'erreur à afficher (local ou du serveur). */
  error: string | null;
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: Draft) => void;
}) {
  const { t } = useTranslation(["list", "common"]);
  const online = useOnline();
  const capabilities = useCapabilities();
  const [draft, setDraft] = useState<Draft>(initial);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [usedLlm, setUsedLlm] = useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function fill() {
    setEnriching(true);
    setEnrichError(null);
    try {
      const found = await enrich(list.id, draft.url.trim());
      // Comme le site : seuls les champs trouvés remplacent la saisie.
      setDraft((current) => ({
        ...current,
        name: found.name || current.name,
        price: found.price || current.price,
        imageUrl: found.imageUrl || current.imageUrl,
        typeId: found.typeId || current.typeId,
      }));
      setUsedLlm(found.usedLlm);
    } catch (caught) {
      setEnrichError(errorText(caught));
    } finally {
      setEnriching(false);
    }
  }

  const categories = [...list.categories].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({ value: c.id, label: c.label }));
  const people = list.people.map((p) => ({ value: p.id, label: p.label }));
  // Préremplissage : exige le serveur, et une liste qui existe déjà sur le serveur.
  const canEnrich = online && !list.localOnly && draft.url.trim() !== "" && !enriching;

  return (
    <View style={{ gap: tokens.space[4] }}>
      <Field label={t("form.url")}>
        <Input
          testID="item-form.url"
          accessibilityLabel={t("form.url")}
          value={draft.url}
          onChangeText={(value) => set("url", value)}
          placeholder="https://"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Button
          title={enriching ? t("common:actions.loading") : capabilities?.enrich ? t("form.fetchInfosAi") : t("form.fetchInfos")}
          variant="neutral"
          fullWidth
          disabled={!canEnrich}
          onPress={() => void fill()}
          testID="enrich"
        />
        <NetworkNote />
      </Field>
      {enrichError ? <Alert variant="destructive">{enrichError}</Alert> : null}
      {usedLlm ? (
        <Alert title={t("form.aiTitle")}>
          <Text size="sm">{t("form.aiBody")}</Text>
          <Text size="xs">{t("form.aiDisclaimer")}</Text>
        </Alert>
      ) : null}
      <Field label={t("form.name")}>
        <Input testID="item-form.name" accessibilityLabel={t("form.name")} value={draft.name} onChangeText={(value) => set("name", value)} />
      </Field>
      <Field label={t("form.type")}>
        <Select label={t("form.type")} value={draft.typeId} options={categories} onChange={(value) => set("typeId", value)} />
      </Field>
      <Field label={t("form.person")}>
        <Select label={t("form.person")} value={draft.personId} options={people} onChange={(value) => set("personId", value)} />
      </Field>
      <Field label={t("form.price")}>
        <Input
          testID="item-form.price"
          accessibilityLabel={t("form.price")}
          value={draft.price}
          onChangeText={(value) => set("price", value)}
          placeholder={t("form.pricePlaceholder")}
          keyboardType="decimal-pad"
        />
      </Field>
      <Field label={t("form.priority")} description={t("form.priorityHint")}>
        <StarPicker value={draft.priority} onChange={(value) => set("priority", value)} />
      </Field>
      <Field label={t("form.image")}>
        <View style={{ flexDirection: "row", gap: tokens.space[2], alignItems: "center" }}>
          <Shadow style={{ width: 48, height: 48, overflow: "hidden" }}>
            {draft.imageUrl ? (
              <Image
                source={{ uri: draft.imageUrl }}
                style={{ width: 44, height: 44 }}
                accessibilityLabel={draft.name.trim() || t("form.imageAlt")}
              />
            ) : null}
          </Shadow>
          <View style={{ flex: 1 }}>
            <Input
              accessibilityLabel={t("form.image")}
              value={draft.imageUrl}
              onChangeText={(value) => set("imageUrl", value)}
              placeholder="https://"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        </View>
      </Field>
      {error ? (
        <Alert variant="destructive" testID="form-error">
          {translateError(error)}
        </Alert>
      ) : null}
      <Button testID="item-form.submit" title={busy ? t("common:actions.loading") : submitLabel} fullWidth disabled={busy} onPress={() => onSubmit(draft)} />
    </View>
  );
}
