import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, readJsonBody, text, withApi } from "@/src/server/api/http";
import { changeOwnPassword } from "@/src/server/commands/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Périme toutes les connexions du compte, puis rend un nouveau jeton à ce client. */
export const POST = withApi(async (api) => {
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const result = await changeOwnPassword(await commandContext(api), {
    password: text(body.body.password),
    currentPassword: text(body.body.currentPassword),
    openApiSession: true,
  });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson(result.session, 200, api.cors);
});

export const OPTIONS = apiPreflight;
