"use client";

import { useId, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { transferItemAction } from "@/src/server/actions";

/** Une liste dont on est membre, avec ses catégories et ses « qui ». */
export type TransferTarget = {
  id: string;
  title: string;
  types: { id: string; label: string }[];
  people: { id: string; label: string }[];
};

export type TransferDone = { mode: "move" | "copy"; target: TransferTarget };

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** Même nom dans la liste d'arrivée (casse et espaces ignorés), sinon la première entrée. */
function matching(options: { id: string; label: string }[], label: string | undefined): string {
  return (label ? options.find((option) => sameLabel(option.label, label)) : undefined)?.id ?? options[0]?.id ?? "";
}

export function MoveCopyDialog({
  wishlistId,
  item,
  typeLabel,
  personLabel,
  targets,
  onDone,
}: {
  wishlistId: string;
  item: { id: string; name: string };
  /** Libellés actuels de l'idée, pour pré-choisir les mêmes dans la liste d'arrivée. */
  typeLabel: string | undefined;
  personLabel: string | undefined;
  targets: TransferTarget[];
  onDone: (done: TransferDone) => void;
}) {
  const { t } = useTranslation(["list", "errors"]);
  const id = useId();
  const others = targets.filter((target) => target.id !== wishlistId);
  const canMove = others.length > 0;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"move" | "copy">(canMove ? "move" : "copy");
  const [targetId, setTargetId] = useState(others[0]?.id ?? wishlistId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choices = mode === "move" ? others : targets;
  const target = choices.find((entry) => entry.id === targetId) ?? choices[0];
  const [typeId, setTypeId] = useState(() => matching(target?.types ?? [], typeLabel));
  const [personId, setPersonId] = useState(() => matching(target?.people ?? [], personLabel));

  function chooseTarget(next: TransferTarget | undefined) {
    setTargetId(next?.id ?? "");
    setTypeId(matching(next?.types ?? [], typeLabel));
    setPersonId(matching(next?.people ?? [], personLabel));
  }

  function chooseMode(next: "move" | "copy") {
    setMode(next);
    setError(null);
    // La liste actuelle ne se propose que pour une copie.
    if (next === "move" && targetId === wishlistId) chooseTarget(others[0]);
  }

  function submit() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const result = await transferItemAction({
        mode,
        wishlistId,
        itemId: item.id,
        targetWishlistId: target.id,
        typeId,
        personId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDone({ mode, target });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>{t("transfer.open")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transfer.title")}</DialogTitle>
          <DialogDescription className="truncate">{item.name}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          {error ? (
            <p className="rounded-base border-2 border-border bg-secondary-background px-3 py-2 text-sm font-medium text-destructive">
              {t(`errors:${error}`, { defaultValue: error })}
            </p>
          ) : null}
          <FieldSet>
            <FieldLegend variant="label">{t("transfer.mode")}</FieldLegend>
            {(["move", "copy"] as const).map((value) => (
              <Field key={value} orientation="horizontal" data-disabled={value === "move" && !canMove ? true : undefined}>
                <input
                  type="radio"
                  id={`${id}-${value}`}
                  name={`${id}-mode`}
                  value={value}
                  checked={mode === value}
                  disabled={value === "move" && !canMove}
                  onChange={() => chooseMode(value)}
                  className="mt-0.5 size-4 shrink-0 accent-main"
                />
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-${value}`}>{t(`transfer.${value}`)}</FieldLabel>
                  <FieldDescription>{t(`transfer.${value}Hint`)}</FieldDescription>
                </FieldContent>
              </Field>
            ))}
            {!canMove ? <FieldDescription>{t("transfer.onlyList")}</FieldDescription> : null}
          </FieldSet>
          <Field>
            <FieldLabel htmlFor={`${id}-target`}>{t("transfer.target")}</FieldLabel>
            <NativeSelect
              id={`${id}-target`}
              className="w-full"
              value={target?.id ?? ""}
              onChange={(event) => chooseTarget(choices.find((entry) => entry.id === event.target.value))}
            >
              {choices.map((entry) => (
                <NativeSelectOption key={entry.id} value={entry.id}>
                  {entry.id === wishlistId ? t("transfer.thisList", { title: entry.title }) : entry.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {/* Deux colonnes selon la place du dialogue, pas la largeur de la fenêtre. */}
          <div className="@container">
            <div className="grid gap-4 @sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-type`}>{t("form.type")}</FieldLabel>
                <NativeSelect id={`${id}-type`} className="w-full" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                  {(target?.types ?? []).map((type) => (
                    <NativeSelectOption key={type.id} value={type.id}>
                      {type.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-person`}>{t("form.person")}</FieldLabel>
                <NativeSelect id={`${id}-person`} className="w-full" value={personId} onChange={(event) => setPersonId(event.target.value)}>
                  {(target?.people ?? []).map((person) => (
                    <NativeSelectOption key={person.id} value={person.id}>
                      {person.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" disabled={pending || !target || !typeId || !personId} onClick={submit}>
            {mode === "move" ? t("transfer.submitMove") : t("transfer.submitCopy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
