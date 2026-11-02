import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { ItemForm, emptyDraft } from "@/features/items/ItemForm";
import { useItemSave } from "@/features/items/useItemSave";
import { useList } from "@/features/lists/ListContext";
import { BackLink } from "@/ui/BackLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { LiveGiftMark } from "@/ui/LiveGiftMark";
import { Screen } from "@/ui/Screen";

/**
 * Ajouter une idée (FR-013) ; marche hors ligne, l'idée passe « en attente » (FR-026).
 * Depuis un partage : `url` et `name` pré-remplissent le formulaire, `fill` lance « Remplir depuis le lien ».
 */
export default function NewItem() {
  const { t } = useTranslation("list");
  const { list, listId } = useList();
  const save = useItemSave(listId);
  const shared = useLocalSearchParams<{ url?: string; name?: string; fill?: string }>();
  if (!list) return <LiveGiftMark />;
  return (
    <Screen testID="item-form.screen">
      <BackLink fallback={`/lists/${listId}`} />
      <Card>
        <CardHeader>
          <CardTitle>{t("addIdea")}</CardTitle>
          <CardDescription>{t("addIdeaHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemForm
            list={list}
            initial={{ ...emptyDraft(list), url: shared.url ?? "", name: shared.name ?? "" }}
            autoFill={shared.fill === "1"}
            error={save.error}
            busy={save.busy}
            submitLabel={t("form.add")}
            onSubmit={(draft) => void save.submit(draft)}
          />
        </CardContent>
      </Card>
    </Screen>
  );
}
