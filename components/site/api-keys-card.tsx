"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmForm } from "@/components/site/confirm-form";
import { CopyLinkField } from "@/components/site/copy-link-field";
import { InsetPanel, InsetPanelItem } from "@/components/site/inset-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_API_KEY_NAME } from "@/src/domain/api-key-limits";
import { createApiKeyAction, revokeApiKeyFormAction } from "@/src/server/actions";

export type ApiKeyRow = { id: string; name: string; hint: string; created: string; lastUsed: string | null };

/**
 * Page Compte, « Clés d'API et assistants IA » : créer une clé (affichée une seule fois), voir et révoquer les
 * siennes, et l'adresse du serveur MCP à donner à un assistant.
 */
export function ApiKeysCard({ keys, mcpUrl, notice }: { keys: ApiKeyRow[]; mcpUrl: string; notice: string | null }) {
  const { t } = useTranslation(["auth", "errors"]);
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ token: string; keyId: string; keysThen: ApiKeyRow[] } | null>(null);
  // La clé créée reste affichée tant qu'elle existe : avant le rafraîchissement de la liste (`keysThen`), ou
  // tant que sa ligne y est. Révoquée, elle disparaît avec sa ligne.
  const token =
    created && (keys === created.keysThen || keys.some((key) => key.id === created.keyId)) ? created.token : null;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    if (!name.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await createApiKeyAction({ name });
      if (!result.ok) {
        setError(t(`errors:${result.error}`, { defaultValue: result.error }));
        return;
      }
      setCreated({ token: result.token, keyId: result.keyId, keysThen: keys });
      setName("");
      // Un avis d'une action précédente (« clé révoquée ») ne vaut plus : on le retire de l'adresse.
      if (notice) router.replace(pathname, { scroll: false });
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {token ? (
        <InsetPanel className="flex flex-col gap-2">
          <CopyLinkField id="api-key-token" label={t("apiKeys.tokenLabel")} value={token} copyLabel={t("apiKeys.copy")} />
          <p className="text-sm font-medium text-pretty">{t("apiKeys.copyNow")}</p>
        </InsetPanel>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-0 flex-1 basis-48">
          <FieldLabel htmlFor="api-key-name">{t("apiKeys.name")}</FieldLabel>
          <Input
            id="api-key-name"
            value={name}
            maxLength={MAX_API_KEY_NAME}
            placeholder={t("apiKeys.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                create();
              }
            }}
          />
        </Field>
        <Button type="button" onClick={create} disabled={pending || !name.trim()}>
          {t("apiKeys.create")}
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {keys.length === 0 ? (
        <Empty className="shadow-none">
          <EmptyHeader>
            <EmptyTitle>{t("apiKeys.empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {keys.map((key) => (
            <InsetPanelItem key={key.id} className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="font-bold break-words">
                  {key.name} <span className="font-mono text-sm font-normal text-muted-foreground">…{key.hint}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("apiKeys.createdOn", { date: key.created })} ·{" "}
                  {key.lastUsed ? t("apiKeys.lastUsed", { date: key.lastUsed }) : t("apiKeys.neverUsed")}
                </p>
              </div>
              <ConfirmForm
                title={t("apiKeys.revokeTitle")}
                description={t("apiKeys.revokeBody", { name: key.name })}
                confirmLabel={t("apiKeys.revokeConfirm")}
                cancelLabel={t("apiKeys.revokeKeep")}
                action={revokeApiKeyFormAction}
                fields={{ keyId: key.id }}
                triggerLabel={t("apiKeys.revoke")}
                triggerVariant="outline"
                triggerSize="sm"
                confirmVariant="destructive"
              />
            </InsetPanelItem>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t-2 border-border pt-4">
        <p className="font-bold">{t("apiKeys.mcpTitle")}</p>
        <CopyLinkField id="mcp-url" label={t("apiKeys.mcpUrl")} value={mcpUrl} hint={t("apiKeys.mcpHint")} copyLabel={t("apiKeys.copyMcpUrl")} />
      </div>
    </div>
  );
}
