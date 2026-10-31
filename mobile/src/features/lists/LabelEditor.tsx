import { XIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { addLabel, deleteLabel, renameLabel, type LabelKind } from "@/data/labels";
import { errorText } from "@/features/errors";
import { useTheme } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { PressableShadow } from "@/ui/Shadow";
import { Text } from "@/ui/Text";

type Label = { id: string; label: string };

const texts = {
  types: {
    title: "categories.types",
    hint: "categories.typesHint",
    newLabel: "categories.newType",
    placeholder: "categories.newTypePlaceholder",
    addAria: "categories.addTypeAria",
    renameAria: "categories.renameAria",
  },
  people: {
    title: "categories.people",
    hint: "categories.peopleHint",
    newLabel: "categories.newPerson",
    placeholder: "categories.newPersonPlaceholder",
    addAria: "categories.addPersonAria",
    renameAria: "categories.renamePersonAria",
  },
} as const;

/**
 * Catégories ou « qui » en pastilles éditables, comme `components/site/label-chips.tsx` :
 * appuyer sur une pastille pour la renommer, la croix pour la retirer, un champ pour ajouter.
 * Un libellé encore utilisé est refusé par le serveur, avec son message (FR-016).
 */
export function LabelEditor({ listId, kind, labels, disabled }: { listId: string; kind: LabelKind; labels: Label[]; disabled: boolean }) {
  const { t } = useTranslation("list");
  const palette = useTheme();
  const text = texts[kind];
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Label | null>(null);
  const [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, after: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      after();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const locked = disabled || busy;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(text.title)}</CardTitle>
        <CardDescription>{t(text.hint)}</CardDescription>
      </CardHeader>
      <CardContent>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
          {labels.map((chip) => (
            <View key={chip.id} style={{ flexDirection: "row" }}>
              <PressableShadow
                accessibilityRole="button"
                accessibilityLabel={t(text.renameAria, { label: chip.label })}
                disabled={locked}
                onPress={() => {
                  setEditing(chip);
                  setRename(chip.label);
                }}
                boxStyle={{
                  backgroundColor: palette.highlight,
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 32,
                  paddingLeft: tokens.space[2],
                  gap: tokens.space[1],
                }}
              >
                <Text size="xs" weight="heading" numberOfLines={1} style={{ maxWidth: 180 }}>
                  {chip.label}
                </Text>
                <Pressable
                  testID={`settings.${kind}-delete-${chip.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t("categories.deleteChip", { label: chip.label })}
                  disabled={locked}
                  hitSlop={6}
                  onPress={() => void run(() => deleteLabel(listId, kind, chip.id), () => setEditing(null))}
                  style={{ width: 32, height: 28, alignItems: "center", justifyContent: "center" }}
                >
                  <XIcon size={16} color={tokens.colors.black} />
                </Pressable>
              </PressableShadow>
            </View>
          ))}
        </View>
        {editing ? (
          <Field label={t("categories.rename")}>
            <Input accessibilityLabel={t(text.renameAria, { label: editing.label })} value={rename} onChangeText={setRename} />
            <View style={{ flexDirection: "row", gap: tokens.space[2] }}>
              <Button
                title={t("categories.rename")}
                size="sm"
                disabled={locked || !rename.trim()}
                onPress={() => void run(() => renameLabel(listId, kind, editing.id, rename.trim()), () => setEditing(null))}
              />
              <Button title={t("form.close")} size="sm" variant="neutral" onPress={() => setEditing(null)} />
            </View>
          </Field>
        ) : null}
        <Field label={t(text.newLabel)}>
          <Input testID={`settings.${kind}-new`} accessibilityLabel={t(text.newLabel)} placeholder={t(text.placeholder)} value={draft} onChangeText={setDraft} />
          <Button
            testID={`settings.${kind}-add`}
            title={t("categories.add")}
            accessibilityLabel={t(text.addAria)}
            variant="neutral"
            size="sm"
            disabled={locked || !draft.trim()}
            onPress={() => void run(() => addLabel(listId, kind, draft.trim()), () => setDraft(""))}
          />
        </Field>
        {error ? <Alert variant="destructive" testID={`settings.${kind}-error`}>{error}</Alert> : null}
      </CardContent>
    </Card>
  );
}
