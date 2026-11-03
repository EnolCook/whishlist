import { guestProofs } from "@/src/server/api/auth";
import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, optionalText, readJsonBody, text, withApi } from "@/src/server/api/http";
import { subscribeToList } from "@/src/server/commands/public-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (api) => {
  const body = await readJsonBody(api.req);
  if (!body.ok) return apiError(body.error, api.locale, api.cors);
  const urlOrToken = text(body.body.urlOrToken);
  const password = optionalText(body.body.password);
  // Le jeton de la liste est extrait par la commande : la preuve `X-Read-Unlock` se vérifie sur la liste trouvée.
  const result = await subscribeToList(await commandContext(api), {
    urlOrToken,
    password,
    isUnlocked: (list) => guestProofs(api.req, list.readToken).isUnlocked(list),
  });
  if (!result.ok) {
    const extra =
      "title" in result ? { title: result.title, readToken: result.readToken } : undefined;
    return apiError(result.error, api.locale, api.cors, extra);
  }
  return apiJson(result.subscription, result.replayed ? 200 : 201, api.cors);
});

export const OPTIONS = apiPreflight;
