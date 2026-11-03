import { commandContext } from "@/src/server/api/context";
import { apiError, apiJson, apiPreflight, withApi } from "@/src/server/api/http";
import { exportFileName } from "@/src/domain/export-file";
import { exportOwnAccount } from "@/src/server/commands/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (api) => {
  const result = await exportOwnAccount(await commandContext(api));
  if (!result.ok) return apiError(result.error, api.locale, api.cors);
  const response = apiJson(result.data, 200, api.cors);
  response.headers.set("content-disposition", `attachment; filename="${exportFileName(result.data.exportedAt, api.locale)}"`);
  return response;
});

export const OPTIONS = apiPreflight;
