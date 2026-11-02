import { stripLocalePrefix } from "@/src/i18n/locale-path";

/** Choix local du visiteur. Pas un cookie. */
export const ANALYTICS_OPTOUT_KEY = "wishlist-analytics-optout";

/** Chemins dont l'adresse est une capacité ou une session. Jamais envoyés. */
const PRIVATE_PREFIXES = [
  "/l",
  "/listes",
  "/connexion",
  "/inscription",
  "/compte",
  "/inviter",
  "/reinitialiser",
  "/confirmer-email",
  "/changer-mot-de-passe",
  "/mot-de-passe-oublie",
  "/u",
] as const;

/** Accepte un chemin ou une URL absolue. La requête et le fragment sont ignorés. */
export function analyticsTargetAllowed(value: string): boolean {
  try {
    return analyticsCollectAllowed(new URL(value, "https://analytics.invalid").pathname);
  } catch {
    return false;
  }
}

export function analyticsCollectAllowed(pathname: string): boolean {
  const bare = stripLocalePrefix(pathname).path;
  const path = bare.split("?")[0]?.split("#")[0] || "/";
  return !PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Script inline, sans donnée d'instance. En cas de doute, n'envoie rien. */
export function analyticsBeforeSendSource(): string {
  const key = JSON.stringify(ANALYTICS_OPTOUT_KEY);
  const prefixes = JSON.stringify(PRIVATE_PREFIXES);
  return `window.umamiBeforeSend=function(type,payload){try{if(navigator.globalPrivacyControl)return false;if(localStorage.getItem(${key})==="1")return false;var path=new URL((payload&&payload.url)||"/",location.href).pathname;var bare=path==="/en"||path==="/en/"||path==="/fr"||path==="/fr/"?"/":path.indexOf("/en/")===0||path.indexOf("/fr/")===0?(path.slice(3)||"/"):path;var list=${prefixes};for(var i=0;i<list.length;i++){if(bare===list[i]||bare.indexOf(list[i]+"/")===0)return false}}catch(e){return false}return payload}`;
}
