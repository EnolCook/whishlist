import { isApiKeyToken } from "../../auth/api-keys";
import type { User } from "../../domain/types";
import { apiKeyUser, bearerFrom } from "../api/auth";
import { originDecision } from "../api/http";
import { isRateLimitError } from "../rate-limit";

export type McpAccess =
  | { ok: true; user: User }
  | { ok: false; error: "originNotAllowed" | "unauthorized" | "rateLimited" };

/**
 * Qui peut ouvrir le serveur MCP : une clé d'API valide (`Bearer oys_…`), jamais un jeton de session de l'app,
 * et pas depuis la page d'un autre site (même règle d'origine que l'API, sans origine déclarée).
 */
export async function mcpAccess(input: {
  origin: string | null;
  siteOrigin: string;
  authorization: string | null;
  /** IP de confiance du client : les clés inconnues ou révoquées y comptent des échecs (`apiKeyUser`). */
  ip?: string | null;
}): Promise<McpAccess> {
  if (originDecision({ origin: input.origin, siteOrigin: input.siteOrigin, allowed: [] }) === "deny") {
    return { ok: false, error: "originNotAllowed" };
  }
  const token = bearerFrom(input.authorization);
  if (!token || !isApiKeyToken(token)) return { ok: false, error: "unauthorized" };
  try {
    const user = await apiKeyUser(token, input.ip ?? null);
    return user ? { ok: true, user } : { ok: false, error: "unauthorized" };
  } catch (error) {
    if (isRateLimitError(error)) return { ok: false, error: "rateLimited" };
    throw error;
  }
}
