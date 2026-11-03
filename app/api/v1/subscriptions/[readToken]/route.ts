import { commandContext } from "@/src/server/api/context";
import { apiError, apiNoContent, apiPreflight, withApi } from "@/src/server/api/http";
import { unsubscribeFromList } from "@/src/server/commands/public-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApi<{ readToken: string }>(async (api, { readToken }) => {
  const result = await unsubscribeFromList(await commandContext(api), { readToken });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiNoContent(api.cors);
});

export const OPTIONS = apiPreflight;
