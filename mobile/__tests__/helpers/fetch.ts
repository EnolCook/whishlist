/** Faux serveur HTTP : une réponse par « MÉTHODE /chemin », et la liste des appels reçus. */
export function fakeFetch(routes: Record<string, (request: Request) => Response | Promise<Response>>) {
  const calls: string[] = [];
  const mock = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
    if (!(input instanceof Request)) throw new Error("fetch called without a Request");
    const key = `${input.method} ${new URL(input.url).pathname.replace("/api/v1", "")}`;
    calls.push(key);
    const route = routes[key];
    if (!route) return json(500, { error: { code: "serverError", message: `no route ${key}` } });
    return route(input);
  });
  globalThis.fetch = mock;
  return { calls, mock };
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const me = {
  id: "alex",
  email: "alex@example.test",
  displayName: "Alex",
  mustChangePassword: false,
  emailVerified: true,
  pendingEmail: null as string | null,
};
