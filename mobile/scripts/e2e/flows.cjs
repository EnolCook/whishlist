// En-tête d'un parcours Maestro (avant `---`) : `name` et `tags`, lus par le runner (parcours à ne pas jouer
// sur iOS) et par le test de couverture des stories. Lecture ligne à ligne, sans dépendance YAML.
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");

/** @param {string} source  @param {string} fallbackName */
function parseFlowHeader(source, fallbackName) {
  const header = source.split(/^---$/m)[0];
  const name = header.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? fallbackName;
  /** @type {string[]} */
  const tags = [];
  const block = header.match(/^tags:\s*\n((?:[ \t]+-.*\n?)+)/m);
  if (block) {
    for (const line of block[1].split("\n")) {
      const tag = line.match(/^\s+-\s*["']?([^"'\s]+)/)?.[1];
      if (tag) tags.push(tag);
    }
  }
  return { name, tags };
}

/** @param {string} file */
function readFlowHeader(file) {
  return { file, ...parseFlowHeader(readFileSync(file, "utf8"), path.basename(file, ".yaml")) };
}

/**
 * Parcours à jouer : sans argument, tous ceux de `flowsDir` (triés) ; sinon les fichiers donnés,
 * relatifs à `mobileRoot` ou absolus. Un fichier introuvable arrête tout (code 2 dans le runner).
 * @param {string[]} args  @param {{ mobileRoot: string, flowsDir: string }} dirs
 * @returns {{ ok: true, files: string[] } | { ok: false, message: string }}
 */
function resolveFlowPaths(args, { mobileRoot, flowsDir }) {
  if (args.length === 0) {
    const files = readdirSync(flowsDir)
      .filter((file) => file.endsWith(".yaml"))
      .sort()
      .map((file) => path.join(flowsDir, file));
    return { ok: true, files };
  }
  const files = [];
  for (const arg of args) {
    const file = path.isAbsolute(arg) ? arg : path.resolve(mobileRoot, arg);
    if (!existsSync(file)) return { ok: false, message: `Parcours introuvable : ${arg}` };
    files.push(file);
  }
  return { ok: true, files };
}

/** Parcours qui ne tournent pas sur cette plateforme : `android-only` sur iOS. */
function skippedOn(platform, flows) {
  return platform === "ios" ? flows.filter((flow) => flow.tags.includes("android-only")) : [];
}

module.exports = { parseFlowHeader, readFlowHeader, resolveFlowPaths, skippedOn };
