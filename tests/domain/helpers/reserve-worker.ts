// Processus séparé pour les tests : `argv[2]` = WISHLIST_DATA_PATH, `argv[3]` = nombre d'essais,
// `argv[4]` = préfixe d'IP. Réserve la même idée (`gift`) en parallèle et affiche le nombre de succès.
import { reserve } from "../../../src/server/commands/public-list";
import { ctx } from "./api-fixtures";

process.env.WISHLIST_DATA_PATH = process.argv[2];
const attempts = Number(process.argv[3]);
const prefix = process.argv[4];

void Promise.all(
  Array.from({ length: attempts }, (_, i) =>
    reserve(ctx(null, `${prefix}.${i + 1}`), { readToken: "rt", itemId: "gift", fromName: `P${i}`, isUnlocked: () => false }),
  ),
).then((results) => {
  process.stdout.write(
    JSON.stringify({
      ok: results.filter((r) => r.ok).length,
      errors: [...new Set(results.filter((r) => !r.ok).map((r) => (r.ok ? "" : r.error)))],
    }),
  );
});
