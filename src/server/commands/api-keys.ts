import { createApiKey } from "../../auth/api-keys";
import { revokeApiKey, type ApiKeyView } from "../../domain/api-keys";
import { updateDocument } from "../../store/db";
import { rateLimitForIp } from "../rate-limit";
import { activeUser, type CommandContext, type CommandResult } from "./context";

/** Crée une clé ; le jeton n'est rendu qu'ici. Limité à 10 créations par heure. */
export async function createMyApiKey(
  ctx: CommandContext,
  input: { name: string },
): Promise<CommandResult<{ token: string; key: ApiKeyView }>> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  rateLimitForIp(`api-key-create:${active.user.id}`, ctx.ip, 10, 60 * 60 * 1000);
  return updateDocument<CommandResult<{ token: string; key: ApiKeyView }>>((doc) => {
    const created = createApiKey(doc, active.user, input);
    if (!created.ok) return { doc, result: created };
    return { doc: created.doc, result: { ok: true, token: created.token, key: created.key } };
  });
}

export async function revokeMyApiKey(ctx: CommandContext, input: { keyId: string }): Promise<CommandResult> {
  const active = activeUser(ctx);
  if (!active.ok) return active;
  return updateDocument<CommandResult>((doc) => {
    const revoked = revokeApiKey(doc, { userId: active.user.id, keyId: input.keyId });
    return revoked.ok ? { doc: revoked.doc, result: { ok: true } } : { doc, result: revoked };
  });
}
