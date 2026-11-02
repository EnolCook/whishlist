"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon } from "lucide-react";
import { parsePriority } from "@/src/domain/priority";
import {
  deleteItemAction,
  reorderTypesAction,
  setItemArchivedAction,
  setItemTypeAction,
} from "@/src/server/actions";
import { ConfirmForm } from "@/components/site/confirm-form";
import { ItemForm } from "@/components/site/item-form";
import { PriorityStars } from "@/components/site/priority-stars";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AccordionIdea = {
  id: string;
  name: string;
  typeId: string;
  personId: string;
  personLabel: string;
  url: string | null;
  imageUrl: string | null;
  priceLabel: string | null;
  price: string;
  priority: string | null;
  sortOrder: number;
};

type TypeCol = { id: string; label: string; sortOrder: number };

function sortItems(items: AccordionIdea[]): AccordionIdea[] {
  return [...items].sort((a, b) => {
    const pa = parsePriority(a.priority) ?? 0;
    const pb = parsePriority(b.priority) ?? 0;
    return pb - pa || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
  });
}

export function IdeasAccordion({
  wishlistId,
  types,
  people,
  items,
  llmEnabled = false,
}: {
  wishlistId: string;
  types: TypeCol[];
  people: { id: string; label: string }[];
  items: AccordionIdea[];
  llmEnabled?: boolean;
}) {
  const { t } = useTranslation(["list", "errors", "common"]);
  const [board, setBoard] = useState(items);
  const [typeOrder, setTypeOrder] = useState(() =>
    [...types].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
  );
  const [sourceItems, setSourceItems] = useState(items);
  const [sourceTypes, setSourceTypes] = useState(types);
  if (items !== sourceItems) {
    setSourceItems(items);
    setBoard(items);
  }
  if (types !== sourceTypes) {
    setSourceTypes(types);
    setTypeOrder(
      [...types].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    );
  }
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingTypeId, setDraggingTypeId] = useState<string | null>(null);
  const [overTypeId, setOverTypeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [openValues, setOpenValues] = useState<string[]>([]);

  const sections = useMemo(
    () =>
      typeOrder.map((type) => ({
        type,
        items: sortItems(board.filter((item) => item.typeId === type.id)),
      })),
    [board, typeOrder],
  );

  const editingItem = editingId ? (board.find((item) => item.id === editingId) ?? null) : null;

  function onDropItem(typeId: string) {
    if (!draggingItemId) return;
    const itemId = draggingItemId;
    setDraggingItemId(null);
    setOverTypeId(null);
    moveItemTo(itemId, typeId);
  }

  function persistTypeOrder(next: TypeCol[], snapshot: TypeCol[]) {
    setTypeOrder(next);
    setError(null);
    startTransition(async () => {
      const result = await reorderTypesAction({
        wishlistId,
        orderedTypeIds: next.map((type) => type.id),
      });
      if (!result.ok) {
        setTypeOrder(snapshot);
        setError(result.error);
      }
    });
  }

  function moveType(typeId: string, direction: -1 | 1) {
    const from = typeOrder.findIndex((type) => type.id === typeId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= typeOrder.length) return;
    const next = [...typeOrder];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    persistTypeOrder(next, typeOrder);
  }

  function moveItemTo(itemId: string, typeId: string) {
    const item = board.find((entry) => entry.id === itemId);
    if (!item || item.typeId === typeId) return;
    const previous = item.typeId;
    setBoard((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, typeId } : entry)),
    );
    setError(null);
    startTransition(async () => {
      const result = await setItemTypeAction({ wishlistId, itemId: item.id, typeId });
      if (!result.ok) {
        setBoard((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, typeId: previous } : entry)),
        );
        setError(result.error);
      }
    });
  }

  function onDropType(targetTypeId: string) {
    if (!draggingTypeId || draggingTypeId === targetTypeId) {
      setDraggingTypeId(null);
      return;
    }
    const from = typeOrder.findIndex((type) => type.id === draggingTypeId);
    const to = typeOrder.findIndex((type) => type.id === targetTypeId);
    setDraggingTypeId(null);
    if (from < 0 || to < 0) return;
    const next = [...typeOrder];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    persistTypeOrder(next, typeOrder);
  }

  function onArchive(itemId: string) {
    const snapshot = board;
    setBoard((current) => current.filter((entry) => entry.id !== itemId));
    if (editingId === itemId) setEditingId(null);
    setError(null);
    startTransition(async () => {
      const result = await setItemArchivedAction({ wishlistId, itemId, archived: true });
      if (!result.ok) {
        setBoard(snapshot);
        setError(result.error);
      }
    });
  }

  return (
    <div className={`flex w-full flex-col gap-3 ${pending ? "opacity-90" : ""}`}>
      <p className="max-w-3xl text-sm text-muted-foreground">{t("accordion.hint")}</p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors:${error}`, { defaultValue: error })}</AlertDescription>
        </Alert>
      ) : null}

      <Accordion
        multiple
        value={openValues}
        onValueChange={(value) => setOpenValues(Array.isArray(value) ? value : [value])}
        className="flex flex-col gap-3"
      >
        {sections.map(({ type, items: sectionItems }, index) => (
          <AccordionItem
            key={type.id}
            value={type.id}
            className={`overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-shadow not-last:border-b-2 ${
              overTypeId === type.id ? "border-main bg-main/10" : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setOverTypeId(type.id);
            }}
            onDragLeave={() => {
              setOverTypeId((current) => (current === type.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingTypeId) onDropType(type.id);
              else onDropItem(type.id);
            }}
          >
            <div className="flex items-center gap-1 pl-2">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-base text-foreground hover:bg-background focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:opacity-40"
                  aria-label={t("accordion.moveUp", { name: type.label })}
                  disabled={index === 0 || pending}
                  onClick={() => moveType(type.id, -1)}
                >
                  <ChevronUpIcon className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-base text-foreground hover:bg-background focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:opacity-40"
                  aria-label={t("accordion.moveDown", { name: type.label })}
                  disabled={index === sections.length - 1 || pending}
                  onClick={() => moveType(type.id, 1)}
                >
                  <ChevronDownIcon className="size-4" aria-hidden />
                </button>
              </div>
              <span
                draggable
                aria-hidden
                className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                onDragStart={(event) => {
                  setDraggingTypeId(type.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", `type:${type.id}`);
                }}
                onDragEnd={() => setDraggingTypeId(null)}
              >
                <GripVerticalIcon className="size-4" />
              </span>
            <AccordionTrigger className="items-center gap-2 px-2 py-3 hover:no-underline">
              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pr-2">
                <span className="truncate text-base font-bold">{type.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {sectionItems.length}
                </span>
              </span>
            </AccordionTrigger>
            </div>
            <AccordionContent className="px-3 pb-3">
              <div className="flex flex-col gap-2 pt-1">
                {sectionItems.length === 0 ? (
                  <p className="rounded-base border-2 border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    {t("accordion.emptyCategory")}
                  </p>
                ) : (
                  sectionItems.map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-base border-2 border-border bg-background p-3 text-sm shadow-shadow ${
                        draggingItemId === item.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          draggable
                          aria-hidden
                          className="mt-1 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                          onDragStart={(event) => {
                            setDraggingItemId(item.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", item.id);
                          }}
                          onDragEnd={() => {
                            setDraggingItemId(null);
                            setOverTypeId(null);
                          }}
                        >
                          <GripVerticalIcon className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <p className="text-balance font-medium">{item.name}</p>
                          <PriorityStars value={item.priority} />
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">{item.personLabel}</Badge>
                            {item.priceLabel ? <Badge variant="outline">{item.priceLabel}</Badge> : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label={t("accordion.editAria", { name: item.name })}
                              onClick={() => setEditingId(item.id)}
                            >
                              {t("accordion.edit")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={t("accordion.archiveAria", { name: item.name })}
                              onClick={() => onArchive(item.id)}
                            >
                              {t("accordion.archive")}
                            </Button>
                            {typeOrder.length > 1 ? (
                              <NativeSelect
                                size="sm"
                                aria-label={t("accordion.moveAria", { name: item.name })}
                                value={item.typeId}
                                disabled={pending}
                                onChange={(event) => moveItemTo(item.id, event.target.value)}
                              >
                                {typeOrder.map((entry) => (
                                  <NativeSelectOption key={entry.id} value={entry.id}>
                                    {entry.label}
                                  </NativeSelectOption>
                                ))}
                              </NativeSelect>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        {/* Sur deux rangées le formulaire dépasse les 40rem du dialogue par défaut : un ascenseur
            apparaissait et coupait le bouton de suppression. Ce plafond ignore la hauteur réellement
            disponible — ici on lui laisse la fenêtre (`cn` est un tailwind-merge, la classe remplace
            bien `max-h-[min(90vh,40rem)]`). En `dvh` et non en `vh` : sur mobile `vh` vaut la hauteur
            barre d'adresse rétractée, et 90vh peut donc dépasser quand la barre est affichée. */}
        <DialogContent className="max-h-[90dvh]">
          {editingItem ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("accordion.editTitle")}</DialogTitle>
                <DialogDescription className="truncate">{editingItem.name}</DialogDescription>
              </DialogHeader>
              <ItemForm
                key={editingItem.id}
                wishlistId={wishlistId}
                types={typeOrder}
                people={people}
                item={editingItem}
                price={editingItem.price}
                onglet="idees"
                llmEnabled={llmEnabled}
              />
              <ConfirmForm
                title={t("confirm.deleteIdeaTitle")}
                description={t("confirm.deleteIdeaBody", { name: editingItem.name })}
                confirmLabel={t("confirm.deleteIdeaConfirm")}
                cancelLabel={t("confirm.deleteIdeaKeep")}
                action={deleteItemAction}
                fields={{ wishlistId, itemId: editingItem.id, onglet: "idees" }}
                triggerLabel={t("form.delete")}
                triggerVariant="destructive"
                triggerSize="sm"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
