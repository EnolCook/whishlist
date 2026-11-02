import { createMcpHandler } from "@modelcontextprotocol/server";
import type { NextRequest } from "next/server";
import { isApiKeyToken } from "@/src/auth/api-keys";
import { origin } from "@/src/auth/current";
import { apiKeyUser, bearerToken } from "@/src/server/api/auth";
import { apiLocaleFrom } from "@/src/server/api/http";
import type { CommandContext } from "@/src/server/commands/context";
import { buildMcpServer } from "@/src/server/mcp/server";
import { clientIp, isRateLimitError } from "@/src/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sans état : une instance du serveur par requête, construite pour le compte de la clé. */
const handler = createMcpHandler(({ authInfo }) => buildMcpServer(authInfo?.extra?.ctx as CommandContext));

function refuse(status: number, message: string, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "private, no-store", ...extraHeaders } },
  );
}

/**
 * Serveur MCP (Streamable HTTP) pour un assistant IA. Une clé d'API (`Authorization: Bearer oys_…`) est
 * obligatoire ; un jeton de session de l'app ne suffit pas. Une page d'un autre site ne peut pas l'appeler.
 */
async function serve(req: NextRequest): Promise<Response> {
  const site = await origin();
  const from = req.headers.get("origin");
  if (from && from !== site) return refuse(403, "Origin not allowed.");
  const token = bearerToken(req);
  const challenge = { "www-authenticate": 'Bearer realm="mcp"' };
  if (!token || !isApiKeyToken(token)) return refuse(401, "An API key is required (Authorization: Bearer oys_…).", challenge);
  let user;
  try {
    user = await apiKeyUser(token);
  } catch (error) {
    if (isRateLimitError(error)) return refuse(429, "Too many requests for this key. Try again in a minute.");
    throw error;
  }
  if (!user) return refuse(401, "Unknown or revoked API key.", challenge);
  const ctx: CommandContext = {
    user,
    ip: await clientIp(),
    locale: apiLocaleFrom(req.headers.get("accept-language")),
    origin: site,
  };
  const response = await handler.fetch(req, { authInfo: { token, clientId: user.id, scopes: [], extra: { ctx } } });
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
