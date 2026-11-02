import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";

import { signOut, useSession } from "@/auth/session";
import { afterSignIn } from "@/links/pending";
import { AuthLayout } from "@/features/account/AuthLayout";
import { PasswordForm } from "@/features/account/PasswordForm";
import { Button } from "@/ui/Button";

/** Changement de mot de passe imposé : seul écran accessible tant qu'il n'est pas fait (FR-005). */
export default function ChangePassword() {
  const { t } = useTranslation(["auth", "common"]);
  const session = useSession();
  if (session.status === "signedOut") return <Redirect href="/login" />;
  if (session.status !== "mustChangePassword") return <Redirect href={afterSignIn()} />;
  return (
    <AuthLayout
      title={t("auth:changePassword.titleForced")}
      description={t("auth:changePassword.descriptionForced", { email: session.user.email })}
      below={<Button title={t("common:nav.logout")} variant="link" onPress={() => void signOut()} />}
    >
      <PasswordForm forced />
    </AuthLayout>
  );
}
