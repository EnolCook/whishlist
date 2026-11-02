import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, readJsonBody, refuseApiKey, text, withApi } from "@/src/server/api/http";
import { cancelOwnEmailChange, requestOwnEmailChange } from "@/src/server/commands/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Demande de changement d'adresse : un lien part vers la nouvelle (010, US3). */
export const POST = withApi(async (api) => {
  const refused = await refuseApiKey(api);
  if (refused) return refused;
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const result = await requestOwnEmailChange(await commandContext(api), {
    email: text(body.body.email),
    currentPassword: text(body.body.currentPassword),
  });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson(result.me, 200, api.cors);
});

/** Annule le changement en attente. */
export const DELETE = withApi(async (api) => {
  const refused = await refuseApiKey(api);
  if (refused) return refused;
  const result = await cancelOwnEmailChange(await commandContext(api));
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson(result.me, 200, api.cors);
});

export const OPTIONS = apiPreflight;
