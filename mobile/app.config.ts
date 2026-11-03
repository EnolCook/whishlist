import type { ConfigContext, ExpoConfig } from "expo/config";

import commonEn from "../locales/en/common.json";
import commonFr from "../locales/fr/common.json";
import mobileEn from "../locales/en/mobile.json";
import mobileFr from "../locales/fr/mobile.json";
import appLinkRoutes from "../src/site/app-link-routes.json";

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

/**
 * Liens du site ouverts par l'app (feature 011) : seulement pour un serveur en HTTPS, celui des builds de store.
 * Le domaine publie les fichiers d'association (`/.well-known/…`) ; la variante de développement n'y figure pas.
 */
const APP_LINK_DOMAIN = IS_DEV ? null : (/^https:\/\/([^/:]+)/.exec(apiUrl)?.[1] ?? null);
/** Préfixes des chemins ouverts par l'app, avec et sans `/en` (même calcul que `androidPathPrefixes`, vérifié par un test). */
const APP_LINK_PREFIXES = [
  ...new Set(appLinkRoutes.flatMap((route) => [route.site.split(":")[0], `/en${route.site.split(":")[0]}`])),
];

function appName(brand: string) {
  return IS_DEV ? `${brand} (Dev)` : brand;
}

/** Nom de l'app et texte de la demande d'accès à l'appareil photo (scan du QR code d'une liste, 012), par langue. */
function localized(brand: string, cameraUsage: string) {
  const name = appName(brand);
  return { ios: { CFBundleDisplayName: name, NSCameraUsageDescription: cameraUsage }, android: { app_name: name } };
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "tat-lonestone",
  name: appName(commonFr.brand),
  slug: "ohyoushouldnt",
  scheme: "ohyoushouldnt",
  version: "1.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/images/icon.png",
  backgroundColor: "#e8f0ff",
  locales: {
    fr: localized(commonFr.brand, mobileFr.shared.cameraUsage),
    en: localized(commonEn.brand, mobileEn.shared.cameraUsage),
  },
  ios: {
    bundleIdentifier: PACKAGE,
    supportsTablet: false,
    // Chiffrement : HTTPS seulement (exempté), pour que TestFlight ne demande rien à chaque build.
    infoPlist: { CFBundleAllowMixedLocalizations: true, ITSAppUsesNonExemptEncryption: false },
    ...(APP_LINK_DOMAIN ? { associatedDomains: [`applinks:${APP_LINK_DOMAIN}`] } : {}),
  },
  android: {
    package: PACKAGE,
    // Seule permission : l'appareil photo, pour scanner le QR code d'une liste à suivre (012, FR-012).
    permissions: ["android.permission.CAMERA"],
    ...(APP_LINK_DOMAIN
      ? {
          intentFilters: [
            {
              action: "VIEW",
              autoVerify: true,
              category: ["BROWSABLE", "DEFAULT"],
              data: APP_LINK_PREFIXES.map((pathPrefix) => ({ scheme: "https", host: APP_LINK_DOMAIN, pathPrefix })),
            },
          ],
        }
      : {}),
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
    // Recevoir un lien partagé depuis une autre app (« Ajouter à une liste ») : liens et texte seulement.
    [
      "expo-sharing",
      {
        ios: { enabled: true, activationRule: { supportsText: true, supportsWebUrlWithMaxCount: 1 } },
        android: { enabled: true, singleShareMimeTypes: ["text/plain"] },
      },
    ],
    // Scanner le QR code d'une liste (012) : appareil photo seulement, ni micro ni enregistrement audio.
    [
      "expo-camera",
      { cameraPermission: mobileFr.shared.cameraUsage, microphonePermission: false, recordAudioAndroid: false },
    ],
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
