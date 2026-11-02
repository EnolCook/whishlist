import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, readJsonBody, text, withApi } from "@/src/server/api/http";
import { resetPasswordWithLink } from "@/src/server/commands/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nouveau mot de passe depuis le lien reçu par e-mail, ouvert dans l'app (011). Avec `signIn`, rend une session. */
export const POST = withApi(async (api) => {
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const result = await resetPasswordWithLink(await commandContext(api), {
    token: text(body.body.token),
    password: text(body.body.password),
    signIn: body.body.signIn === true,
  });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson({ session: result.session }, 200, api.cors);
});

export const OPTIONS = apiPreflight;
