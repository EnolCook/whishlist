import { openStore } from "./connection";
import { LegacyImportError } from "./legacy-json";

/** Ouverture au démarrage du serveur (instrumentation.ts) : un échec arrête le processus. */
export function openStoreOrExit(): void {
  try {
    openStore();
  } catch (error) {
    console.error("[store] ouverture de la base impossible, arrêt du serveur.");
    console.error(error instanceof LegacyImportError ? error.message : error);
    process.exit(1);
  }
}
