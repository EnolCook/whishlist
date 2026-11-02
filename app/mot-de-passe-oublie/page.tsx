import type { Metadata } from "next";
import { origin } from "../../src/auth/current";
import { requestPasswordResetAction } from "../../src/server/actions";
import { DevLinkAlert } from "@/components/site/dev-link-alert";
import { LinkButton } from "@/components/site/link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getTranslations } from "@/src/i18n/server";
import { publicPageMetadata } from "@/src/site/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return await publicPageMetadata({
    title: t("forgot.metaTitle"),
    description: t("forgot.metaDescription"),
    path: "/mot-de-passe-oublie",
  });
}

export default async function MotDePasseOubliePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; lien?: string; sansmail?: string; e?: string }>;
}) {
  const query = await searchParams;
  const [t, siteOrigin] = await Promise.all([getTranslations("auth"), origin()]);
  const done = query.ok === "1";
  const lien = query.lien && query.lien.startsWith("http") ? query.lien : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("forgot.title")}</CardTitle>
          <CardDescription>{t("forgot.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {query.e === "rate" ? (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{t("forgot.rateLimited")}</AlertDescription>
            </Alert>
          ) : null}
          {done ? (
            <div className="flex flex-col gap-3">
              <Alert>
                <AlertDescription>{t("forgot.sent")}</AlertDescription>
              </Alert>
              {query.sansmail === "1" && !lien ? (
                <p className="text-sm text-muted-foreground">{t("forgot.noMail")}</p>
              ) : null}
              <DevLinkAlert label={t("forgot.devLink")} url={lien} origin={siteOrigin} page="/reinitialiser/" />
              <LinkButton href="/connexion" variant="outline">
                {t("forgot.back")}
              </LinkButton>
            </div>
          ) : (
            <form action={requestPasswordResetAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">{t("forgot.email")}</FieldLabel>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </Field>
                <Button type="submit">{t("forgot.submit")}</Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
      {!done ? (
        <LinkButton href="/connexion" variant="link">
          {t("forgot.back")}
        </LinkButton>
      ) : null}
    </main>
  );
}
