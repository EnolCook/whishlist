import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { IdeasAccordion } from "@/features/items/IdeasAccordion";
import { ListScreen } from "@/features/lists/ListScreen";
import { RejectedAlert } from "@/ui/RejectedAlert";
import { Button } from "@/ui/Button";

/** Onglet Idées, d'après `06-liste-idees.png` (FR-012). */
export default function Ideas() {
  const { t } = useTranslation("list");
  return (
    <ListScreen tab="idees">
      {(list) => (
        <>
          {list.rejected ? (
            <RejectedAlert
              seq={list.rejected.seq}
              errorCode={list.rejected.errorCode}
              onFix={() => router.push({ pathname: "/lists/new", params: { retry: String(list.rejected?.seq) } })}
            />
          ) : null}
          <Button testID="list.add-item" title={t("addIdea")} fullWidth onPress={() => router.push(`/lists/${list.id}/items/new`)} />
          <IdeasAccordion list={list} />
        </>
      )}
    </ListScreen>
  );
}
