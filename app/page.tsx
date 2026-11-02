import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../src/auth/current";
import { resolveTheme } from "../src/domain/theme";
import { getDocument } from "../src/store/db";
import { GiftMark } from "@/components/site/gift-mark";
import { GuestHero } from "@/components/site/guest-hero";
import { LinkButton } from "@/components/site/link-button";
import { WishlistCover } from "@/components/site/wishlist-cover";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { GITHUB_REPO_URL } from "@/src/site/links";
import { getLocale, getTranslations } from "@/src/i18n/server";
import { withLocale } from "@/src/i18n/locale-path";
import { publicPageMetadata } from "@/src/site/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return await publicPageMetadata({
    title: t("meta.title"),
    description: t("meta.description"),
    path: "/",
  });
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [user, t, tCommon, locale] = await Promise.all([
    currentUser(),
    getTranslations("home"),
    getTranslations("common"),
    getLocale(),
  ]);
  if (user?.mustChangePassword) redirect(withLocale(locale, "/compte"));
  if (!user) {
    return (
      <main className="flex flex-col gap-6">
        <GuestHero
          brand={tCommon("brand")}
          headline={t("guest.headline")}
          body={t("guest.body")}
          createAccount={t("guest.createAccount")}
          createHint={t("guest.createHint")}
          hasAccount={t("guest.hasAccount")}
        />
        <p className="text-sm text-muted-foreground">
          {t("guest.selfHost")}{" "}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            {t("guest.github")}
          </a>
        </p>
      </main>
    );
  }
  const doc = await getDocument();
  const mine = doc.memberships
    .filter((membership) => membership.userId === user.id)
    .map((membership) => doc.wishlists.find((list) => list.id === membership.wishlistId))
    .filter((list) => list !== undefined);
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{t("mine.title")}</h1>
        <LinkButton href="/listes/new" size="sm">
          {t("mine.newList")}
        </LinkButton>
      </div>
      {mine.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <GiftMark className="size-16" />
            </EmptyMedia>
            <EmptyTitle>{t("mine.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("mine.emptyBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <LinkButton href="/listes/new">{t("mine.newList")}</LinkButton>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {mine.map((list) => (
            // `relative` + `after:inset-0` sur le lien du titre : toute la carte est cliquable,
            // alors qu'il n'y a toujours qu'un seul lien à parcourir au clavier ; le contour de
            // focus passe du titre à la carte. La couverture reste décorative (`alt` vide) : le
            // lien porte déjà le titre, un lecteur d'écran ne l'entend qu'une fois.
            <Card key={list.id} size="sm" className="relative">
              <CardHeader className="flex flex-row items-center gap-3">
                <WishlistCover
                  coverImageUrl={list.coverImageUrl}
                  theme={resolveTheme(list.theme)}
                  size="xs"
                  framed={false}
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle>
                    <Link
                      href={withLocale(locale, `/listes/${list.id}`)}
                      className="hover:underline after:absolute after:inset-0 after:rounded-base focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-solid focus-visible:after:outline-offset-2 focus-visible:after:outline-black"
                    >
                      {list.title}
                    </Link>
                  </CardTitle>
                  {list.subtitle ? (
                    <CardDescription className="line-clamp-2">{list.subtitle}</CardDescription>
                  ) : null}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
