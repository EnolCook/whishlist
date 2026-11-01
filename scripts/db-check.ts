// Contrôle à blanc, sans rien écrire : `npm run db:check -- <fichier.json|fichier.db> [--counts]`.
// À lancer sur une copie de la prod avant de déployer la version qui importe l'ancien fichier.
import path from "node:path";
import process from "node:process";
import type { Database as Doc } from "../src/domain/types";
import { readDatabaseFile } from "../src/store/connection";
import { checkDocument, LegacyImportError, loadLegacyDocument } from "../src/store/legacy-json";

const args = process.argv.slice(2);
const counts = args.includes("--counts");
const target = args.find((arg) => !arg.startsWith("--"));
if (!target) {
  console.error("Usage: npm run db:check -- <fichier.json|fichier.db> [--counts]");
  process.exit(2);
}
const file = path.resolve(target);

function load(): Doc {
  return file.endsWith(".db") ? readDatabaseFile(file) : loadLegacyDocument(file);
}

let doc: Doc;
try {
  doc = load();
} catch (error) {
  if (!(error instanceof LegacyImportError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const problems = checkDocument(doc);
if (counts) {
  for (const [name, rows] of Object.entries(doc)) console.log(`${name} ${(rows as unknown[]).length}`);
}
if (problems.length > 0) {
  console.error(`${problems.length} problème(s) :\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("aucun problème");
