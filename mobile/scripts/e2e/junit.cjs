// Rapport JUnit de Maestro → résultat par parcours, résumé affiché et code de sortie (R12).

function decode(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decode(match[1]) : undefined;
}

function parseJunit(xml) {
  const results = [];
  for (const match of String(xml).matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const [, attrs, , body = ""] = match;
    const name = attr(attrs, "name") ?? attr(attrs, "id") ?? "?";
    const failure = body.match(/<(failure|error)\b([^>]*)(?:\/>|>([\s\S]*?)<\/\1>)/);
    const result = {
      id: attr(attrs, "id") ?? name,
      name,
      status: failure ? "failed" : "passed",
      durationS: Math.round(Number(attr(attrs, "time") ?? 0)),
    };
    if (failure) result.failedStep = decode((failure[3] || attr(failure[2], "message") || "").trim());
    results.push(result);
  }
  return results;
}

const pad = (n) => String(n).padStart(2, "0");

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Nom du dossier de résultats : AAAAMMJJ-HHMMSS. */
function formatStamp(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function plural(count, word) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/**
 * Un parcours lancé mais absent du rapport (Maestro arrêté avant la fin) compte comme un échec.
 * @param {Array<{ id: string, name: string, status: string, durationS: number, failedStep?: string }>} results
 * @param {Array<{ id: string, name: string }>} flows
 */
function withMissing(results, flows) {
  const missing = flows
    .filter((flow) => !results.some((r) => r.name === flow.name || r.id === flow.id))
    .map((flow) => ({ id: flow.id, name: flow.name, status: "failed", durationS: 0, failedStep: "absent du rapport de Maestro" }));
  return [...results, ...missing];
}

/**
 * Captures de chaque parcours en échec : Maestro les range dans un dossier au nom du parcours.
 * @param {string[]} pngPaths  @param {Array<{ name: string, status: string }>} results
 * @returns {Record<string, string[]>}
 */
function capturesByFlow(pngPaths, results) {
  /** @type {Record<string, string[]>} */
  const byFlow = {};
  for (const result of results) {
    if (result.status !== "failed") continue;
    const own = pngPaths.filter((file) => file.split(/[\\/]/).includes(result.name));
    if (own.length > 0) byFlow[result.name] = own;
  }
  return byFlow;
}

function formatSummary({ platform, lang, startedAt, results, skipped, outputDir, captures = {} }) {
  const width = Math.max(40, ...results.map((r) => r.name.length), ...skipped.map((s) => s.name.length)) + 2;
  const lines = [`Parcours e2e — ${platform} — ${lang} — ${formatDate(startedAt)}`];
  for (const result of results) {
    const mark = result.status === "passed" ? "✓" : "✗";
    lines.push(`  ${mark} ${result.name.padEnd(width)}${result.durationS} s`);
    if (result.failedStep) lines.push(`      étape : ${result.failedStep}`);
    for (const capture of captures[result.name] ?? []) lines.push(`      capture : ${capture}`);
  }
  for (const skip of skipped) lines.push(`  – ${skip.name.padEnd(width)}non joué : ${skip.reason}`);
  const passedCount = results.filter((r) => r.status === "passed").length;
  const failedCount = results.length - passedCount;
  lines.push(
    `${plural(passedCount, "réussi")}, ${plural(failedCount, "échoué")}, ${skipped.length} non joué${skipped.length > 1 ? "s" : ""} — résultats : ${outputDir}`,
  );
  return lines.join("\n");
}

/** Les « non joué » ne comptent pas comme des échecs. */
function exitCode(results) {
  return results.some((r) => r.status === "failed") ? 1 : 0;
}

module.exports = { parseJunit, withMissing, capturesByFlow, formatSummary, formatStamp, exitCode };
