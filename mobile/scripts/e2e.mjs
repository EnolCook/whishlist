// Suite e2e de l'app mobile (Maestro) : prérequis, base de démo neuve, textes attendus, parcours, résumé.
// Usage : DEMO_PASSWORD=… npm --prefix mobile run e2e -- [--platform ios|android] [--lang fr|en] [parcours.yaml…]
// Contrat : specs/007-mobile-e2e-maestro/contracts/e2e-command.md ; guide : mobile/.maestro/README.md.
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import checks from "./e2e/checks.cjs";
import flowFiles from "./e2e/flows.cjs";
import junit from "./e2e/junit.cjs";
import locale from "./e2e/locale.cjs";
import strings from "./e2e/strings.cjs";

const mobileRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(mobileRoot, "..");
const suiteDir = path.join(mobileRoot, ".maestro");
const dataFile = path.join(repoRoot, "tmp/e2e/wishlist.json");
const SKIP_REASON_IOS = "le simulateur iOS ne permet pas de couper le réseau de l'app";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = { platform: undefined, lang: undefined, flows: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--platform" || arg === "--lang") {
      const value = argv[(i += 1)];
      if (!value) fail(`${arg} attend une valeur.`);
      options[arg.slice(2)] = value;
    } else if (arg.startsWith("--platform=") || arg.startsWith("--lang=")) {
      const [key, value] = arg.slice(2).split("=");
      options[key] = value;
    } else if (arg.startsWith("--")) {
      fail(`Option inconnue : ${arg}`);
    } else {
      options.flows.push(arg);
    }
  }
  if (options.platform && options.platform !== "ios" && options.platform !== "android") {
    fail("--platform doit valoir ios ou android.");
  }
  return options;
}

/** Base de démo neuve, écrite à côté puis renommée : le serveur ne lit jamais un fichier à moitié écrit. */
function resetDatabase() {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  const next = `${dataFile}.next`;
  const result = spawnSync("node", ["--import", "tsx", "scripts/create-demo-data.mjs", next], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`Base de démo non créée : ${result.stderr.trim() || result.stdout.trim()}`);
  renameSync(next, dataFile);
}

async function request(url, init) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch {
    return null;
  }
}

function serverHint(apiUrl) {
  const port = new URL(apiUrl).port || "80";
  return `WISHLIST_DATA_PATH=tmp/e2e/wishlist.json npm run dev -- --port ${port}`;
}

/** Le serveur répond, et c'est bien tmp/e2e/wishlist.json qu'il lit (R3) : une connexion doit y laisser une session. */
async function checkServer(apiUrl, password) {
  const capabilities = await request(`${apiUrl}/api/v1/capabilities`);
  if (!capabilities?.ok) fail(`Serveur injoignable sur ${apiUrl} : ${serverHint(apiUrl)}`);
  const login = await request(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "alex@example.test", password }),
  });
  const sessions = JSON.parse(readFileSync(dataFile, "utf8")).apiSessions ?? [];
  const reads = login?.ok && sessions.some((session) => session.userId === "demo-owner");
  if (login?.ok) {
    const { token } = await login.json();
    await request(`${apiUrl}/api/v1/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  }
  if (!reads) fail(`Le serveur ne lit pas tmp/e2e/wishlist.json : relancez-le avec ${serverHint(apiUrl)}`);
}

/** Version affichée par « Mon compte » (`Constants.expoConfig.version`), lue dans app.config.ts. */
function appVersion() {
  const config = readFileSync(path.join(mobileRoot, "app.config.ts"), "utf8");
  return config.match(/^\s*version:\s*"([^"]+)"/m)?.[1] ?? "";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const resolved = flowFiles.resolveFlowPaths(options.flows, { mobileRoot, flowsDir: path.join(suiteDir, "flows") });
  if (!resolved.ok) fail(resolved.message);
  const flows = resolved.files.map(flowFiles.readFlowHeader).map((flow) => ({ ...flow, id: path.basename(flow.file, ".yaml") }));

  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10) fail("DEMO_PASSWORD est obligatoire (10 caractères minimum).");
  const maestro = checks.findMaestro();
  if (!maestro.ok) fail(maestro.message);
  const apiUrl = (process.env.E2E_API_URL ?? "http://localhost:3010").replace(/\/+$/, "");
  if (!checks.isLocalApiUrl(apiUrl)) fail("E2E_API_URL doit viser un serveur local (localhost ou 127.0.0.1).");
  const picked = checks.pickDevice(checks.listDevices(), options.platform);
  if (!picked.ok) fail(picked.message);
  const { device } = picked;
  const installed = checks.isAppInstalled(device);
  if (!installed.ok) fail(installed.message);

  let lang;
  try {
    lang = locale.resolveLang({
      flag: options.lang,
      env: process.env.E2E_LANG,
      deviceLocale: options.lang || process.env.E2E_LANG ? null : locale.readDeviceLocale(device.platform, device.id),
    });
  } catch (error) {
    fail(error.message);
  }

  resetDatabase();
  await checkServer(apiUrl, password);

  // L'app compilée vise localhost : sur Android, le port du Mac passe par adb (R10).
  if (device.platform === "android") {
    const port = new URL(apiUrl).port || "80";
    execFileSync("adb", ["-s", device.id, "reverse", `tcp:${port}`, `tcp:${port}`], { stdio: "ignore" });
  }

  writeFileSync(path.join(suiteDir, "scripts/strings.generated.js"), strings.renderStringsScript(strings.buildStrings(lang, repoRoot)));

  const skipped = flowFiles.skippedOn(device.platform, flows);
  const toRun = flows.filter((flow) => !skipped.includes(flow));
  const startedAt = new Date();
  const outputDir = path.join(repoRoot, "tmp/e2e/results", `${junit.formatStamp(startedAt)}-${device.platform}`);
  mkdirSync(outputDir, { recursive: true });
  const report = path.join(outputDir, "report.xml");

  let results = [];
  if (toRun.length > 0) {
    const targets = options.flows.length === 0 ? [suiteDir] : toRun.map((flow) => flow.file);
    const args = [
      "test",
      "--device",
      device.id,
      "--format",
      "junit",
      "--output",
      report,
      "--test-output-dir",
      outputDir,
      "-e",
      `APP_VERSION=${appVersion()}`,
      // Langue de l'app : le pavé décimal a une virgule en français, un point en anglais.
      "-e",
      `APP_LANG=${lang}`,
      // Build Debug : Metro que le lanceur du dev client doit ouvrir après l'effacement de l'app.
      "-e",
      `METRO_URL=${encodeURIComponent(process.env.E2E_METRO_URL ?? "http://localhost:8081")}`,
      ...(device.platform === "ios" ? ["--exclude-tags", "android-only"] : []),
      ...targets,
    ];
    // Le mot de passe passe par l'environnement (Maestro lit les variables MAESTRO_*), jamais en argument
    // de processus : il serait visible par tout utilisateur de la machine avec `ps`.
    spawnSync("maestro", args, { cwd: mobileRoot, stdio: "inherit", env: { ...process.env, MAESTRO_DEMO_PASSWORD: password } });
    results = junit.withMissing(existsSync(report) ? junit.parseJunit(readFileSync(report, "utf8")) : [], toRun);
  }

  // Captures prises par Maestro (dont celle de l'écran au moment d'un échec), sous la ligne du parcours.
  const pngPaths = readdirSync(outputDir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".png"))
    .map((file) => path.relative(repoRoot, path.join(outputDir, file)));

  const summary = junit.formatSummary({
    platform: device.platform,
    lang,
    startedAt,
    results,
    skipped: skipped.map((flow) => ({ id: flow.id, name: flow.name, reason: SKIP_REASON_IOS })),
    outputDir: path.relative(repoRoot, outputDir),
    captures: junit.capturesByFlow(pngPaths, results),
  });
  writeFileSync(path.join(outputDir, "summary.txt"), `${summary}\n`);
  console.log(`\n${summary}`);
  process.exit(junit.exitCode(results));
}

await main();
