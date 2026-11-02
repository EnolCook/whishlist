import { execFileSync } from "node:child_process";
import { join } from "node:path";

import type { ExpoConfig } from "expo/config";

import { androidPathPrefixes } from "../../../src/site/app-links";

/** Config Expo calculée avec ces variables d'environnement (lues au chargement du fichier). */
function configWith(env: { EXPO_PUBLIC_API_URL?: string; APP_VARIANT?: string }): ExpoConfig {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    let config: ExpoConfig | undefined;
    jest.isolateModules(() => {
      const build = require("../../app.config").default as (ctx: { config: object }) => ExpoConfig;
      config = build({ config: {} });
    });
    return config!;
  } finally {
    process.env = saved;
  }
}

describe("liens du site ouverts par l'app (011)", () => {
  it("serveur HTTPS : domaine associé sur iOS, chaque préfixe de la table sur Android", () => {
    const config = configWith({ EXPO_PUBLIC_API_URL: "https://ohyoushouldnt.app", APP_VARIANT: "production" });
    expect(config.ios?.associatedDomains).toEqual(["applinks:ohyoushouldnt.app"]);
    const filter = config.android?.intentFilters?.[0];
    expect(filter?.autoVerify).toBe(true);
    const data = Array.isArray(filter?.data) ? filter.data : [];
    expect(data.map((entry) => entry.pathPrefix)).toEqual(androidPathPrefixes());
    expect(data.every((entry) => entry.scheme === "https" && entry.host === "ohyoushouldnt.app")).toBe(true);
  });

  it("serveur local en HTTP, ou variante de développement : rien n'est déclaré", () => {
    for (const env of [
      { EXPO_PUBLIC_API_URL: "http://localhost:3010", APP_VARIANT: "production" },
      { EXPO_PUBLIC_API_URL: "https://ohyoushouldnt.app", APP_VARIANT: "development" },
    ]) {
      const config = configWith(env);
      expect(config.ios?.associatedDomains).toBeUndefined();
      expect(config.android?.intentFilters).toBeUndefined();
    }
  });
});

// Le chargeur de config d'Expo (celui d'`expo run` et des builds EAS) ne compile pas le TypeScript importé
// hors de mobile/, contrairement à jest : on le lance pour de vrai.
it("le vrai chargeur d'Expo lit app.config.ts, avec les liens de l'app en production", () => {
  const root = join(__dirname, "../..");
  const output = execFileSync(join(root, "node_modules/.bin/expo"), ["config", "--json"], {
    cwd: root,
    env: { ...process.env, EXPO_PUBLIC_API_URL: "https://ohyoushouldnt.app", APP_VARIANT: "production" },
    encoding: "utf8",
  });
  const config = JSON.parse(output) as ExpoConfig;
  expect(config.ios?.associatedDomains).toEqual(["applinks:ohyoushouldnt.app"]);
  const data = config.android?.intentFilters?.[0]?.data;
  expect((Array.isArray(data) ? data : []).map((entry) => entry.pathPrefix)).toEqual(androidPathPrefixes());
}, 60000);
