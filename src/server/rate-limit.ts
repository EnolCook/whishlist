import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** In-memory (1 process). Suffisant pour l'instance Docker unique. */
export function takeToken(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

/** Vrai si le seau a déjà pris `limit` jetons dans sa fenêtre en cours, sans en prendre un. */
export function bucketExhausted(key: string, limit: number, now = Date.now()): boolean {
  const current = buckets.get(key);
  return current !== undefined && current.resetAt > now && current.count >= limit;
}

function trustedIp(value: string | null | undefined): string | null {
  const hop = value?.split(",")[0]?.trim() ?? "";
  if (!hop || hop.length > 64) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(hop)) return null;
  return hop;
}

/**
 * IP posée par le proxy (Cloudflare, puis X-Real-IP).
 * `X-Forwarded-For` n’est pas lu : le client peut l’inventer.
 * `null` s’il n’y a pas d’IP de confiance — jamais un seau partagé « unknown ».
 */
export function clientAddress(header: {
  cfConnectingIp?: string | null;
  realIp?: string | null;
}): string | null {
  return trustedIp(header.cfConnectingIp) ?? trustedIp(header.realIp);
}

/** Sans IP de confiance : en production on refuse, en dev on ne limite pas. */
export function missingIpPolicy(nodeEnv = process.env.NODE_ENV): "skip" | "deny" {
  return nodeEnv === "production" ? "deny" : "skip";
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return clientAddress({
    cfConnectingIp: h.get("cf-connecting-ip"),
    realIp: h.get("x-real-ip"),
  });
}

/** Même règle que `rateLimitOrThrow`, avec une IP déjà lue (commandes partagées site / API). */
export function rateLimitForIp(
  scope: string,
  ip: string | null,
  limit: number,
  windowMs: number,
): void {
  if (!ip) {
    if (missingIpPolicy() === "deny") throw new RateLimitError(scope);
    return;
  }
  if (!takeToken(`${scope}:${ip}`, limit, windowMs)) {
    throw new RateLimitError(scope);
  }
}

export async function rateLimitOrThrow(
  scope: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  rateLimitForIp(scope, await clientIp(), limit, windowMs);
}

export class RateLimitError extends Error {
  readonly scope: string;
  constructor(scope: string) {
    super("rateLimited");
    this.scope = scope;
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/** Test helper — vide les buckets. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
