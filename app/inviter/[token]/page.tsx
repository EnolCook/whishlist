import { redirect } from "next/navigation";
import { currentUser } from "../../../src/auth/current";
import { findWishlistByInvite } from "../../../src/domain/membership";
import { joinInviteAction } from "../../../src/server/actions";
import { getDocument } from "../../../src/store/db";
import { LinkButton } from "@/components/site/link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getLocale, getTranslations, translateError } from "@/src/i18n/server";
import { withLocale } from "@/src/i18n/locale-path";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const [t, user, doc, locale] = await Promise.all([
    getTranslations("public"),
    currentUser(),
    getDocument(),
    getLocale(),
  ]);
  if (user?.mustChangePassword) redirect(withLocale(locale, "/compte"));
  const list = findWishlistByInvite(doc, token);
  const back = `/inviter/${token}`;
  if (!user) {
    return (
      <main className="flex max-w-xl flex-col gap-4">
        <h1 className="text-2xl font-medium tracking-tight">{t("invite.title")}</h1>
        <p className="text-muted-foreground">{t("invite.body")}</p>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/inscription?next=${encodeURIComponent(back)}`}>{t("invite.register")}</LinkButton>
          <LinkButton href={`/connexion?next=${encodeURIComponent(back)}`} variant="outline">
            {t("invite.login")}
          </LinkButton>
        </div>
      </main>
    );
  }
  if (!query.e) await joinInviteAction(token);
  const error = query.e ? await translateError(query.e) : null;
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">
        {t("invite.joinTitle", { title: list?.title ?? "…" })}
      </h1>
      {list ? <p className="text-muted-foreground">{t("invite.joinHint")}</p> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </main>
  );
}
