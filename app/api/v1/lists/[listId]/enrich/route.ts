import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, readJsonBody, text, withApi } from "@/src/server/api/http";
import { enrichFromUrl } from "@/src/server/commands/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi<{ listId: string }>(async (api, { listId }) => {
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const result = await enrichFromUrl(await commandContext(api), { wishlistId: listId, url: text(body.body.url) });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  const { name, price, imageUrl, typeId, description, usedLlm } = result;
  return apiJson({ name, price, imageUrl, typeId, description, usedLlm }, 200, api.cors);
});

export const OPTIONS = apiPreflight;
