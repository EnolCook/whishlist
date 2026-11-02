import { redirect } from "next/navigation";
import { currentUser } from "../../../src/auth/current";
import { createListAction } from "../../../src/server/actions";
import { listDefaults, memberListTitles, numberedTitle } from "../../../src/domain/list-defaults";
import { getDocument } from "../../../src/store/db";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getLocale, getTranslations, translateError } from "@/src/i18n/server";
import { withLocale } from "@/src/i18n/locale-path";

export const dynamic = "force-dynamic";

export default async function NewListPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const [user, t, query, locale] = await Promise.all([
    currentUser(),
    getTranslations("home"),
    searchParams,
    getLocale(),
  ]);
  if (!user) redirect(withLocale(locale, "/connexion?next=/listes/new"));
  if (user.mustChangePassword) redirect(withLocale(locale, "/compte"));

  // Noms suggérés, calculés comme côté serveur : le placeholder montre ce qu'on obtient à vide.
  const defaults = listDefaults(user.displayName, t);
  const doc = await getDocument();
  const suggestedTitle = numberedTitle(defaults.titleBase, memberListTitles(doc.memberships, doc.wishlists, user.id));

  const error = query.e ? await translateError(query.e) : null;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("newList.title")}</CardTitle>
          <CardDescription>{t("newList.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createListAction}>
            <FieldGroup>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Field>
                <FieldLabel htmlFor="title">{t("newList.titleLabel")}</FieldLabel>
                <Input
                  id="title"
                  name="title"
                  className="placeholder:italic"
                  placeholder={suggestedTitle}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="category">{t("newList.categoryLabel")}</FieldLabel>
                <Input
                  id="category"
                  name="category"
                  className="placeholder:italic"
                  placeholder={defaults.category}
                  autoComplete="off"
                />
                <FieldDescription>{t("newList.categoryHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="person">{t("newList.personLabel")}</FieldLabel>
                <Input
                  id="person"
                  name="person"
                  className="placeholder:italic"
                  placeholder={defaults.person}
                  autoComplete="off"
                />
                <FieldDescription>{t("newList.personHint")}</FieldDescription>
              </Field>
              <Button type="submit">{t("newList.submit")}</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
