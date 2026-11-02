import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, readJsonBody, text, withApi } from "@/src/server/api/http";
import { confirmEmailWithToken } from "@/src/server/commands/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirme le lien reçu par e-mail, ouvert dans l'app (011). Le bearer, facultatif, ne sert qu'à `ownAccount` :
 * le jeton du lien porte toute l'autorisation. Le corps n'est pas journalisé (il contient le jeton).
 */
export const POST = withApi(async (api) => {
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const result = await confirmEmailWithToken(await commandContext(api), {
    token: text(body.body.token),
    suite: text(body.body.suite) || null,
  });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson({ purpose: result.purpose, ownAccount: result.ownAccount, suite: result.suite }, 200, api.cors);
});

export const OPTIONS = apiPreflight;
