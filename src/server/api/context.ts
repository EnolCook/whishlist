import { origin } from "../../auth/current";
import type { CommandContext } from "../commands/context";
import type { ApiRequestContext } from "./http";
import { optionalApiUser } from "./auth";

/** Contexte des commandes pour une requête d'API (compte du bearer s'il y en a un). */
export async function commandContext(api: ApiRequestContext): Promise<CommandContext> {
  const [user, base] = await Promise.all([optionalApiUser(api.req), origin()]);
  return { user, ip: api.ip, locale: api.locale, origin: base };
}
