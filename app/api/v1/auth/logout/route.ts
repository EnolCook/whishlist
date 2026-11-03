import { bearerToken } from "@/src/server/api/auth";
import { commandContext } from "@/src/server/api/context";
import { apiError, apiNoContent, apiPreflight, withApi } from "@/src/server/api/http";
import { logout } from "@/src/server/commands/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (api) => {
  const ctx = await commandContext(api);
  const token = bearerToken(api.req);
  if (!ctx.user || !token) return apiError("unauthorized", api.locale, api.cors);
  await logout(ctx, { token });
  return apiNoContent(api.cors);
});

export const OPTIONS = apiPreflight;
