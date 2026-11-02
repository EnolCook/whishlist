"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PriorityStarPicker } from "@/components/site/priority-star-picker";
import type { LlmImpact } from "@/src/domain/llm-impact";
import {
  enrichFromUrlAction,
  saveItemAction,
  type ItemFormDraft,
  type SaveItemState,
} from "@/src/server/actions";

function initialDraft(input: {
  item?: {
    name: string;
    typeId: string;
    personId: string;
    url: string | null;
    imageUrl: string | null;
    priority: string | null;
  };
  price?: string;
  types: { id: string }[];
  people: { id: string }[];
}): ItemFormDraft {
  return {
    name: input.item?.name ?? "",
    typeId: input.item?.typeId ?? input.types[0]?.id ?? "",
    personId: input.item?.personId ?? input.people[0]?.id ?? "",
    url: input.item?.url ?? "",
    imageUrl: "",
    price: input.price ?? "",
    priority: input.item?.priority && /^[1-5]$/.test(input.item.priority) ? input.item.priority : "",
  };
}

function formatImpactNumber(value: number, digits = 2): string {
  if (value >= 10) return value.toFixed(0);
  if (value >= 1) return value.toFixed(1);
  if (value >= 0.01) return value.toFixed(digits);
  return value.toExponential(1);
}

export function ItemForm({
  wishlistId,
  types,
  people,
  item,
  price,
  onglet = "idees",
  llmEnabled = false,
}: {
  wishlistId: string;
  types: { id: string; label: string }[];
  people: { id: string; label: string }[];
  item?: {
    id: string;
    name: string;
    typeId: string;
    personId: string;
    url: string | null;
    imageUrl: string | null;
    priority: string | null;
  };
  price?: string;
  onglet?: string;
  llmEnabled?: boolean;
}) {
  const { t } = useTranslation(["list", "common", "errors"]);
  const id = item?.id ?? "new";
  const [state, formAction, pending] = useActionState(saveItemAction, null as SaveItemState);
  const [appliedState, setAppliedState] = useState(state);
  const [draft, setDraft] = useState(() => initialDraft({ item, price, types, people }));
  const [previewImage, setPreviewImage] = useState(item?.imageUrl ?? "");
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichPending, startEnrich] = useTransition();
  const [impact, setImpact] = useState<LlmImpact | null>(null);
  const [usedLlm, setUsedLlm] = useState(false);

  if (state !== appliedState) {
    setAppliedState(state);
    if (state?.draft) {
      setDraft(state.draft);
      if (state.draft.imageUrl) setPreviewImage(state.draft.imageUrl);
    }
  }

  function setField<K extends keyof ItemFormDraft>(key: K, value: ItemFormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function enrich() {
    setEnrichError(null);
    setImpact(null);
    setUsedLlm(false);
    startEnrich(async () => {
      const result = await enrichFromUrlAction({ url: draft.url, wishlistId });
      if (!result.ok) {
        setEnrichError(result.error);
        return;
      }
      setDraft((prev) => ({
        ...prev,
        name: result.name || prev.name,
        price: result.price || prev.price,
        imageUrl: result.imageUrl || prev.imageUrl,
        typeId: result.typeId || prev.typeId,
      }));
      if (result.imageUrl) setPreviewImage(result.imageUrl);
      setUsedLlm(result.usedLlm);
      setImpact(result.impact);
    });
  }

  const errorCode = state?.error ?? enrichError;
  const error = errorCode ? t(`errors:${errorCode}`, { defaultValue: errorCode }) : null;

  // Ce formulaire sert en pleine page (~700 px) et dans le dialogue « Modifier l'idée », que
  // DialogContent plafonne à `sm:max-w-lg` (~455 px de grille utile). Les points de rupture sont
  // donc ceux du conteneur `FieldGroup` (`@…/field-group:`) et non ceux de la fenêtre : un `sm:`
  // classique se déclenche sur la largeur de l'écran et passait la grille en 4 colonnes dans le
  // dialogue aussi, où les listes déroulantes tombaient à 61 px et 44 px.
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FieldGroup className="gap-3">
        <input type="hidden" name="wishlistId" value={wishlistId} />
        <input type="hidden" name="onglet" value={onglet} />
        {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
        {error ? (
          <p className="rounded-base border-2 border-border bg-secondary-background px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-url`}>{t("form.url")}</FieldLabel>
          <div className="flex flex-col gap-2 @lg/field-group:flex-row @lg/field-group:items-start">
            <Input
              id={`${id}-url`}
              name="url"
              type="url"
              value={draft.url}
              onChange={(e) => setField("url", e.target.value)}
              placeholder="https://"
              className="min-w-0 @lg/field-group:flex-1"
            />
            {llmEnabled ? (
              <Button
                type="button"
                variant="neutral"
                disabled={enrichPending || !draft.url.trim()}
                onClick={enrich}
                className="shrink-0"
              >
                {enrichPending ? t("common:actions.loading") : t("form.fetchInfosAi")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="neutral"
                disabled={enrichPending || !draft.url.trim()}
                onClick={enrich}
                className="shrink-0"
              >
                {enrichPending ? t("common:actions.loading") : t("form.fetchInfos")}
              </Button>
            )}
          </div>
        </Field>
        {usedLlm ? (
          <Alert>
            <SparklesIcon />
            <AlertTitle>{t("form.aiTitle")}</AlertTitle>
            <AlertDescription>
              <p>{t("form.aiBody")}</p>
              {impact ? (
                <ul className="mt-2 list-disc pl-4">
                  <li>
                    {t("form.aiTokens", {
                      count: impact.totalTokens,
                    })}
                  </li>
                  <li>
                    {t("form.aiCo2", {
                      grams: formatImpactNumber(impact.co2Grams),
                      beef: formatImpactNumber(impact.beefGrams, 3),
                    })}
                  </li>
                </ul>
              ) : null}
              <p className="mt-2 text-xs">{t("form.aiDisclaimer")}</p>
            </AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("form.name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            required
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </Field>
        <div className="grid gap-3 @sm/field-group:grid-cols-2 @xl/field-group:grid-cols-[1fr_1fr_6.5rem_auto] @xl/field-group:items-start">
          <Field>
            <FieldLabel htmlFor={`${id}-type`}>{t("form.type")}</FieldLabel>
            <NativeSelect
              id={`${id}-type`}
              name="typeId"
              className="w-full"
              value={draft.typeId}
              onChange={(e) => setField("typeId", e.target.value)}
              required
            >
              {types.map((type) => (
                <NativeSelectOption key={type.id} value={type.id}>
                  {type.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-person`}>{t("form.person")}</FieldLabel>
            <NativeSelect
              id={`${id}-person`}
              name="personId"
              className="w-full"
              value={draft.personId}
              onChange={(e) => setField("personId", e.target.value)}
              required
            >
              {people.map((person) => (
                <NativeSelectOption key={person.id} value={person.id}>
                  {person.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-price`}>{t("form.price")}</FieldLabel>
            <Input
              id={`${id}-price`}
              name="price"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => setField("price", e.target.value)}
              placeholder={t("form.pricePlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-priority`}>{t("form.priority")}</FieldLabel>
            <PriorityStarPicker
              id={`${id}-priority`}
              value={draft.priority}
              onChange={(next) => setField("priority", next)}
            />
            {/* La piste `auto` se dimensionne sur son contenu le plus large : sans `contain`, cette
                phrase passait devant les étoiles et prenait 379 px des 700 px de la grille.
                `contain-inline-size` la retire de ce calcul ; elle occupe ensuite la largeur de la
                colonne (`*:w-full` de `Field`). */}
            <FieldDescription className="contain-inline-size">{t("form.priorityHint")}</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-image`}>{t("form.image")}</FieldLabel>
          <div className="flex items-center gap-2">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-shadow">
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImage}
                  alt={draft.name.trim() || t("form.imageAlt")}
                  className="size-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>
            <Input
              id={`${id}-image`}
              name="imageUrl"
              type="url"
              value={draft.imageUrl || previewImage}
              onChange={(e) => {
                const next = e.target.value;
                setField("imageUrl", next);
                setPreviewImage(next);
              }}
              placeholder="https://"
              className="min-w-0 flex-1"
            />
          </div>
        </Field>
        <Button type="submit" disabled={pending} className="w-full @lg/field-group:w-auto">
          {pending ? t("common:actions.loading") : item ? t("form.save") : t("form.add")}
        </Button>
      </FieldGroup>
    </form>
  );
}
