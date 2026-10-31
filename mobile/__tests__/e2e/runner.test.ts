import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isLocalApiUrl, pickDevice } from "../../scripts/e2e/checks.cjs";
import { parseFlowHeader, resolveFlowPaths, skippedOn } from "../../scripts/e2e/flows.cjs";
import { capturesByFlow, exitCode, formatStamp, formatSummary, parseJunit, withMissing } from "../../scripts/e2e/junit.cjs";
import { resolveLang } from "../../scripts/e2e/locale.cjs";
import { buildStrings, escapeRegex, readNamespaces, renderStringsScript } from "../../scripts/e2e/strings.cjs";

const repo = join(__dirname, "../../..");

/** Valeur d'une clé `a.b.c` dans les textes générés ; échoue si ce n'est pas un texte. */
function at(strings: unknown, key: string): string {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], strings);
  if (typeof value !== "string") throw new Error(`${key} n'est pas un texte`);
  return value;
}

describe("strings", () => {
  test("escapes every regex metacharacter", () => {
    expect(escapeRegex("E-mail ou mot de passe incorrect.")).toBe("E-mail ou mot de passe incorrect\\.");
    expect(escapeRegex("a.b?c(d)e[f]g*h+i^j$k|l\\m{n}o")).toBe("a\\.b\\?c\\(d\\)e\\[f\\]g\\*h\\+i\\^j\\$k\\|l\\\\m\\{n\\}o");
  });

  test("reads the namespaces of src/i18n/config.ts", () => {
    expect(readNamespaces(repo)).toEqual(expect.arrayContaining(["common", "auth", "errors", "content", "mobile"]));
  });

  test("builds one escaped regex per key, in the chosen language", () => {
    const fr = buildStrings("fr", repo);
    const en = buildStrings("en", repo);
    expect(Object.keys(fr)).toEqual(readNamespaces(repo));
    expect(at(fr, "errors.invalidCredentials")).toBe("E-mail ou mot de passe incorrect\\.");
    expect(at(en, "auth.login.submit")).toBe("Log in");
    expect(new RegExp(`^${at(fr, "errors.invalidCredentials")}$`).test("E-mail ou mot de passe incorrect.")).toBe(true);
  });

  test("leaves out keys with a variable", () => {
    const strings = buildStrings("fr", repo);
    const values = JSON.stringify(strings);
    expect(values).not.toContain("{{");
    expect(values).not.toContain("\\{\\{");
  });

  test("renders a script that sets output.t", () => {
    const script = renderStringsScript({ auth: { login: { submit: "Se connecter" } } });
    const output: { t?: unknown } = {};
    new Function("output", script)(output);
    expect(output.t).toEqual({ auth: { login: { submit: "Se connecter" } } });
  });
});

describe("resolveLang", () => {
  test("--lang wins over E2E_LANG, which wins over the device", () => {
    expect(resolveLang({ flag: "en", env: "fr", deviceLocale: "fr-FR" })).toBe("en");
    expect(resolveLang({ env: "en", deviceLocale: "fr-FR" })).toBe("en");
    expect(resolveLang({ deviceLocale: "en-US" })).toBe("en");
  });

  test("English device locales give en, anything else fr", () => {
    for (const locale of ["en", "en-US", "en_GB", '(\n    "en-US",\n    "fr-FR"\n)']) {
      expect(resolveLang({ deviceLocale: locale })).toBe("en");
    }
    for (const locale of ["fr-FR", "de_DE", "", null, undefined, '(\n    "de-DE",\n    "en"\n)']) {
      expect(resolveLang({ deviceLocale: locale })).toBe("fr");
    }
  });

  test("an explicit language other than fr or en is an error", () => {
    expect(() => resolveLang({ flag: "de" })).toThrow();
    expect(() => resolveLang({ env: "es" })).toThrow();
  });
});

const passed = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Test Suite" device="iPhone 17" tests="2" failures="0" time="62">
    <testcase id="005-us1-auth" name="005 US1 — Se connecter ou créer un compte" classname="005 US1 — Se connecter ou créer un compte" time="41.2" status="SUCCESS"/>
    <testcase id="006-us2-legal" name="006 US2 — Lire les mentions légales" classname="006 US2 — Lire les mentions légales" time="20.8" status="SUCCESS"/>
  </testsuite>
</testsuites>`;

const failed = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Test Suite" tests="1" failures="1">
    <testcase id="005-us3-items" name="005 US3 — Remplir une liste" classname="005 US3 — Remplir une liste" time="28" status="ERROR">
      <failure>Element not found: Id matching regex: item-form.submit &amp; more</failure>
    </testcase>
  </testsuite>
</testsuites>`;

describe("parseJunit", () => {
  test("reads passed flows", () => {
    expect(parseJunit(passed)).toEqual([
      { id: "005-us1-auth", name: "005 US1 — Se connecter ou créer un compte", status: "passed", durationS: 41 },
      { id: "006-us2-legal", name: "006 US2 — Lire les mentions légales", status: "passed", durationS: 21 },
    ]);
  });

  test("reads the failed step from the failure message", () => {
    expect(parseJunit(failed)).toEqual([
      {
        id: "005-us3-items",
        name: "005 US3 — Remplir une liste",
        status: "failed",
        durationS: 28,
        failedStep: "Element not found: Id matching regex: item-form.submit & more",
      },
    ]);
  });

  test("reads <error> and a failure message given as an attribute", () => {
    const xml = `<testsuites><testsuite>
      <testcase id="a" name="A" time="3"><error message="Device became unreachable"/></testcase>
      <testcase id="b" name="B" time="4"><failure message="Assertion &quot;x&quot; is false"></failure></testcase>
    </testsuite></testsuites>`;
    expect(parseJunit(xml)).toEqual([
      { id: "a", name: "A", status: "failed", durationS: 3, failedStep: "Device became unreachable" },
      { id: "b", name: "B", status: "failed", durationS: 4, failedStep: 'Assertion "x" is false' },
    ]);
  });

  test("an empty report gives no flow", () => {
    expect(parseJunit("")).toEqual([]);
    expect(parseJunit("<testsuites></testsuites>")).toEqual([]);
  });
});

describe("summary", () => {
  const results = [...parseJunit(passed), ...parseJunit(failed)];
  const skipped = [{ id: "005-us5-offline", name: "005 US5 — Continuer sans réseau", reason: "le simulateur iOS ne permet pas de couper le réseau de l'app" }];

  test("one line per flow, the failed step below, skipped flows with their reason", () => {
    const text = formatSummary({
      platform: "ios",
      lang: "fr",
      startedAt: new Date(2026, 10, 2, 14, 3),
      results,
      skipped,
      outputDir: "tmp/e2e/results/20261102-140312-ios",
    });
    const lines = text.split("\n");
    expect(lines[0]).toBe("Parcours e2e — ios — fr — 2026-11-02 14:03");
    expect(text).toMatch(/✓ 005 US1 — Se connecter ou créer un compte\s+41 s/);
    expect(text).toMatch(/✗ 005 US3 — Remplir une liste\s+28 s\n\s+étape : Element not found: Id matching regex: item-form.submit & more/);
    expect(text).toMatch(/– 005 US5 — Continuer sans réseau\s+non joué : le simulateur iOS ne permet pas de couper le réseau de l'app/);
    expect(lines.at(-1)).toBe("2 réussis, 1 échoué, 1 non joué — résultats : tmp/e2e/results/20261102-140312-ios");
  });

  test("captures are listed under their failed flow", () => {
    const text = formatSummary({
      platform: "ios",
      lang: "fr",
      startedAt: new Date(2026, 10, 2, 14, 3),
      results: parseJunit(failed),
      skipped: [],
      outputDir: "tmp/e2e/results/x",
      captures: { "005 US3 — Remplir une liste": ["tmp/e2e/results/x/005 US3 — Remplir une liste/screenshots/step-9.png"] },
    });
    expect(text).toContain("étape : Element not found: Id matching regex: item-form.submit & more\n      capture : tmp/e2e/results/x/005 US3 — Remplir une liste/screenshots/step-9.png");
  });

  test("skipped flows are not failures", () => {
    expect(exitCode(parseJunit(passed))).toBe(0);
    expect(exitCode(results)).toBe(1);
    expect(exitCode([])).toBe(0);
  });
});

describe("flows to run", () => {
  const mobileRoot = mkdtempSync(join(tmpdir(), "e2e-flows-"));
  const flowsDir = join(mobileRoot, ".maestro/flows");
  mkdirSync(flowsDir, { recursive: true });
  for (const file of ["006-us1-b.yaml", "005-us1-a.yaml", "notes.md"]) writeFileSync(join(flowsDir, file), "appId: x\n---\n");

  test("without argument: every flow of the folder, sorted", () => {
    expect(resolveFlowPaths([], { mobileRoot, flowsDir })).toEqual({
      ok: true,
      files: [join(flowsDir, "005-us1-a.yaml"), join(flowsDir, "006-us1-b.yaml")],
    });
  });

  test("given files: relative to mobile/ or absolute", () => {
    const absolute = join(flowsDir, "006-us1-b.yaml");
    expect(resolveFlowPaths([".maestro/flows/005-us1-a.yaml", absolute], { mobileRoot, flowsDir })).toEqual({
      ok: true,
      files: [join(flowsDir, "005-us1-a.yaml"), absolute],
    });
  });

  test("an unknown file stops everything", () => {
    expect(resolveFlowPaths(["nope.yaml"], { mobileRoot, flowsDir })).toEqual({ ok: false, message: "Parcours introuvable : nope.yaml" });
  });

  test("android-only flows are skipped on iOS only", () => {
    const flows = [
      { name: "A", tags: ["005-us1"] },
      { name: "B", tags: ["005-us5", "android-only"] },
    ];
    expect(skippedOn("ios", flows)).toEqual([flows[1]]);
    expect(skippedOn("android", flows)).toEqual([]);
  });
});

describe("pickDevice", () => {
  const ios = { platform: "ios", id: "U1", name: "iPhone 17" };
  const android = { platform: "android", id: "emulator-5554", name: "emulator-5554" };

  test("the only device, or the only one of the asked platform", () => {
    expect(pickDevice([ios], undefined)).toEqual({ ok: true, device: ios });
    expect(pickDevice([ios, android], "android")).toEqual({ ok: true, device: android });
  });

  test("messages of the contract when no device or too many", () => {
    expect(pickDevice([], undefined)).toEqual({ ok: false, message: "Aucun simulateur iOS ni émulateur Android démarré." });
    expect(pickDevice([android], "ios")).toEqual({ ok: false, message: "Aucun simulateur iOS démarré." });
    expect(pickDevice([ios], "android")).toEqual({ ok: false, message: "Aucun émulateur Android démarré." });
    expect(pickDevice([ios, android], undefined)).toEqual({ ok: false, message: "Plusieurs appareils : précisez --platform ios ou --platform android." });
    expect(pickDevice([ios, { ...ios, id: "U2" }], "ios")).toEqual({ ok: false, message: "Plusieurs appareils ios démarrés : n'en gardez qu'un." });
  });
});

describe("flow header", () => {
  test("reads the name and every tag", () => {
    const source = 'appId: x\nname: "005 US5 — Hors ligne"\ntags:\n  - 005-us5\n  - android-only\n---\n- launchApp\n';
    expect(parseFlowHeader(source, "005-us5-offline")).toEqual({ name: "005 US5 — Hors ligne", tags: ["005-us5", "android-only"] });
  });

  test("falls back to the file name, without tags", () => {
    expect(parseFlowHeader("appId: x\n---\n- launchApp\n", "006-us2-legal")).toEqual({ name: "006-us2-legal", tags: [] });
  });
});

test("results folder name is AAAAMMJJ-HHMMSS", () => {
  expect(formatStamp(new Date(2026, 10, 2, 14, 3, 12))).toBe("20261102-140312");
});

test("a flow missing from the report counts as failed", () => {
  const results = withMissing(parseJunit(passed), [
    { id: "005-us1-auth", name: "005 US1 — Se connecter ou créer un compte" },
    { id: "006-us3-export", name: "006 US3 — Récupérer ses données" },
  ]);
  expect(results.at(-1)).toEqual({ id: "006-us3-export", name: "006 US3 — Récupérer ses données", status: "failed", durationS: 0, failedStep: "absent du rapport de Maestro" });
  expect(results.filter((r) => r.name.startsWith("005 US1"))).toHaveLength(1);
});

test("captures of each failed flow come from the folder named after it", () => {
  const pngs = ["r/d/005 US3 — Remplir une liste/screenshots/a.png", "r/d/006 US2 — Lire/screenshots/b.png", "r/d/005 US1 — Se connecter/screenshots/c.png"];
  const results = [
    { name: "005 US3 — Remplir une liste", status: "failed" },
    { name: "005 US1 — Se connecter", status: "passed" },
  ];
  expect(capturesByFlow(pngs, results)).toEqual({ "005 US3 — Remplir une liste": ["r/d/005 US3 — Remplir une liste/screenshots/a.png"] });
});

describe("isLocalApiUrl", () => {
  test("accepts only the local server", () => {
    for (const url of ["http://localhost:3010", "http://127.0.0.1:3000", "http://localhost"]) {
      expect(isLocalApiUrl(url)).toBe(true);
    }
    for (const url of ["https://ohyoushouldnt.app", "http://10.0.2.2:3010", "http://192.168.1.10:3010", "http://localhost.evil.test", "not a url", "ftp://localhost"]) {
      expect(isLocalApiUrl(url)).toBe(false);
    }
  });
});
