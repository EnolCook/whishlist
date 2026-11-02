/** Statut HTTP de chaque code d'erreur rendu par l'API. Un code absent vaut 400 (validation). */
const STATUS_BY_CODE: Record<string, number> = {
  unauthorized: 401,
  invalidCredentials: 401,

  mustChangePassword: 403,
  emailNotVerified: 403,
  apiKeyNotAllowed: 403,
  originNotAllowed: 403,
  accessDenied: 403,
  ownerRegenerateInvite: 403,
  ownerRemoveMember: 403,
  ownerDeleteList: 403,
  ownerSetReadPassword: 403,

  notFound: 404,
  listMissing: 404,
  notMember: 404,
  itemMissing: 404,
  itemNotInList: 404,
  typeMissing: 404,
  personMissing: 404,
  reservationMissing: 404,
  accountMissing: 404,
  inviteLinkBroken: 404,

  itemAlreadyReserved: 409,
  idConflict: 409,
  emailAlreadyVerified: 409,
  apiVersionUnsupported: 410,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,

  pageLoadFailed: 422,
  enrichEmpty: 422,
  enrichEmptyNoLlm: 422,

  readPasswordRequired: 423,
  rateLimited: 429,
  serverError: 500,
  inviteSendFailed: 502,
  mailNotConfigured: 503,
};

export function apiStatusFor(code: string): number {
  return STATUS_BY_CODE[code] ?? 400;
}

/** Un non-membre reçoit la même réponse que pour une liste qui n'existe pas (FR-030). */
export function publicErrorCode(code: string): string {
  return code === "notMember" ? "listMissing" : code;
}
