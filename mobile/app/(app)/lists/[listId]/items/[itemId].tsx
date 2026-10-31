import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { deleteItem } from "@/data/items";
import { draftOf, fixableInForm } from "@/features/items/draft";
import { ItemForm } from "@/features/items/ItemForm";
import { useItemSave } from "@/features/items/useItemSave";
import { useList } from "@/features/lists/ListContext";
import type { ViewItem } from "@/offline/optimistic";
import { BackLink } from "@/ui/BackLink";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Empty } from "@/ui/Empty";
import { LiveGiftMark } from "@/ui/LiveGiftMark";
import { Screen } from "@/ui/Screen";

function EditItem({ listId, item }: { listId: string; item: ViewItem }) {
  const { t } = useTranslation("list");
  const { list } = useList();
  // « Corriger » un changement refusé : on reprend le même changement, avec son erreur.
  const fixable = fixableInForm(item);
  const save = useItemSave(listId, {
    itemId: item.id,
    create: item.rejected?.kind === "createItem",
    retrySeq: fixable ? item.rejected?.seq : null,
    errorCode: fixable ? item.rejected?.errorCode : null,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!list) return null;
  return (
    <Screen testID="item-form.screen">
      <BackLink fallback={`/lists/${listId}`} />
      <Card>
        <CardHeader>
          <CardTitle>{t("accordion.editTitle")}</CardTitle>
          <CardDescription>{item.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemForm
            list={list}
            initial={draftOf(item)}
            error={save.error}
            busy={save.busy}
            submitLabel={t("form.save")}
            onSubmit={(draft) => void save.submit(draft)}
          />
          <Button testID="item-form.delete" title={t("form.delete")} variant="destructive" fullWidth onPress={() => setConfirmDelete(true)} />
        </CardContent>
      </Card>
      <ConfirmDialog
        visible={confirmDelete}
        title={t("confirm.deleteIdeaTitle")}
        body={t("confirm.deleteIdeaBody", { name: item.name })}
        confirmLabel={t("confirm.deleteIdeaConfirm")}
        keepLabel={t("confirm.deleteIdeaKeep")}
        testID="item-form.delete-confirm"
        onKeep={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deleteItem(listId, item.id);
          router.back();
        }}
      />
    </Screen>
  );
}

/** Modifier ou supprimer une idée (FR-013). */
export default function ItemScreen() {
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
  return <EditItem listId={listId} item={item} />;
}
