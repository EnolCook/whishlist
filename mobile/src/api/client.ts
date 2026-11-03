import Constants from "expo-constants";
import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

export type Schemas = components["schemas"];

/** Refus du serveur : `{ error: { code, message } }` (contrat 004). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly title: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Serveur injoignable (pas de réseau, délai dépassé). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("network", { cause });
    this.name = "NetworkError";
  }
}

type ClientHooks = {
  getToken: () => string | null;
  getLocale: () => string;
  onUnauthorized: () => void;
  onUpgradeRequired: (message: string) => void;
};

const hooks: ClientHooks = {
  getToken: () => null,
  getLocale: () => "fr",
  onUnauthorized: () => {},
  onUpgradeRequired: () => {},
};

/** Branche la session, la langue et les écrans globaux (401, 410) sur le client. */
export function configureClient(next: Partial<ClientHooks>): void {
  Object.assign(hooks, next);
}

/** Adresse du site, fixée au build (`EXPO_PUBLIC_API_URL`). */
export function siteOrigin(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl;
  const origin = typeof configured === "string" && configured ? configured : "http://localhost:3000";
  return origin.replace(/\/$/, "");
}

export function apiBaseUrl(): string {
  return `${siteOrigin()}/api/v1`;
}

async function send(request: Request): Promise<Response> {
  const token = hooks.getToken();
  if (token) request.headers.set("Authorization", `Bearer ${token}`);
  request.headers.set("Accept-Language", hooks.getLocale());
  request.headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await globalThis.fetch(request);
  } catch (error) {
    throw new NetworkError(error);
  }
  if (response.status === 401) hooks.onUnauthorized();
  if (response.status === 410) {
    hooks.onUpgradeRequired((await apiErrorFrom(response.clone(), undefined)).message);
  }
  return response;
}

export const api = createClient<paths>({ baseUrl: apiBaseUrl(), fetch: send });

function isErrorBody(value: unknown): value is Schemas["Error"] & { title?: unknown } {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string";
}

/** Erreur du serveur à partir de la réponse (et du corps déjà lu par openapi-fetch, s'il y en a un). */
export async function apiErrorFrom(response: Response, body: unknown): Promise<ApiError> {
  let parsed = body;
  if (parsed === undefined) parsed = await response.json().catch(() => undefined);
  if (isErrorBody(parsed)) {
    const title = typeof parsed.title === "string" ? parsed.title : null;
    return new ApiError(parsed.error.code, response.status, parsed.error.message, title);
  }
  return new ApiError(response.status >= 500 ? "serverError" : "unexpected", response.status, response.statusText);
}

type Answer<T> = { data?: T; error?: unknown; response: Response };

/** Rend le corps d'une réponse réussie, ou lève l'`ApiError` du serveur. */
export async function ok<T>(request: Promise<Answer<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok || data === undefined) throw await apiErrorFrom(response, error);
  return data;
}

/** Pour les réponses sans corps (204). */
export async function done(request: Promise<{ error?: unknown; response: Response }>): Promise<Response> {
  const { error, response } = await request;
  if (!response.ok) throw await apiErrorFrom(response, error);
  return response;
}
