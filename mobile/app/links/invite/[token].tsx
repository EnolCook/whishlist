import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { api, NetworkError, ok } from "@/api/client";
import { useSession } from "@/auth/session";
import { refreshList, refreshLists } from "@/data/lists";
import { AuthLayout } from "@/features/account/AuthLayout";
import { VerificationBanner } from "@/features/account/VerificationBanner";
import { errorText, useServerAction } from "@/features/errors";
import { clearPendingLink, setPendingLink } from "@/links/pending";
import { useOnline } from "@/network";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { NetworkNote } from "@/ui/NetworkNote";
import { Text } from "@/ui/Text";

type Preview =
  | { status: "loading" }
  | { status: "ready"; title: string }
  | { status: "failed"; message: string; retry: boolean };

/**
 * Lien d'invitation ouvert dans l'app (011, US2), comme `/inviter/{token}` du site. Sans session, le lien
 * est gardé pendant la connexion ou l'inscription, puis l'écran revient ici (R5). Connecté : le titre de
 * la liste et « Rejoindre » ; un compte déjà membre arrive directement sur la liste.
 */
export default function InviteLink() {
  const { t } = useTranslation(["public", "auth", "mobile"]);
  const { token } = useLocalSearchParams<{ token: string }>();
  const session = useSession();
  const online = useOnline();
  const self = `/links/invite/${encodeURIComponent(token)}`;
  const [preview, setPreview] = useState<Preview>({ status: "loading" });

  const openList = useCallback(async (listId: string) => {
    await refreshLists();
    await refreshList(listId);
    router.replace(`/lists/${listId}` as Href);
  }, []);

  const signedIn = session.status === "signedIn";
  useEffect(() => {
    if (session.status === "signedOut" || session.status === "mustChangePassword") setPendingLink(self);
    else if (signedIn) clearPendingLink();
  }, [session.status, signedIn, self]);

  // Relu à l'ouverture une fois connecté, et à chaque « Réessayer ». L'état de départ est « loading ».
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void (async () => {
      try {
        const answer = await ok(api.GET("/invitations/{inviteToken}", { params: { path: { inviteToken: token } } }));
        if (!active) return;
        if (answer.listId) await openList(answer.listId);
        else setPreview({ status: "ready", title: answer.title });
      } catch (error) {
        if (active) setPreview({ status: "failed", message: errorText(error), retry: error instanceof NetworkError });
      }
    })();
    return () => {
      active = false;
    };
  }, [signedIn, token, openList, attempt]);

  const join = useServerAction(
    useCallback(async () => {
      const list = await ok(api.POST("/invitations/{inviteToken}/accept", { params: { path: { inviteToken: token } } }));
      await openList(list.id);
    }, [token, openList]),
  );

  if (session.status === "mustChangePassword") return <Redirect href="/change-password" />;

  if (!signedIn) {
    return (
      <AuthLayout title={t("public:invite.title")} description={t("public:invite.body")} testID="invite.screen">
        <View style={{ gap: tokens.space[2] }}>
          <Button testID="invite.register" title={t("public:invite.register")} fullWidth onPress={() => router.push("/register")} />
          <Button
            testID="invite.login"
            title={t("public:invite.login")}
            variant="neutral"
            fullWidth
            onPress={() => router.push("/login")}
          />
        </View>
      </AuthLayout>
    );
  }

  if (preview.status !== "ready") {
    return (
      <AuthLayout title={t("public:invite.title")} testID="invite.screen">
        {preview.status === "loading" ? <Text>{t("mobile:links.inviteChecking")}</Text> : null}
        {preview.status === "failed" ? (
          <>
            <Alert testID="invite.error" variant="destructive">
              {preview.message}
            </Alert>
            {preview.retry ? (
              <Button testID="invite.retry" title={t("mobile:retry")} variant="neutral" onPress={() => {
                  setPreview({ status: "loading" });
                  setAttempt((count) => count + 1);
                }}
              />
            ) : (
              <Button testID="invite.home" title={t("auth:confirmEmail.myLists")} variant="neutral" onPress={() => router.replace("/")} />
            )}
          </>
        ) : null}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("public:invite.joinTitle", { title: preview.title })}
      description={t("public:invite.joinHint")}
      testID="invite.screen"
    >
      {join.error ? (
        <Alert testID="invite.join-error" variant="destructive">
          {join.error}
        </Alert>
      ) : null}
      <VerificationBanner />
      <Button
        testID="invite.join"
        title={t("public:invite.join")}
        fullWidth
        disabled={!online || join.busy}
        onPress={() => void join.run()}
      />
      <NetworkNote />
    </AuthLayout>
  );
}
