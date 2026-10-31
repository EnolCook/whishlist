// Textes attendus par les parcours, lus dans locales/<langue>/ (R7) : chaque valeur est une regex
// qui reconnaît le texte exact, puisque Maestro compare les textes comme des expressions régulières.
const { readFileSync } = require("node:fs");
const path = require("node:path");

/** @typedef {{ [key: string]: string | Strings }} Strings */

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Namespaces déclarés dans src/i18n/config.ts, sans les recopier. */
function readNamespaces(repoRoot) {
  const source = readFileSync(path.join(repoRoot, "src/i18n/config.ts"), "utf8");
  const match = source.match(/namespaces\s*=\s*\[([^\]]*)\]/);
  if (!match) throw new Error("namespaces introuvables dans src/i18n/config.ts");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Les clés à variable (`{{…}}`) sont omises : un parcours qui en a besoin passe par un testID. */
function toPatterns(value) {
  if (typeof value === "string") return value.includes("{{") ? undefined : escapeRegex(value);
  if (Array.isArray(value) || typeof value !== "object" || value === null) return undefined;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const pattern = toPatterns(child);
    if (pattern !== undefined) result[key] = pattern;
  }
  return result;
}

/** @returns {Record<string, Strings>} */
function buildStrings(lang, repoRoot) {
  const strings = {};
  for (const ns of readNamespaces(repoRoot)) {
    const file = path.join(repoRoot, "locales", lang, `${ns}.json`);
    strings[ns] = toPatterns(JSON.parse(readFileSync(file, "utf8"))) ?? {};
  }
  return strings;
}

function renderStringsScript(strings) {
  return `// Généré par scripts/e2e.mjs, ne pas modifier ni versionner.\noutput.t = ${JSON.stringify(strings)};\n`;
}

module.exports = { escapeRegex, readNamespaces, buildStrings, renderStringsScript };
