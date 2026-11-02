import { Redirect, Stack } from "expo-router";

import { useSession } from "@/auth/session";
import { afterSignIn } from "@/links/pending";

/** Écrans sans connexion ; une personne connectée va à ses listes, ou au lien qui l'a amenée ici (011). */
export default function AuthLayout() {
  const session = useSession();
  if (session.status === "signedIn") return <Redirect href={afterSignIn()} />;
  if (session.status === "mustChangePassword") return <Redirect href="/change-password" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
