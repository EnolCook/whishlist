import type { ConfigContext, ExpoConfig } from "expo/config";

import commonEn from "../locales/en/common.json";
import commonFr from "../locales/fr/common.json";

// L'adresse du serveur est fixée au build (FR-042) : démo locale, production…
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

/**
 * Variante du build (`APP_VARIANT`, posée par les profils de `eas.json`) :
 * - `development` : client de développement qui charge le JavaScript depuis Metro, installé à côté
 *   de l'app (son propre identifiant et son propre nom), avec le catalogue de composants ;
 * - `production` (par défaut, y compris pour `expo run:ios|android`) : l'app elle-même.
 */
const APP_VARIANT = process.env.APP_VARIANT ?? "production";
const IS_DEV = APP_VARIANT === "development";

const PACKAGE = IS_DEV ? "app.ohyoushouldnt.mobile.dev" : "app.ohyoushouldnt.mobile";

function appName(brand: string) {
  return IS_DEV ? `${brand} (Dev)` : brand;
}

function localizedName(brand: string) {
  const name = appName(brand);
  return { ios: { CFBundleDisplayName: name }, android: { app_name: name } };
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "tat-lonestone",
  name: appName(commonFr.brand),
  slug: "ohyoushouldnt",
  scheme: "ohyoushouldnt",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/images/icon.png",
  backgroundColor: "#e8f0ff",
  locales: { fr: localizedName(commonFr.brand), en: localizedName(commonEn.brand) },
  ios: {
    bundleIdentifier: PACKAGE,
    supportsTablet: false,
    infoPlist: { CFBundleAllowMixedLocalizations: true },
  },
  android: {
    package: PACKAGE,
    // Aucune permission demandée (publication future sur les stores).
    permissions: [],
    adaptiveIcon: {
      backgroundColor: "#e8f0ff",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    "expo-localization",
    "expo-font",
    [
      "expo-splash-screen",
      { backgroundColor: "#e8f0ff", image: "./assets/images/splash-icon.png", imageWidth: 160 },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: {
      projectId: "b93d073b-d39f-46b2-abf8-e856996fbd9e",
    },
    APP_VARIANT,
    apiUrl,
    devCatalog: IS_DEV,
  },
});
