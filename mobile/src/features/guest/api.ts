import { api, ApiError, done, ok, type Schemas } from "@/api/client";

import { claimsFor, forgetReservation, forgetUnlock, saveClaim, saveUnlock, unlockTokenFor } from "./storage";

/**
 * Routes publiques d'une liste pour la vue invité (011, US4), comme la page publique du site.
 * Toujours en ligne : une réservation ne passe jamais par la file hors ligne (FR-010b, principe III).
 * Le bearer, s'il y a une session, est ajouté par le client : la réservation est alors liée au compte.
 */
async function proofHeaders(readToken: string, withClaims: boolean) {
  const [unlock, claims] = await Promise.all([unlockTokenFor(readToken), withClaims ? claimsFor(readToken) : []]);
  return {
    ...(unlock ? { "X-Read-Unlock": unlock } : {}),
    ...(claims.length ? { "X-Reservation-Claims": claims.join(",") } : {}),
  };
}

export async function readGuestList(readToken: string): Promise<Schemas["PublicList"]> {
  try {
    return await ok(
      api.GET("/public/lists/{readToken}", {
        params: { path: { readToken }, header: await proofHeaders(readToken, true) },
      }),
    );
  } catch (error) {
    // Jeton refusé (mot de passe changé depuis) : on l'oublie, la liste redemande le mot de passe.
    if (error instanceof ApiError && error.code === "readPasswordRequired") await forgetUnlock(readToken);
    throw error;
  }
}

export async function unlockGuestList(readToken: string, password: string): Promise<void> {
  const answer = await ok(api.POST("/public/lists/{readToken}/unlock", { params: { path: { readToken } }, body: { password } }));
  if (answer.unlockToken && answer.expiresAt) await saveUnlock(readToken, answer.unlockToken, answer.expiresAt);
}

export async function reserveGuestItem(
  readToken: string,
  input: { itemId: string; typeId?: string; fromName: string; note: string },
): Promise<void> {
  const answer = await ok(
    api.POST("/public/lists/{readToken}/reservations", {
      params: { path: { readToken }, header: await proofHeaders(readToken, false) },
      body: {
        itemId: input.itemId,
        ...(input.typeId ? { typeId: input.typeId } : {}),
        fromName: input.fromName.trim(),
        note: input.note.trim(),
      },
    }),
  );
  if (answer.claim) await saveClaim(readToken, answer.reservationId, answer.claim);
}

export async function cancelGuestReservation(readToken: string, reservationId: string): Promise<void> {
  await done(
    api.DELETE("/public/lists/{readToken}/reservations/{reservationId}", {
      params: { path: { readToken, reservationId }, header: await proofHeaders(readToken, true) },
    }),
  );
  await forgetReservation(reservationId);
}
