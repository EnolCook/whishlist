// Langue des textes vérifiés (R8) : --lang, puis E2E_LANG, puis la langue de l'appareil, comme l'app.
const { execFileSync } = require("node:child_process");

function explicit(value, source) {
  if (value === undefined || value === null || value === "") return null;
  if (value !== "fr" && value !== "en") throw new Error(`${source} doit valoir fr ou en (reçu : ${value}).`);
  return value;
}

/** Première langue de l'appareil (« en-US », « en_GB » ou la liste AppleLanguages) → en ; le reste → fr. */
function fromDevice(deviceLocale) {
  const first = String(deviceLocale ?? "").match(/[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]+)*/);
  return first && first[0].toLowerCase().split(/[-_]/)[0] === "en" ? "en" : "fr";
}

/** @param {{ flag?: string | null, env?: string | null, deviceLocale?: string | null }} options */
function resolveLang({ flag, env, deviceLocale }) {
  return explicit(flag, "--lang") ?? explicit(env, "E2E_LANG") ?? fromDevice(deviceLocale);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

function readDeviceLocale(platform, deviceId) {
  if (platform === "ios") return run("xcrun", ["simctl", "spawn", deviceId, "defaults", "read", "-g", "AppleLanguages"]);
  return (
    run("adb", ["-s", deviceId, "shell", "getprop", "persist.sys.locale"]) ??
    run("adb", ["-s", deviceId, "shell", "getprop", "ro.product.locale"])
  );
}

module.exports = { resolveLang, readDeviceLocale };
