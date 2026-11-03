import { unlockPublicListAction } from "@/src/server/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_READ_PASSWORD_LENGTH } from "@/src/domain/read-password";

export function ReadUnlockForm({
  readToken,
  title,
  heading,
  description,
  passwordLabel,
  passwordHint,
  submit,
  error,
  subscribe,
}: {
  readToken: string;
  title: string;
  heading: string;
  description: string;
  passwordLabel: string;
  passwordHint: string;
  submit: string;
  error: string | null;
  subscribe?: boolean;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>
            {title} — {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={unlockPublicListAction}>
            <FieldGroup>
              <input type="hidden" name="readToken" value={readToken} />
              {subscribe ? <input type="hidden" name="subscribe" value="1" /> : null}
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Field>
                <FieldLabel htmlFor="read-password">{passwordLabel}</FieldLabel>
                <Input
                  id="read-password"
                  name="password"
                  type="password"
                  required
                  minLength={MIN_READ_PASSWORD_LENGTH}
                  autoComplete="current-password"
                  autoFocus
                />
                <FieldDescription>{passwordHint}</FieldDescription>
              </Field>
              <Button type="submit">{submit}</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
