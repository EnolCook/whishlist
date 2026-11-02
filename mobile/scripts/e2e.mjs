// Suite e2e de l'app mobile (Maestro) : prérequis, base de démo neuve, textes attendus, parcours, résumé.
// Usage : DEMO_PASSWORD=… npm --prefix mobile run e2e -- [--platform ios|android] [--lang fr|en] [parcours.yaml…]
// Contrat : specs/007-mobile-e2e-maestro/contracts/e2e-command.md ; guide : mobile/.maestro/README.md.
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
const SKIP_REASON = {
  ios: "le simulateur iOS ne permet pas de couper le réseau de l'app",
  android: "le partage vers l'app passe par Safari et la feuille de partage d'iOS",
};

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

/**
 * Base de démo neuve (tmp/e2e/wishlist.db), remplacée en une transaction : le serveur qui tourne dessus
 * ne voit jamais une base à moitié écrite, et lit la nouvelle démo à la requête suivante.
 */
function resetDatabase() {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  const result = spawnSync("node", ["--import", "tsx", "scripts/create-demo-data.mjs", dataFile], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`Base de démo non créée : ${result.stderr.trim() || result.stdout.trim()}`);
}

function apiSessionCount(userId) {
  const result = spawnSync("node", ["--import", "tsx", "scripts/db-sessions.ts", dataFile, userId], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? Number(result.stdout.trim()) : 0;
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
  return `MAIL_SMTP_URL=smtp://localhost:1025 WISHLIST_DATA_PATH=tmp/e2e/wishlist.json npm run dev -- --port ${port}`;
}

const MAILDEV_HINT = "npx maildev@3.0.0 --smtp 1025 --web 1080";

/**
 * Les e-mails du serveur arrivent dans MailDev (010) : les parcours y lisent les liens de confirmation.
 * La boîte est vidée avant la suite, pour qu'un parcours ne lise jamais le lien d'une exécution précédente.
 */
async function checkMailDev(maildevUrl, capabilities) {
  const health = await request(`${maildevUrl}/api/healthz`);
  if (!health?.ok) fail(`MailDev injoignable sur ${maildevUrl} : ${MAILDEV_HINT}`);
  if (!capabilities.mail) fail(`Le serveur n'envoie pas d'e-mails : relancez-le avec MAIL_SMTP_URL=smtp://localhost:1025`);
  await request(`${maildevUrl}/api/email/all`, { method: "DELETE" });
}

/** Le serveur répond, et c'est bien la base de tmp/e2e/ qu'il lit (R3) : une connexion doit y laisser une session. */
async function checkServer(apiUrl, password) {
  const capabilities = await request(`${apiUrl}/api/v1/capabilities`);
  if (!capabilities?.ok) fail(`Serveur injoignable sur ${apiUrl} : ${serverHint(apiUrl)}`);
  const configured = await capabilities.json();
  const login = await request(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "alex@example.test", password }),
  });
  const reads = login?.ok && apiSessionCount("demo-owner") > 0;
  if (login?.ok) {
    const { token } = await login.json();
    await request(`${apiUrl}/api/v1/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  }
  if (!reads) fail(`Le serveur ne lit pas la base de tmp/e2e/ : relancez-le avec ${serverHint(apiUrl)}`);
  return configured;
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
  const maildevUrl = (process.env.E2E_MAILDEV_URL ?? "http://localhost:1080").replace(/\/+$/, "");
  if (!checks.isLocalApiUrl(maildevUrl)) fail("E2E_MAILDEV_URL doit viser un MailDev local (localhost ou 127.0.0.1).");
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
  const capabilities = await checkServer(apiUrl, password);
  await checkMailDev(maildevUrl, capabilities);

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
      // Boîte de réception de la suite : les parcours y lisent les liens de confirmation (010).
      "-e",
      `MAILDEV_URL=${maildevUrl}`,
      "--exclude-tags",
      flowFiles.excludedTag(device.platform),
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
    skipped: skipped.map((flow) => ({ id: flow.id, name: flow.name, reason: SKIP_REASON[device.platform] })),
    outputDir: path.relative(repoRoot, outputDir),
    captures: junit.capturesByFlow(pngPaths, results),
  });
  writeFileSync(path.join(outputDir, "summary.txt"), `${summary}\n`);
  console.log(`\n${summary}`);
  process.exit(junit.exitCode(results));
}

await main();
