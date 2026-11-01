import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ok } from "@/api/client";
import { signIn } from "@/auth/session";
import { useServerAction } from "@/features/errors";
import { useOnline } from "@/network";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Input } from "@/ui/Input";
import { NetworkNote } from "@/ui/NetworkNote";

/**
 * Bloc « Modifier le mot de passe » de `11-compte.png`. `forced` : première connexion,
 * sans mot de passe actuel (FR-005). Le serveur rend un nouveau jeton, enregistré aussitôt.
 * `testID` : base des identifiants des champs et du bouton (`<testID>-current`, `-next`, `-confirm`, `-submit`).
 */
export function PasswordForm({ forced = false, testID }: { forced?: boolean; testID?: string }) {
  const id = (suffix: string) => (testID ? `${testID}-${suffix}` : undefined);
  const { t } = useTranslation("auth");
  const online = useOnline();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saved, setSaved] = useState(false);
  const change = useServerAction(
    useCallback(async () => {
      setSaved(false);
      const body = forced ? { password: next } : { password: next, currentPassword: current };
      await signIn(await ok(api.POST("/me/password", { body })));
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    }, [forced, next, current]),
  );

  function submit() {
    // Seule vérification locale, comme le formulaire du site : les deux saisies doivent être identiques.
    if (next !== confirm) {
      change.setError(t("changePassword.errorMismatch"));
      return;
    }
    void change.run();
  }

  return (
    <>
      {!forced ? (
        <Field label={t("changePassword.current")}>
          <Input
            testID={id("current")}
            accessibilityLabel={t("changePassword.current")}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoComplete="current-password"
          />
        </Field>
      ) : null}
      <Field label={t("changePassword.next")} description={t("changePassword.nextHint")}>
        <Input
          testID={id("next")}
          accessibilityLabel={t("changePassword.next")}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
        />
      </Field>
      <Field label={t("changePassword.confirm")}>
        <Input
          testID={id("confirm")}
          accessibilityLabel={t("changePassword.confirm")}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
        />
      </Field>
      {change.error ? <Alert variant="destructive">{change.error}</Alert> : null}
      {saved ? <Alert>{t("changePassword.success")}</Alert> : null}
      <Button
        testID={id("submit")}
        title={forced ? t("changePassword.submitForced") : t("changePassword.submit")}
        fullWidth
        disabled={!online || change.busy}
        onPress={submit}
      />
      <NetworkNote />
    </>
  );
}
