import { listApiKeys } from "../../src/domain/api-keys";
import { origin } from "../../src/auth/current";
import { requireUser } from "../../src/auth/guard";
import { listMyOffers } from "../../src/domain/offrir";
import { previewAccountDeletion } from "../../src/domain/account";
import { pendingEmailChange } from "../../src/domain/email-confirmation";
import {
  cancelEmailChangeAction,
  changePasswordAction,
  requestEmailChangeAction,
  updateDisplayNameAction,
} from "../../src/server/actions";
import { getDocument } from "../../src/store/db";
import { ApiKeysCard } from "@/components/site/api-keys-card";
import { DeleteAccountDialog } from "@/components/site/delete-account-dialog";
import { DevLinkAlert } from "@/components/site/dev-link-alert";
import { InsetPanel } from "@/components/site/inset-panel";
import { LinkButton } from "@/components/site/link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/src/domain/passwords";
import { intlLocale } from "@/src/i18n/config";
import { withLocale } from "@/src/i18n/locale-path";
import { getLocale, getTranslations, translateError } from "@/src/i18n/server";
import { emailVerificationRequired } from "@/src/server/mail";

export const dynamic = "force-dynamic";

export default async function ComptePage({
  searchParams,
}: {
  /**
   * `e` / `ok` : profil et mot de passe ; `email` / `ee` / `lien` : changement d'adresse ; `x` : export ;
   * `d` : suppression du compte ; `k` : clés d'API.
   */
  searchParams: Promise<{ e?: string; ok?: string; x?: string; d?: string; email?: string; ee?: string; lien?: string; k?: string }>;
}) {
  const user = await requireUser({ allowMustChangePassword: true });
  const query = await searchParams;
  const [t, doc, locale, siteOrigin] = await Promise.all([
    getTranslations("auth"),
    getDocument(),
    getLocale(),
    origin(),
  ]);
  const forced = user.mustChangePassword;
  const offers = forced ? [] : listMyOffers(doc, user.id, intlLocale(locale));
  const passwordError =
    query.e === "mismatch"
      ? t("changePassword.errorMismatch")
      : query.e === "current"
        ? t("changePassword.errorCurrent")
        : query.e === "password"
          ? t("changePassword.errorPassword")
          : query.e === "1"
            ? t("changePassword.errorGeneric")
            : null;
  const profileError =
    query.e &&
    !passwordError &&
    query.e !== "mismatch" &&
    query.e !== "current" &&
    query.e !== "password" &&
    query.e !== "1"
      ? await translateError(query.e)
      : null;
  const profileOk = query.ok === "name";
  const exportError = query.x ? await translateError(query.x) : null;
  const deleteError = query.d ? await translateError(query.d) : null;
  const deletion = forced ? null : previewAccountDeletion(doc, user.id);
  const passwordOk = query.ok === "1";
  const pendingEmail = forced ? null : pendingEmailChange(doc, user.id);
  const emailError = query.ee ? await translateError(query.ee) : null;
  const emailFeedback =
    query.email === "pending"
      ? t("account.emailChange.sent")
      : query.email === "failed"
        ? t("verifyBanner.failed")
        : query.email === "changed"
          ? t("account.emailChange.changed", { email: user.email })
          : query.email === "cancelled"
            ? t("account.emailChange.cancelled")
            : null;
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" });
  const apiKeys = forced
    ? []
    : listApiKeys(doc, user.id).map((key) => ({
        id: key.id,
        name: key.name,
        hint: key.hint,
        created: dateFormat.format(new Date(key.createdAt)),
        lastUsed: key.lastUsedAt ? dateFormat.format(new Date(key.lastUsedAt)) : null,
      }));
  const apiKeyNotice = !query.k ? null : query.k === "revoked" ? t("apiKeys.revoked") : await translateError(query.k);
  const mcpUrl = `${siteOrigin}/api/mcp`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("account.title")}</h1>
        {!forced ? <p className="text-muted-foreground">{t("account.subtitle")}</p> : null}
      </div>

      {forced ? (
        <Alert variant="destructive">
          <AlertDescription>{t("changePassword.descriptionForced", { email: user.email })}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("account.profile")}</CardTitle>
            <CardDescription>{t("account.profileHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateDisplayNameAction} className="flex flex-col gap-4">
              <FieldGroup>
                {profileOk ? (
                  <Alert>
                    <AlertDescription>{t("account.nameSaved")}</AlertDescription>
                  </Alert>
                ) : null}
                {profileError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{profileError}</AlertDescription>
                  </Alert>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="displayName">{t("account.displayName")}</FieldLabel>
                  <Input
                    id="displayName"
                    name="displayName"
                    required
                    maxLength={80}
                    defaultValue={user.displayName}
                    autoComplete="nickname"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-email">{t("account.email")}</FieldLabel>
                  <Input id="account-email" value={user.email} readOnly className="bg-muted" />
                  <p className="text-xs text-muted-foreground">{t("account.emailHint")}</p>
                </Field>
                <Button type="submit">{t("account.saveName")}</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}

      {!forced ? (
        <Card id="email">
          <CardHeader>
            <CardTitle>{t("account.emailChange.title")}</CardTitle>
            <CardDescription>
              {emailVerificationRequired() ? t("account.emailChange.description") : t("account.emailChange.descriptionNoMail")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {t("account.emailChange.current", { email: user.email })}
              {emailVerificationRequired() ? (
                <Badge variant={user.emailVerifiedAt ? "secondary" : "default"}>
                  {user.emailVerifiedAt ? t("account.emailChange.verified") : t("account.emailChange.unverified")}
                </Badge>
              ) : null}
            </p>
            {emailFeedback ? (
              <Alert>
                <AlertDescription>{emailFeedback}</AlertDescription>
              </Alert>
            ) : null}
            <DevLinkAlert
              label={t("account.emailChange.devLink")}
              url={query.lien}
              origin={siteOrigin}
              page="/confirmer-email/"
            />
            {emailError ? (
              <Alert variant="destructive">
                <AlertDescription>{emailError}</AlertDescription>
              </Alert>
            ) : null}
            {pendingEmail ? (
              <form action={cancelEmailChangeAction} className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">{t("account.emailChange.pending", { email: pendingEmail })}</p>
                <Button type="submit" variant="neutral">
                  {t("account.emailChange.cancel")}
                </Button>
              </form>
            ) : null}
            <form action={requestEmailChangeAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-email">{t("account.emailChange.newEmail")}</FieldLabel>
                  <Input id="new-email" name="email" type="email" required autoComplete="email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email-current-password">{t("account.emailChange.currentPassword")}</FieldLabel>
                  <Input
                    id="email-current-password"
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </Field>
                <Button type="submit">{t("account.emailChange.submit")}</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {!forced ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("account.offers")}</CardTitle>
            <CardDescription>{t("account.offersHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {offers.length === 0 ? (
              <Empty className="shadow-none">
                <EmptyHeader>
                  <EmptyTitle>{t("account.offersEmpty")}</EmptyTitle>
                  <EmptyDescription>{t("account.offersEmptyHint")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              offers.map((offer) => (
                <InsetPanel key={offer.reservationId} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-bold text-balance">{offer.itemName}</p>
                      <p className="text-sm text-muted-foreground">{offer.listTitle}</p>
                    </div>
                    {offer.priceLabel ? (
                      <p className="shrink-0 text-lg font-bold tabular-nums">{offer.priceLabel}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {offer.typeLabel ? <Badge variant="outline">{offer.typeLabel}</Badge> : null}
                    {offer.fromName ? (
                      <Badge variant="secondary">{t("account.offeredAs", { name: offer.fromName })}</Badge>
                    ) : null}
                  </div>
                  {offer.note ? <p className="text-sm text-pretty">{offer.note}</p> : null}
                  {offer.listReadToken ? (
                    <LinkButton
                      href={`/l/${offer.listReadToken}`}
                      variant="link"
                      size="sm"
                      className="h-auto w-fit px-0"
                    >
                      {t("account.openList")}
                    </LinkButton>
                  ) : null}
                </InsetPanel>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {!forced ? (
        <Card id="cles">
          <CardHeader>
            <CardTitle>{t("apiKeys.title")}</CardTitle>
            <CardDescription>{t("apiKeys.hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeysCard keys={apiKeys} mcpUrl={mcpUrl} notice={apiKeyNotice} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{forced ? t("changePassword.titleForced") : t("changePassword.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={changePasswordAction}>
            <FieldGroup>
              {passwordOk ? (
                <Alert>
                  <AlertDescription>{t("changePassword.success")}</AlertDescription>
                </Alert>
              ) : null}
              {passwordError ? (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              ) : null}
              {!forced ? (
                <Field>
                  <FieldLabel htmlFor="currentPassword">{t("changePassword.current")}</FieldLabel>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="password">{t("changePassword.next")}</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
                <FieldDescription>{t("changePassword.nextHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm">{t("changePassword.confirm")}</FieldLabel>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </Field>
              <Button type="submit">
                {forced ? t("changePassword.submitForced") : t("changePassword.submit")}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {deletion ? (
        <>
          <Card id="donnees">
            <CardHeader>
              <CardTitle>{t("account.dataTitle")}</CardTitle>
              <CardDescription>{t("account.exportHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {exportError ? (
                <Alert variant="destructive">
                  <AlertDescription>{exportError}</AlertDescription>
                </Alert>
              ) : null}
              <a href={withLocale(locale, "/compte/export")} download className={buttonVariants({ variant: "outline" })}>
                {t("account.exportAction")}
              </a>
            </CardContent>
          </Card>

          <Card id="supprimer">
            <CardHeader>
              <CardTitle>{t("account.deleteTitle")}</CardTitle>
              <CardDescription>{t("account.deleteHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {deleteError ? (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              ) : null}
              <DeleteAccountDialog preview={deletion} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
