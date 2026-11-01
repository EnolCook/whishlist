// Sauvegarde à chaud, cohérente, de la base en marche : `node scripts/db-backup.mjs <destination>`.
// En prod : `docker exec whishlist node scripts/db-backup.mjs /data/.backup-<date>.db` (deploy/backup-whishlist.sh).
// JS simple (sans tsx) pour tourner dans l'image ; même règle de chemin que `databaseFilePath()`.
import Database from "better-sqlite3";
import { chmodSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const destination = process.argv[2];
if (!destination) {
  console.error("Usage: node scripts/db-backup.mjs <destination>");
  process.exit(2);
}

const dataPath = process.env.WISHLIST_DATA_PATH ?? path.join(process.cwd(), "data", "wishlist.json");
const source = dataPath.endsWith(".db") ? dataPath : `${dataPath.replace(/\.json$/, "")}.db`;
if (!existsSync(source)) {
  console.error(`Base absente : ${source}`);
  process.exit(1);
}

const db = new Database(source, { fileMustExist: true });
try {
  db.pragma("busy_timeout = 5000");
  await db.backup(path.resolve(destination));
} finally {
  db.close();
}
try {
  chmodSync(destination, 0o600);
} catch {
  // FS sans chmod — ignore
}
console.log(`${destination} (${statSync(destination).size} octets)`);
