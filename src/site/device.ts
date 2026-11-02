/** Système d'un téléphone (feature 011, US3) : l'icône de l'app ne s'affiche que sur un téléphone. */
export type PhonePlatform = "ios" | "android";

/**
 * Plateforme d'après le navigateur : iPhone ou iPod → iOS ; Android avec « Mobile » (ou `userAgentData.mobile`)
 * → Android. Un iPad (qui se présente en Mac depuis iPadOS 13), une tablette Android et un ordinateur → `null`.
 */
export function phonePlatform(userAgent: string, uaDataMobile?: boolean): PhonePlatform | null {
  if (/\b(iPhone|iPod)\b/.test(userAgent)) return "ios";
  if (/\bAndroid\b/.test(userAgent) && (/\bMobile\b/.test(userAgent) || uaDataMobile === true)) return "android";
  return null;
}
