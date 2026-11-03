import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiNoContent, apiPreflight, readJsonBody, text, withApi } from "@/src/server/api/http";
import { deleteOwnAccount, previewOwnDeletion } from "@/src/server/commands/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ce que ferait la suppression du compte, sans rien changer. */
export const GET = withApi(async (api) => {
  const result = await previewOwnDeletion(await commandContext(api));
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson(result.preview, 200, api.cors);
});

/** Supprime le compte connecté ; le jeton de cette requête ne vaut plus rien ensuite. */
export const POST = withApi(async (api) => {
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const result = await deleteOwnAccount(await commandContext(api), { password: text(body.body.password) });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiNoContent(api.cors);
});

export const OPTIONS = apiPreflight;
