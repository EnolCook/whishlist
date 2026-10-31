import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { createList } from "@/data/lists";
import { translateError } from "@/i18n";
import { getChange } from "@/offline/outbox";
import { Alert } from "@/ui/Alert";
import { BackLink } from "@/ui/BackLink";
import { BrandHeader } from "@/ui/BrandHeader";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { Screen } from "@/ui/Screen";

type Ids = { id: string; categoryId: string; personId: string };

/**
 * Nouvelle liste, d'après `05-nouvelle-liste.png` (FR-011). Marche hors ligne : la liste est créée
 * sur le téléphone et envoyée plus tard (FR-026). `?retry=<seq>` : « Corriger » une création refusée.
 */
export default function NewList() {
  const { t } = useTranslation("home");
  const params = useLocalSearchParams<{ retry?: string }>();
  const retrySeq = params.retry ? Number(params.retry) : null;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [person, setPerson] = useState("");
  const [ids, setIds] = useState<Ids | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // « Corriger » : le formulaire reprend ce qui avait été saisi, avec les mêmes identifiants.
  useEffect(() => {
    if (!retrySeq) return;
    void getChange(retrySeq).then((change) => {
      if (change?.kind !== "createList") return;
      const { payload } = change;
      setTitle(payload.title);
      setCategory(payload.category);
      setPerson(payload.person);
      setIds({ id: payload.id, categoryId: payload.categoryId, personId: payload.personId });
      setError(change.errorCode ? translateError(change.errorCode) : null);
    });
  }, [retrySeq]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await createList({ title, category, person }, retrySeq, ids);
      if (!result.ok) {
        setError(translateError(result.error));
        return;
      }
      router.replace(`/lists/${result.listId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="new-list.screen">
      <BrandHeader />
      <BackLink />
      <Card>
        <CardHeader>
          <CardTitle>{t("newList.title")}</CardTitle>
          <CardDescription>{t("newList.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label={t("newList.titleLabel")}>
            <Input testID="new-list.title" accessibilityLabel={t("newList.titleLabel")} placeholder={t("newList.titlePlaceholder")} value={title} onChangeText={setTitle} />
          </Field>
          <Field label={t("newList.categoryLabel")} description={t("newList.categoryHint")}>
            <Input
              testID="new-list.category"
              accessibilityLabel={t("newList.categoryLabel")}
              placeholder={t("newList.categoryPlaceholder")}
              value={category}
              onChangeText={setCategory}
            />
          </Field>
          <Field label={t("newList.personLabel")} description={t("newList.personHint")}>
            <Input testID="new-list.person" accessibilityLabel={t("newList.personLabel")} placeholder={t("newList.personPlaceholder")} value={person} onChangeText={setPerson} />
          </Field>
          {error ? <Alert variant="destructive" testID="new-list.error">{error}</Alert> : null}
          <Button testID="new-list.submit" title={t("newList.submit")} fullWidth disabled={busy} onPress={() => void submit()} />
        </CardContent>
      </Card>
    </Screen>
  );
}
