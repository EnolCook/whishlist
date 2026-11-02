import { androidAssociation, appleAssociation } from "@/src/site/app-links";

/**
 * Réglages des fichiers d'association du domaine (feature 011, R2). Optionnels : sans eux, les routes
 * répondent 404 et les liens ouvrent le site, comme avant. Lus côté serveur uniquement.
 */

/** Identifiant d'équipe Apple (10 caractères), ou `null`. */
export function appleTeamId(): string | null {
  const raw = process.env.APPLE_TEAM_ID?.trim().toUpperCase();
  return raw && /^[A-Z0-9]{10}$/.test(raw) ? raw : null;
}

/** Empreintes SHA-256 des certificats de signature Android, séparées par des virgules. */
export function androidCertFingerprints(): string[] {
  return (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function associationResponse(body: unknown | null): Response {
  if (body === null) return new Response(null, { status: 404 });
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}

/** `GET /.well-known/apple-app-site-association`. */
export function appleAssociationResponse(): Response {
  const teamId = appleTeamId();
  return associationResponse(teamId ? appleAssociation(teamId) : null);
}

/** `GET /.well-known/assetlinks.json` ; 404 sans aucune empreinte valide. */
export function androidAssociationResponse(): Response {
  const body = androidAssociation(androidCertFingerprints());
  return associationResponse(body[0].target.sha256_cert_fingerprints.length ? body : null);
}
