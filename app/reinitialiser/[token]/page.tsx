import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findValidPasswordReset } from "../../../src/domain/password-reset";
import { resetPasswordAction } from "../../../src/server/actions";
import { getDocument } from "../../../src/store/db";
import { LinkButton } from "@/components/site/link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/src/domain/passwords";
import { getTranslations, translateError } from "@/src/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return {
    title: t("reset.metaTitle"),
    description: t("reset.metaDescription"),
  };
}

export default async function ReinitialiserPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const [t, doc] = await Promise.all([getTranslations("auth"), getDocument()]);
  if (!findValidPasswordReset(doc, token)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("reset.title")}</CardTitle>
          <CardDescription>{t("reset.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={resetPasswordAction}>
            <FieldGroup>
              <input type="hidden" name="token" value={token} />
              {query.e ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {query.e === "password"
                      ? t("reset.errorPassword")
                      : query.e === "rate"
                        ? await translateError("rateLimited")
                        : t("reset.errorGeneric")}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Field>
                <FieldLabel htmlFor="password">{t("reset.password")}</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
                <FieldDescription>{t("reset.passwordHint")}</FieldDescription>
              </Field>
              <Button type="submit">{t("reset.submit")}</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <LinkButton href="/mot-de-passe-oublie" variant="link">
        {t("reset.newLink")}
      </LinkButton>
    </main>
  );
}
