import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, withApi } from "@/src/server/api/http";
import { previewInvite } from "@/src/server/commands/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aperçu d'une invitation avant de la rejoindre (011) : titre, et `listId` si le compte en est déjà membre. */
export const GET = withApi<{ inviteToken: string }>(async (api, { inviteToken }) => {
  const result = await previewInvite(await commandContext(api), { token: inviteToken });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson({ title: result.title, listId: result.listId }, 200, api.cors);
});

export const OPTIONS = apiPreflight;
