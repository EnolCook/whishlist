import { currentUser } from "../../../src/auth/current";
import { canAccessPublicList } from "../../../src/auth/public-list";
import { listClaimedReservationIds } from "../../../src/auth/reservation-claim";
import {
  applyBudget,
  applyPerson,
  BUDGETS,
  categoryAnchorId,
  groupByCategory,
  parseBudget,
  sortByPriority,
  type BudgetId,
} from "../../../src/domain/filters";
import {
  listPublicVisibleItems,
  mineReservationIdsFor,
  toPublicItem,
} from "../../../src/domain/read";
import { viewerRelation } from "../../../src/domain/subscription";
import { resolveTheme, themeToCssVars } from "../../../src/domain/theme";
import { subscribeAction, unsubscribeAction } from "../../../src/server/actions";
import { getDocument } from "../../../src/store/db";
import { ConfirmForm } from "@/components/site/confirm-form";
import { LinkButton } from "@/components/site/link-button";
import { PublicItemCard } from "@/components/site/public-item-card";
import { ReadUnlockForm } from "@/components/site/read-unlock-form";
import { WishlistCover } from "@/components/site/wishlist-cover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { intlLocale } from "@/src/i18n/config";
import { getLocale, getTranslations, translateError } from "@/src/i18n/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { CSSProperties } from "react";

function unlockErrorMessage(
  e: string | undefined,
  t: (key: string) => string,
): string | null {
  if (e === "bad" || e === "badPassword") return t("unlock.badPassword");
  if (e === "rate" || e === "rateLimited") return t("unlock.rateLimited");
  if (e === "readPasswordRequired") return t("unlock.passwordRequiredToFollow");
  return null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ readToken: string }>;
}): Promise<Metadata> {
  const { readToken } = await params;
  const [t, tCommon, doc] = await Promise.all([
    getTranslations("public"),
    getTranslations("common"),
    getDocument(),
  ]);
  const list = doc.wishlists.find((entry) => entry.readToken === readToken);
  const name = list?.title.trim();
  return { title: name ? `${name} — ${tCommon("brand")}` : t("missingList") };
}

function listHref(readToken: string, qui: string | null, budget: BudgetId | null, hash?: string): string {
  const params = new URLSearchParams();
  if (qui) params.set("qui", qui);
  if (budget) params.set("budget", budget);
  const query = params.toString();
  const path = query ? `/l/${readToken}?${query}` : `/l/${readToken}`;
  return hash ? `${path}#${hash}` : path;
}

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ readToken: string }>;
  searchParams: Promise<{ qui?: string; budget?: string; ok?: string; followed?: string; subscribe?: string; e?: string }>;
}) {
  const { readToken } = await params;
  const query = await searchParams;
  const [t, locale, doc, user, claimedIds] = await Promise.all([
    getTranslations("public"),
    getLocale(),
    getDocument(),
    currentUser(),
    listClaimedReservationIds(readToken),
  ]);
  const list = doc.wishlists.find((entry) => entry.readToken === readToken);
  if (!list) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("missingList")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  if (!(await canAccessPublicList(doc, list, user))) {
    return (
      <ReadUnlockForm
        readToken={readToken}
        title={list.title}
        heading={t("unlock.heading")}
        description={t("unlock.description")}
        passwordLabel={t("unlock.password")}
        passwordHint={t("unlock.passwordHint")}
        submit={t("unlock.submit")}
        error={unlockErrorMessage(query.e, t)}
        subscribe={query.subscribe === "1"}
      />
    );
  }
  const pageError = query.e ? await translateError(query.e) : null;
  const mineIds = mineReservationIdsFor(doc, list.id, user?.id ?? null, claimedIds);
  const activeAccount = user && !user.mustChangePassword ? user : null;
  const { isMember, subscribed: isSubscribed } = viewerRelation(doc, list.id, activeAccount?.id ?? null);
  const types = doc.types.filter((type) => type.wishlistId === list.id);
  const people = doc.people.filter((person) => person.wishlistId === list.id);
  const qui = people.some((person) => person.id === query.qui) ? query.qui! : null;
  const budget = parseBudget(query.budget);
  const priceLocale = intlLocale(locale);
  const visible = listPublicVisibleItems(doc, list.id, mineIds);
  const filtered = sortByPriority(applyBudget(applyPerson(visible, qui), budget));
  const groups = groupByCategory(filtered, types).map((group) => ({
    ...group,
    publicItems: group.items.map((item) => toPublicItem(doc, item, priceLocale, mineIds)),
  }));
  const allLabel = t("allList");
  const personLabel = people.find((person) => person.id === qui)?.label;
  const budgetLabel = budget ? t(`budgets.${budget}`) : null;
  const heading = [allLabel, personLabel, budgetLabel].filter(Boolean).join(" · ");
  const emptyTitle = qui || budget ? t("emptyFiltered") : t("emptyList");
  const emptyHint = qui || budget ? t("emptyHint") : t("emptyListHint");
  const theme = resolveTheme(list.theme);
  const cssVars = themeToCssVars(theme);
  const rootCss = Object.entries(cssVars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <main className="flex flex-col gap-6" style={cssVars as CSSProperties}>
      <style nonce={nonce} dangerouslySetInnerHTML={{ __html: `:root{${rootCss}}` }} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <WishlistCover coverImageUrl={list.coverImageUrl} theme={theme} size="md" alt={list.title} />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{list.title}</h1>
          {list.subtitle ? <p className="text-muted-foreground text-pretty">{list.subtitle}</p> : null}
          <p className="text-muted-foreground text-pretty text-sm">{t("intro")}</p>
        </div>
      </div>
      <nav aria-label={t("categoriesNav")} className="flex flex-wrap gap-2">
        <LinkButton
          href={listHref(readToken, qui, budget)}
          size="sm"
          className="h-auto max-w-full whitespace-normal text-left"
          variant="default"
          aria-current="true"
        >
          {allLabel}
        </LinkButton>
        {groups.map((group) => (
          <LinkButton
            key={group.typeId}
            href={listHref(readToken, qui, budget, categoryAnchorId(group.typeId))}
            size="sm"
            className="h-auto max-w-full whitespace-normal text-left"
            variant="outline"
          >
            {group.label}
          </LinkButton>
        ))}
      </nav>
      {people.length > 0 ? (
        <nav aria-label={t("whoNav")} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("who")}</span>
          <LinkButton
            href={listHref(readToken, null, budget)}
            size="sm"
            className="h-auto max-w-full whitespace-normal text-left"
            variant={qui === null ? "default" : "outline"}
            aria-current={qui === null ? "true" : undefined}
          >
            {t("everyone")}
          </LinkButton>
          {people.map((person) => (
            <LinkButton
              key={person.id}
              href={listHref(readToken, person.id, budget)}
              size="sm"
              className="h-auto max-w-full whitespace-normal text-left"
              variant={qui === person.id ? "default" : "outline"}
              aria-current={qui === person.id ? "true" : undefined}
            >
              {person.label}
            </LinkButton>
          ))}
        </nav>
      ) : null}
      <nav aria-label={t("budgetNav")} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("budget")}</span>
        <LinkButton
          href={listHref(readToken, qui, null)}
          size="sm"
          className="h-auto max-w-full whitespace-normal text-left"
          variant={budget === null ? "default" : "outline"}
          aria-current={budget === null ? "true" : undefined}
        >
          {t("allPrices")}
        </LinkButton>
        {BUDGETS.map((entry) => (
          <LinkButton
            key={entry.id}
            href={listHref(readToken, qui, entry.id)}
            size="sm"
            className="h-auto max-w-full whitespace-normal text-left"
            variant={budget === entry.id ? "default" : "outline"}
            aria-current={budget === entry.id ? "true" : undefined}
          >
            {t(`budgets.${entry.id}`)}
          </LinkButton>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <LinkButton href={`/l/${readToken}/reserver`}>{t("reserveIdea")}</LinkButton>
        {!isMember ? (
          activeAccount ? (
            isSubscribed ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t("subscription.following")}</Badge>
                <ConfirmForm
                  title={t("subscription.unfollowTitle")}
                  description={t("subscription.unfollowBody")}
                  confirmLabel={t("subscription.unfollowConfirm")}
                  cancelLabel={t("subscription.unfollowKeep")}
                  action={unsubscribeAction}
                  fields={{ readToken, returnTo: "list" }}
                  triggerLabel={t("subscription.unfollow")}
                  triggerVariant="outline"
                  triggerSize="sm"
                  confirmVariant="destructive"
                />
              </div>
            ) : (
              <form action={subscribeAction}>
                <input type="hidden" name="readToken" value={readToken} />
                <Button type="submit" variant="neutral">
                  {t("subscription.follow")}
                </Button>
              </form>
            )
          ) : (
            <LinkButton
              href={`/connexion?next=${encodeURIComponent(`/l/${readToken}`)}`}
              variant="neutral"
            >
              {t("subscription.follow")}
            </LinkButton>
          )
        ) : null}
      </div>
      {query.ok ? (
        <Alert>
          <AlertTitle>{t("reservedTitle")}</AlertTitle>
          <AlertDescription>{t("reservedBody")}</AlertDescription>
        </Alert>
      ) : null}
      {query.followed ? (
        <Alert>
          <AlertTitle>{t("subscription.followedTitle")}</AlertTitle>
          <AlertDescription>{t("subscription.followedBody")}</AlertDescription>
        </Alert>
      ) : null}
      {pageError ? (
        <Alert variant="destructive">
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      ) : null}
      <h2 className="text-lg font-medium">{heading}</h2>
      {groups.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.typeId} id={categoryAnchorId(group.typeId)} className="scroll-mt-6 flex flex-col gap-3">
              <h3 className="text-xl font-medium tracking-tight border-b-2 border-border pb-2">{group.label}</h3>
              {group.publicItems.map((item) => (
                <PublicItemCard
                  key={item.id}
                  item={item}
                  readToken={readToken}
                  buyLink={t("buyLink")}
                  buyLinkAria={t("buyLinkAria", { name: item.name })}
                  offerLabel={t("iOffer")}
                  offerAria={t("iOfferAria", { name: item.name })}
                  mineLabel={t("reservation.mine")}
                  secondHandLabel={t("secondHandBadge")}
                  cancelLabel={t("reservation.cancel")}
                  cancelTitle={t("reservation.cancelTitle")}
                  cancelDescription={t("reservation.cancelBody")}
                  cancelConfirm={t("reservation.cancelConfirm")}
                  cancelKeep={t("reservation.cancelKeep")}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
