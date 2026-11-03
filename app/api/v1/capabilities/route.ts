import { llmConfigured } from "@/src/domain/product-llm";
import { analyticsConfigured } from "@/src/server/analytics";
import { mailConfigured } from "@/src/server/mail";
import { apiJson, apiPreflight, withApi } from "@/src/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_VERSION = "1.8.0";

export const GET = withApi(async ({ cors }) =>
  apiJson(
    { apiVersion: API_VERSION, enrich: llmConfigured(), mail: mailConfigured(), analytics: analyticsConfigured() },
    200,
    cors,
  ),
);

export const OPTIONS = apiPreflight;
