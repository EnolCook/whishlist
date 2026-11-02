import * as SecureStore from "expo-secure-store";

/**
 * Preuves de la vue invité gardées sur le téléphone (011, data-model « Accès invité ») : le jeton de
 * déverrouillage d'une liste protégée (`X-Read-Unlock`, 14 jours, durée rendue par le serveur) et les claims
 * des réservations faites sans compte (`X-Reservation-Claims`, 90 jours), comme les cookies du site.
 */
const UNLOCKS = "guest.unlocks";
const CLAIMS = "guest.claims";
const CLAIM_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Le serveur lit 50 claims au plus par liste. */
const MAX_CLAIMS_PER_LIST = 50;

type Unlock = { token: string; expiresAt: string };
type Claim = { claim: string; readToken: string; reservationId: string; expiresAt: string };

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function alive(expiresAt: string, now = Date.now()): boolean {
  return Date.parse(expiresAt) > now;
}

async function unlocks(): Promise<Record<string, Unlock>> {
  const all = await readJson<Record<string, Unlock>>(UNLOCKS, {});
  return Object.fromEntries(Object.entries(all).filter(([, unlock]) => alive(unlock.expiresAt)));
}

async function claims(): Promise<Claim[]> {
  return (await readJson<Claim[]>(CLAIMS, [])).filter((claim) => alive(claim.expiresAt));
}

/** Jeton de déverrouillage encore valable pour cette liste, sinon `null`. */
export async function unlockTokenFor(readToken: string): Promise<string | null> {
  return (await unlocks())[readToken]?.token ?? null;
}

export async function saveUnlock(readToken: string, token: string, expiresAt: string): Promise<void> {
  await SecureStore.setItemAsync(UNLOCKS, JSON.stringify({ ...(await unlocks()), [readToken]: { token, expiresAt } }));
}

/** Jeton refusé (mot de passe changé, `readPasswordRequired`) : on l'oublie. */
export async function forgetUnlock(readToken: string): Promise<void> {
  const { [readToken]: _dropped, ...rest } = await unlocks();
  await SecureStore.setItemAsync(UNLOCKS, JSON.stringify(rest));
}

/** Claims de cette liste, les plus récents d'abord. */
export async function claimsFor(readToken: string): Promise<string[]> {
  return (await claims())
    .filter((entry) => entry.readToken === readToken)
    .reverse()
    .slice(0, MAX_CLAIMS_PER_LIST)
    .map((entry) => entry.claim);
}

export async function saveClaim(readToken: string, reservationId: string, claim: string, now = Date.now()): Promise<void> {
  const next = [...(await claims()), { claim, readToken, reservationId, expiresAt: new Date(now + CLAIM_TTL_MS).toISOString() }];
  await SecureStore.setItemAsync(CLAIMS, JSON.stringify(next));
}

/** Réservation annulée : son claim ne sert plus. */
export async function forgetReservation(reservationId: string): Promise<void> {
  const next = (await claims()).filter((entry) => entry.reservationId !== reservationId);
  await SecureStore.setItemAsync(CLAIMS, JSON.stringify(next));
}

/** Déconnexion ou suppression du compte : le téléphone oublie aussi l'accès invité. */
export async function clearGuestAccess(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(UNLOCKS), SecureStore.deleteItemAsync(CLAIMS)]);
}
