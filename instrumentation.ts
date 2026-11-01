// Appelé une fois au démarrage du serveur, avant la première requête (Next 16, `register`).
// Ouvre la base : migrations, puis import de l'ancien fichier JSON s'il n'a pas encore été fait.
// Un ancien fichier illisible ou incohérent arrête le serveur au lieu de servir des pages vides.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { openStoreOrExit } = await import("./src/store/startup");
    openStoreOrExit();
  }
}
