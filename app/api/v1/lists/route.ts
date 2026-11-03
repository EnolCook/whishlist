import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, optionalText, readJsonBody, text, withApi } from "@/src/server/api/http";
import { createList, listMine } from "@/src/server/commands/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (api) => {
  const result = await listMine(await commandContext(api));
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  return apiJson({ lists: result.lists, subscriptions: result.subscriptions }, 200, api.cors);
});

export const POST = withApi(async (api) => {
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const result = await createList(await commandContext(api), {
    title: text(body.body.title),
    category: text(body.body.category),
    person: text(body.body.person),
    id: optionalText(body.body.id),
    categoryId: optionalText(body.body.categoryId),
    personId: optionalText(body.body.personId),
  });
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  // 200 : renvoi d'une création déjà reçue (même `id`), rien n'est créé.
  return apiJson(result.list, result.replayed ? 200 : 201, api.cors);
});

export const OPTIONS = apiPreflight;
