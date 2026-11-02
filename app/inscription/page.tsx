import type { Metadata } from "next";
import { origin } from "../../src/auth/current";
import { registerAction } from "../../src/server/actions";
import { DevLinkAlert } from "@/components/site/dev-link-alert";
import { LinkButton } from "@/components/site/link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/src/domain/passwords";
import { getTranslations } from "@/src/i18n/server";
import { emailVerificationRequired } from "@/src/server/mail";
import { publicPageMetadata } from "@/src/site/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return await publicPageMetadata({
    title: t("register.metaTitle"),
    description: t("register.metaDescription"),
    path: "/inscription",
  });
}

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string; ok?: string; lien?: string; envoi?: string }>;
}) {
  const query = await searchParams;
  const [t, siteOrigin] = await Promise.all([getTranslations("auth"), origin()]);
  const next = query.next && query.next.startsWith("/") ? query.next : "/";
  const sent = query.ok === "1";
  const error = sent
    ? null
    : query.e === "password"
      ? t("register.errorPassword")
      : query.e === "rate"
        ? t("register.rateLimited")
        : query.e === "fields"
          ? t("register.errorFields")
          : null;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("register.title")}</CardTitle>
          <CardDescription>{t("register.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertDescription>
                  {query.envoi === "echec"
                    ? t("register.sendFailed")
                    : emailVerificationRequired()
                      ? t("register.sentVerify")
                      : t("register.sent")}
                </AlertDescription>
              </Alert>
              <DevLinkAlert label={t("register.devLink")} url={query.lien} origin={siteOrigin} page="/confirmer-email/" />
              <LinkButton href={next}>{t("register.sentContinue")}</LinkButton>
            </div>
          ) : (
            <form action={registerAction}>
              <FieldGroup>
                <input type="hidden" name="next" value={next} />
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="displayName">{t("register.name")}</FieldLabel>
                  <Input id="displayName" name="displayName" required autoComplete="nickname" />
                  <FieldDescription>{t("register.nameHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">{t("register.email")}</FieldLabel>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">{t("register.password")}</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                  />
                  <FieldDescription>{t("register.passwordHint")}</FieldDescription>
                </Field>
                <Button type="submit">{t("register.submit")}</Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
      <LinkButton href={`/connexion?next=${encodeURIComponent(next)}`} variant="link">
        {t("register.hasAccount")}
      </LinkButton>
    </main>
  );
}
