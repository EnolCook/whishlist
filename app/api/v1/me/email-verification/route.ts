import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, withApi } from "@/src/server/api/http";
import { resendEmailVerification } from "@/src/server/commands/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renvoie le lien de confirmation de l'adresse ; le précédent ne vaut plus rien (010, US2). */
export const POST = withApi(async (api) => {
  const result = await resendEmailVerification(await commandContext(api));
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson({ sent: result.sent }, 202, api.cors);
});

export const OPTIONS = apiPreflight;
