import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { transferItem } from "@/data/items";
import { useMemberList, useMyLists } from "@/data/store";
import { useList } from "@/features/lists/ListContext";
import { translateError } from "@/i18n";
import type { ViewItem, ViewList } from "@/offline/optimistic";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { Field } from "@/ui/Field";
import { LiveGiftMark } from "@/ui/LiveGiftMark";
import { PillTabs } from "@/ui/PillTabs";
import { Screen } from "@/ui/Screen";
import { Select } from "@/ui/Select";
import { Text } from "@/ui/Text";

type Mode = "move" | "copy";

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** Même nom dans la liste d'arrivée (casse et espaces ignorés), sinon la première entrée, comme sur le site. */
function matching(options: { id: string; label: string }[], label: string | undefined): string {
  return (label ? options.find((option) => sameLabel(option.label, label)) : undefined)?.id ?? options[0]?.id ?? "";
}

function Transfer({ list, item }: { list: ViewList; item: ViewItem }) {
  const { t } = useTranslation(["list", "mobile"]);
  const { lists, loaded } = useMyLists();
  const others = lists.filter((entry) => entry.id !== list.id);
  const canMove = others.length > 0;
  // Rien n'est figé avant que « Mes listes » soit lu : sans choix fait à la main, les défauts suivent les données.
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const mode: Mode = canMove ? (chosenMode ?? "move") : "copy";
  const choices = mode === "move" ? others : lists;
  const [chosenId, setChosenId] = useState<string | null>(null);
  const fallbackId = others[0]?.id ?? list.id;
  const offered = (id: string | null): id is string => id !== null && choices.some((entry) => entry.id === id);
  const targetId = offered(chosenId) ? chosenId : offered(fallbackId) ? fallbackId : (choices[0]?.id ?? list.id);
  const target = useMemberList(targetId);
  // Un choix fait à la main vaut pour cette liste d'arrivée seulement.
  const [picked, setPicked] = useState<{ listId: string; typeId?: string; personId?: string }>({ listId: targetId });
  const typeLabel = list.categories.find((category) => category.id === item.typeId)?.label;
  const personLabel = list.people.find((person) => person.id === item.personId)?.label;
  const categories = [...(target.list?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const people = target.list?.people ?? [];
  const own = picked.listId === targetId ? picked : { listId: targetId };
  const typeId = own.typeId ?? matching(categories, typeLabel);
  const personId = own.personId ?? matching(people, personLabel);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await transferItem(list.id, item, mode, { listId: targetId, typeId, personId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Déplacée : l'écran de modification n'a plus d'idée à montrer, retour direct à la liste.
      router.dismissTo(`/lists/${list.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <LiveGiftMark />;
  return (
    <Screen testID="item-transfer.screen">
      <BackLink fallback={`/lists/${list.id}/items/${item.id}`} />
      <Card>
        <CardHeader>
          <CardTitle>{t("transfer.title")}</CardTitle>
          <CardDescription>{item.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={{ gap: tokens.space[2] }}>
            <Text>{t("transfer.mode")}</Text>
            <PillTabs
              tabs={(canMove ? (["move", "copy"] as const) : (["copy"] as const)).map((key) => ({ key, label: t(`transfer.${key}`) }))}
              active={mode}
              onChange={(key) => {
                setChosenMode(key as Mode);
                setError(null);
              }}
            />
            <Text size="sm" color={tokens.colors.mutedForeground}>
              {canMove ? t(`transfer.${mode}Hint`) : t("transfer.onlyList")}
            </Text>
          </View>
          <Field label={t("transfer.target")}>
            <Select
              label={t("transfer.target")}
              value={targetId}
              options={choices.map((entry) => ({
                value: entry.id,
                label: entry.id === list.id ? t("transfer.thisList", { title: entry.title }) : entry.title,
              }))}
              onChange={(value) => setChosenId(value)}
            />
          </Field>
          {target.list ? (
            <>
              <Field label={t("form.type")}>
                <Select
                  label={t("form.type")}
                  value={typeId}
                  options={categories.map((category) => ({ value: category.id, label: category.label }))}
                  onChange={(value) => setPicked({ ...own, typeId: value })}
                />
              </Field>
              <Field label={t("form.person")}>
                <Select
                  label={t("form.person")}
                  value={personId}
                  options={people.map((person) => ({ value: person.id, label: person.label }))}
                  onChange={(value) => setPicked({ ...own, personId: value })}
                />
              </Field>
            </>
          ) : target.loaded && target.settled ? (
            <Alert testID="item-transfer.unknown-list">{t("mobile:offline.needsNetwork")}</Alert>
          ) : (
            <LiveGiftMark />
          )}
          {error ? (
            <Alert variant="destructive" testID="item-transfer.error">
              {translateError(error)}
            </Alert>
          ) : null}
          <Button
            testID="item-transfer.submit"
            title={mode === "move" ? t("transfer.submitMove") : t("transfer.submitCopy")}
            fullWidth
            disabled={busy || !target.list || !typeId || !personId}
            onPress={() => void submit()}
          />
        </CardContent>
      </Card>
    </Screen>
  );
}

/** Déplacer une idée vers une autre liste, ou la copier (même liste ou une autre). */
export default function TransferScreen() {
  const { t } = useTranslation("errors");
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { list, listId } = useList();
  if (!list) return <LiveGiftMark />;
  const item = list.items.find((entry) => entry.id === itemId);
  if (!item) {
    return (
      <Screen>
        <BackLink fallback={`/lists/${listId}`} />
        <Empty title={t("itemMissing")} />
      </Screen>
    );
  }
  return <Transfer list={list} item={item} />;
}
