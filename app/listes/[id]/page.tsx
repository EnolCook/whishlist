import { notFound, redirect } from "next/navigation";
import { currentUser, origin } from "../../../src/auth/current";
import { findMembership } from "../../../src/domain/access";
import { listOffrir } from "../../../src/domain/offrir";
import { formatPrice, priceInput } from "../../../src/domain/price";
import { IdeasAccordion } from "@/components/site/ideas-accordion";
import { LinkButton } from "@/components/site/link-button";
import { llmConfigured } from "@/src/domain/product-llm";
import { ItemForm } from "@/components/site/item-form";
import { LabelChips } from "@/components/site/label-chips";
import {
  cancelReservationAction,
  clearReadPasswordAction,
  deleteItemAction,
  deleteListAction,
  leaveAction,
  regenerateInviteAction,
  removeMemberAction,
  sendInviteAction,
  setItemArchivedFormAction,
  setReadPasswordAction,
} from "../../../src/server/actions";
import { hasReadPassword, MIN_READ_PASSWORD_LENGTH } from "../../../src/domain/read-password";
import { resolveTheme } from "../../../src/domain/theme";
import { getDocument } from "../../../src/store/db";
import { AppearanceForm } from "@/components/site/appearance-form";
import { ConfirmForm } from "@/components/site/confirm-form";
import { CopyLinkField } from "@/components/site/copy-link-field";
import { LiveGiftMark } from "@/components/site/live-gift-mark";
import { WishlistThemeScope } from "@/components/site/wishlist-theme-scope";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { intlLocale } from "@/src/i18n/config";
import { getLocale, getTranslations, translateError } from "@/src/i18n/server";
import { withLocale } from "@/src/i18n/locale-path";

export const dynamic = "force-dynamic";

const TAB_IDS = ["idees", "archives", "reservations", "partage", "reglages"] as const;
type TabId = (typeof TAB_IDS)[number];

function parseTab(value: string | undefined): TabId {
  if (value === "categories") return "reglages";
  return TAB_IDS.includes(value as TabId) ? (value as TabId) : "idees";
}

function tabHref(listId: string, tab: TabId): string {
  return tab === "idees" ? `/listes/${listId}` : `/listes/${listId}?onglet=${tab}`;
}

export default async function EditListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; ok?: string; onglet?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = parseTab(query.onglet);
  const [t, tErrors, user, doc, locale] = await Promise.all([
    getTranslations("list"),
    getTranslations("errors"),
    currentUser(),
    getDocument(),
    getLocale(),
  ]);
  const priceLocale = intlLocale(locale);
  if (!user) redirect(withLocale(locale, `/connexion?next=/listes/${id}`));
  if (user.mustChangePassword) redirect(withLocale(locale, "/compte"));
  const list = doc.wishlists.find((entry) => entry.id === id);
  if (!list) notFound();
  const membership = findMembership(doc, id, user.id);
  if (!membership) {
    return (
      <main className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">{tErrors("accessDenied")}</h1>
        <p className="text-muted-foreground">{tErrors("notMember")}</p>
      </main>
    );
  }
  const base = await origin();
  const readUrl = `${base}${withLocale(locale, `/l/${list.readToken}`)}`;
  const inviteUrl = `${base}${withLocale(locale, `/inviter/${list.inviteToken}`)}`;
  const types = doc.types
    .filter((type) => type.wishlistId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const people = doc.people.filter((person) => person.wishlistId === id);
  const items = doc.items.filter((item) => item.wishlistId === id).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeItems = items.filter((item) => !item.archived);
  const archivedItems = items.filter((item) => item.archived);
  const members = doc.memberships
    .filter((entry) => entry.wishlistId === id)
    .map((entry) => ({ ...entry, user: doc.users.find((account) => account.id === entry.userId) }));
  const reservations = listOffrir(doc, id);
  const personLabel = new Map(people.map((person) => [person.id, person.label]));
  const typeLabel = new Map(types.map((type) => [type.id, type.label]));
  const ideaItems = activeItems.map((item) => ({
    id: item.id,
    name: item.name,
    typeId: item.typeId,
    personId: item.personId,
    personLabel: personLabel.get(item.personId) ?? item.personId,
    url: item.url,
    imageUrl: item.imageUrl,
    priceLabel: formatPrice(item.priceCents, priceLocale),
    price: priceInput(item.priceCents, priceLocale),
    priority: item.priority,
    secondHandOk: item.secondHandOk,
    description: item.description,
    sortOrder: item.sortOrder,
  }));
  // Listes où l'idée peut être déplacée ou copiée : celles dont on est membre.
  const transferTargets = doc.memberships
    .filter((entry) => entry.userId === user.id)
    .flatMap((entry) => doc.wishlists.filter((wishlist) => wishlist.id === entry.wishlistId))
    .sort((a, b) => a.title.localeCompare(b.title, locale))
    .map((wishlist) => ({
      id: wishlist.id,
      title: wishlist.title,
      types: doc.types
        .filter((type) => type.wishlistId === wishlist.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
        .map((type) => ({ id: type.id, label: type.label })),
      people: doc.people
        .filter((person) => person.wishlistId === wishlist.id)
        .map((person) => ({ id: person.id, label: person.label })),
    }));
  const error = query.e ? await translateError(query.e) : null;
  const theme = resolveTheme(list.theme);
  const llmEnabled = llmConfigured();
  return (
    <WishlistThemeScope theme={theme}>
    <main className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <LiveGiftMark className="size-12" />
          <h1 className="text-2xl font-medium tracking-tight">{list.title}</h1>
        </div>
        <LinkButton href={readUrl} variant="outline" size="sm">
          {t("viewAsGuest")}
        </LinkButton>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {query.ok === "invite" ? (
        <Alert>
          <AlertDescription>{t("inviteSent")}</AlertDescription>
        </Alert>
      ) : null}
      {query.ok === "readPassword" ? (
        <Alert>
          <AlertDescription>{t("share.readPasswordSaved")}</AlertDescription>
        </Alert>
      ) : null}
      {query.ok === "readPasswordCleared" ? (
        <Alert>
          <AlertDescription>{t("share.readPasswordCleared")}</AlertDescription>
        </Alert>
      ) : null}
      <nav aria-label={t("tabs.navLabel")} className="flex flex-wrap gap-2">
        {TAB_IDS.map((entry) => (
          <LinkButton
            key={entry}
            href={tabHref(id, entry)}
            size="sm"
            className="h-auto max-w-full whitespace-normal text-left"
            variant={tab === entry ? "default" : "outline"}
            aria-current={tab === entry ? "true" : undefined}
          >
            {t(`tabs.${entry}`)}
            {entry === "reservations" && reservations.length > 0 ? ` (${reservations.length})` : null}
            {entry === "idees" ? ` (${activeItems.length})` : null}
            {entry === "archives" && archivedItems.length > 0 ? ` (${archivedItems.length})` : null}
          </LinkButton>
        ))}
      </nav>

      {tab === "idees" ? (
        <div className="flex flex-col gap-6">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>{t("addIdea")}</CardTitle>
              <CardDescription>{t("addIdeaHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemForm
                wishlistId={id}
                types={types}
                people={people}
                onglet="idees"
                llmEnabled={llmEnabled}
              />
            </CardContent>
          </Card>
          <IdeasAccordion
            wishlistId={id}
            types={types.map((type) => ({
              id: type.id,
              label: type.label,
              sortOrder: type.sortOrder,
            }))}
            people={people.map((person) => ({ id: person.id, label: person.label }))}
            items={ideaItems}
            targets={transferTargets}
            llmEnabled={llmEnabled}
          />
        </div>
      ) : null}

      {tab === "archives" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("archives.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("archives.hint")}</p>
          {archivedItems.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("archives.empty")}</EmptyTitle>
                <EmptyDescription>{t("archives.emptyHint")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            archivedItems.map((item) => (
              <Card key={item.id} size="sm">
                <CardHeader>
                  <CardTitle className="text-balance">{item.name}</CardTitle>
                  <CardDescription className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{typeLabel.get(item.typeId) ?? item.typeId}</Badge>
                    <Badge variant="outline">{personLabel.get(item.personId) ?? item.personId}</Badge>
                    {item.priceCents !== null ? (
                      <Badge variant="outline">{formatPrice(item.priceCents, priceLocale)}</Badge>
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <form action={setItemArchivedFormAction}>
                    <input type="hidden" name="wishlistId" value={id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="archived" value="0" />
                    <input type="hidden" name="onglet" value="archives" />
                    <Button type="submit" variant="outline" size="sm">
                      {t("archives.restore")}
                    </Button>
                  </form>
                  <ConfirmForm
                    title={t("confirm.deleteArchiveTitle")}
                    description={t("confirm.deleteArchiveBody", { name: item.name })}
                    confirmLabel={t("confirm.deleteArchiveConfirm")}
                    cancelLabel={t("confirm.deleteArchiveKeep")}
                    action={deleteItemAction}
                    fields={{ wishlistId: id, itemId: item.id, onglet: "archives" }}
                    triggerLabel={t("archives.deleteForever")}
                    triggerVariant="destructive"
                    triggerSize="sm"
                  />
                </CardContent>
              </Card>
            ))
          )}
        </section>
      ) : null}

      {tab === "reservations" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("reservations.title")}</h2>
          {reservations.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("reservations.empty")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            reservations.map((row) => (
              <Card key={row.reservationId} size="sm">
                <CardHeader>
                  <CardTitle className="text-balance">{row.itemName}</CardTitle>
                  {row.typeLabel ? (
                    <CardDescription>
                      <Badge variant="secondary">{row.typeLabel}</Badge>
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-3">
                  {row.fromName ? <p>{t("reservations.from", { name: row.fromName })}</p> : null}
                  {row.note ? <p className="text-muted-foreground">{row.note}</p> : null}
                  <ConfirmForm
                    title={t("reservations.cancelTitle")}
                    description={t("reservations.cancelBody")}
                    confirmLabel={t("reservations.cancelConfirm")}
                    cancelLabel={t("reservations.cancelKeep")}
                    action={cancelReservationAction}
                    fields={{
                      wishlistId: id,
                      reservationId: row.reservationId,
                      onglet: "reservations",
                    }}
                    triggerLabel={t("reservations.cancel")}
                    triggerVariant="outline"
                    triggerSize="sm"
                  />
                </CardContent>
              </Card>
            ))
          )}
        </section>
      ) : null}

      {tab === "partage" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{t("share.title")}</h2>
            <p className="text-muted-foreground text-pretty">{t("share.description")}</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("share.readTitle")}</CardTitle>
              <CardDescription>{t("share.readDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <CopyLinkField
                id="read-url"
                label={t("share.readLink")}
                value={readUrl}
                copyLabel={t("share.copyRead")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("share.collabTitle")}</CardTitle>
              <CardDescription>{t("share.collabDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <CopyLinkField
                id="invite-url"
                label={t("share.inviteLink")}
                value={inviteUrl}
                copyLabel={t("share.copyInvite")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("share.inviteEmailTitle")}</CardTitle>
              <CardDescription>{t("share.inviteEmailDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form action={sendInviteAction}>
                <FieldGroup>
                  <input type="hidden" name="wishlistId" value={id} />
                  <input type="hidden" name="onglet" value="partage" />
                  <Field>
                    <FieldLabel htmlFor="invite-email">{t("share.inviteEmail")}</FieldLabel>
                    <Input
                      id="invite-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="prenom@exemple.fr"
                    />
                  </Field>
                  <Button type="submit">{t("share.sendInvite")}</Button>
                </FieldGroup>
              </form>
              {membership.role === "owner" ? (
                <div className="flex flex-col gap-2">
                  <ConfirmForm
                    title={t("confirm.regenTitle")}
                    description={t("confirm.regenBody")}
                    confirmLabel={t("confirm.regenConfirm")}
                    cancelLabel={t("confirm.regenKeep")}
                    action={regenerateInviteAction}
                    fields={{ wishlistId: id, onglet: "partage" }}
                    triggerLabel={t("share.regenerate")}
                    triggerVariant="outline"
                    confirmVariant="default"
                  />
                  <p className="text-sm text-muted-foreground">{t("share.regenerateHint")}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          {membership.role === "owner" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("share.readPassword")}</CardTitle>
                <CardDescription>{t("share.readPasswordHint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm font-medium">
                  {hasReadPassword(list) ? t("share.readPasswordSet") : t("share.readPasswordUnset")}
                </p>
                <form action={setReadPasswordAction}>
                  <FieldGroup>
                    <input type="hidden" name="wishlistId" value={id} />
                    <input type="hidden" name="onglet" value="partage" />
                    <p className="text-sm font-medium">
                      {hasReadPassword(list) ? t("share.readPasswordChange") : t("share.readPasswordDefine")}
                    </p>
                    <Field>
                      <FieldLabel htmlFor="read-password">{t("share.readPasswordLabel")}</FieldLabel>
                      <Input
                        id="read-password"
                        name="password"
                        type="password"
                        required
                        minLength={MIN_READ_PASSWORD_LENGTH}
                        autoComplete="new-password"
                      />
                    </Field>
                    <Button type="submit">{t("share.readPasswordSave")}</Button>
                  </FieldGroup>
                </form>
                {hasReadPassword(list) ? (
                  <ConfirmForm
                    title={t("confirm.clearPasswordTitle")}
                    description={t("confirm.clearPasswordBody")}
                    confirmLabel={t("confirm.clearPasswordConfirm")}
                    cancelLabel={t("confirm.clearPasswordKeep")}
                    action={clearReadPasswordAction}
                    fields={{ wishlistId: id, onglet: "partage" }}
                    triggerLabel={t("share.readPasswordClear")}
                    triggerVariant="outline"
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>{t("share.members")}</CardTitle>
              <CardDescription>{t("share.membersDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {members.map((member) => (
                <div key={member.userId} className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {member.user?.displayName}{" "}
                    <span className="font-normal text-muted-foreground">
                      — {member.role === "owner" ? t("share.owner") : t("share.member")}
                    </span>
                  </p>
                  {membership.role === "owner" && member.userId !== user.id ? (
                    <ConfirmForm
                      title={t("confirm.removeMemberTitle", {
                        name: member.user?.displayName ?? t("share.member"),
                      })}
                      description={t("confirm.removeMemberBody")}
                      confirmLabel={t("confirm.removeMemberConfirm")}
                      cancelLabel={t("confirm.removeMemberKeep")}
                      action={removeMemberAction}
                      fields={{ wishlistId: id, userId: member.userId, onglet: "partage" }}
                      triggerLabel={t("share.remove")}
                      triggerVariant="outline"
                      triggerSize="sm"
                    />
                  ) : null}
                </div>
              ))}
              <div className="pt-2">
                <ConfirmForm
                  title={t("confirm.leaveTitle")}
                  description={t("confirm.leaveBody")}
                  confirmLabel={t("confirm.leaveConfirm")}
                  cancelLabel={t("confirm.leaveKeep")}
                  action={leaveAction}
                  fields={{ wishlistId: id, onglet: "partage" }}
                  triggerLabel={t("share.leave")}
                  triggerVariant="outline"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "reglages" ? (
        <div className="flex max-w-3xl flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("categories.types")}</CardTitle>
              <CardDescription>{t("categories.typesHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LabelChips
                wishlistId={id}
                kind="type"
                items={types.map((type) => ({ id: type.id, label: type.label }))}
                addLabel={t("categories.newType")}
                addPlaceholder={t("categories.newTypePlaceholder")}
                addAria={t("categories.addTypeAria")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("categories.people")}</CardTitle>
              <CardDescription>{t("categories.peopleHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LabelChips
                wishlistId={id}
                kind="person"
                items={people.map((person) => ({ id: person.id, label: person.label }))}
                addLabel={t("categories.newPerson")}
                addPlaceholder={t("categories.newPersonPlaceholder")}
                addAria={t("categories.addPersonAria")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.appearance")}</CardTitle>
              <CardDescription>{t("settings.appearanceHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <AppearanceForm
                wishlistId={id}
                title={list.title}
                subtitle={list.subtitle}
                coverImageUrl={list.coverImageUrl}
                theme={theme}
              />
            </CardContent>
          </Card>
          {membership.role === "owner" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.danger")}</CardTitle>
                <CardDescription>{t("settings.dangerHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ConfirmForm
                  title={t("confirm.deleteListTitle", { name: list.title })}
                  description={t("confirm.deleteListBody")}
                  confirmLabel={t("confirm.deleteListConfirm")}
                  cancelLabel={t("confirm.deleteListKeep")}
                  action={deleteListAction}
                  fields={{ wishlistId: id, onglet: "reglages" }}
                  triggerLabel={t("settings.delete")}
                  triggerVariant="destructive"
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </main>
    </WishlistThemeScope>
  );
}
