import assert from "node:assert/strict";
import { before, test } from "node:test";
import { apiStatusFor, publicErrorCode } from "../../src/server/api/errors";
import {
  apiError,
  apiLocaleFrom,
  originDecision,
  parseAllowedOrigins,
  readJsonBody,
  redactedApiPath,
} from "../../src/server/api/http";
import { resetPasswordWithLink } from "../../src/server/commands/auth";
import { createList } from "../../src/server/commands/lists";
import { previewInvite } from "../../src/server/commands/sharing";
import { readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, withMailDryRun, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

test("apiStatusFor : un statut par famille de codes", () => {
  assert.equal(apiStatusFor("itemNeedsName"), 400);
  assert.equal(apiStatusFor("codeInconnu"), 400);
  assert.equal(apiStatusFor("unauthorized"), 401);
  assert.equal(apiStatusFor("invalidCredentials"), 401);
  assert.equal(apiStatusFor("mustChangePassword"), 403);
  assert.equal(apiStatusFor("emailNotVerified"), 403);
  assert.equal(apiStatusFor("originNotAllowed"), 403);
  assert.equal(apiStatusFor("ownerDeleteList"), 403);
  assert.equal(apiStatusFor("listMissing"), 404);
  assert.equal(apiStatusFor("itemNotInList"), 404);
  assert.equal(apiStatusFor("notMember"), 404);
  assert.equal(apiStatusFor("itemAlreadyReserved"), 409);
  assert.equal(apiStatusFor("emailAlreadyVerified"), 409);
  assert.equal(apiStatusFor("apiVersionUnsupported"), 410);
  assert.equal(apiStatusFor("payloadTooLarge"), 413);
  assert.equal(apiStatusFor("unsupportedMediaType"), 415);
  assert.equal(apiStatusFor("pageLoadFailed"), 422);
  assert.equal(apiStatusFor("enrichEmpty"), 422);
  assert.equal(apiStatusFor("enrichEmptyNoLlm"), 422);
  assert.equal(apiStatusFor("readPasswordRequired"), 423);
  assert.equal(apiStatusFor("rateLimited"), 429);
  assert.equal(apiStatusFor("mailNotConfigured"), 503);
});

test("liens ouverts dans l'app (011) : lien invalide ou expiré en 400, invitation cassée en 404", () => {
  for (const code of [
    "confirmationLinkInvalid",
    "confirmationLinkExpired",
    "emailTaken",
    "resetLinkInvalid",
    "resetLinkExpired",
    "passwordTooShort",
  ]) {
    assert.equal(apiStatusFor(code), 400, code);
  }
  assert.equal(apiStatusFor("inviteLinkBroken"), 404);
});

test("GET /invitations/{inviteToken} (011) : 200 avec le titre, 401 sans compte, 404 pour un lien cassé", async () => {
  await withStore(apiDoc(), async () => {
    const camille = (await readDocument()).users[1]!;
    assert.deepEqual(await previewInvite(ctx(camille), { token: "it" }), { ok: true, title: "Liste d'Alex", listId: null });
    for (const [result, status] of [
      [await previewInvite(ctx(), { token: "it" }), 401],
      [await previewInvite(ctx(camille), { token: "cassé" }), 404],
    ] as const) {
      assert.ok(!result.ok);
      assert.equal((await apiError(result.error, "fr")).status, status);
    }
  });
});

test("journal des erreurs d'API : les jetons d'invitation et de lien public sont masqués (011, FR-009)", () => {
  assert.equal(redactedApiPath("/api/v1/invitations/secret-token/accept"), "/api/v1/invitations/…/accept");
  assert.equal(redactedApiPath("/api/v1/invitations/secret-token"), "/api/v1/invitations/…");
  assert.equal(redactedApiPath("/api/v1/public/lists/read-token/reservations/r1"), "/api/v1/public/lists/…/reservations/r1");
  assert.equal(redactedApiPath("/api/v1/lists/w/items"), "/api/v1/lists/w/items");
});

test("POST /auth/password-reset/confirm avec un lien inconnu : 400 resetLinkInvalid, avec son message (011)", async () => {
  await withStore(apiDoc(), async () => {
    // Même chaîne que la route : commande puis `apiError`.
    const result = await resetPasswordWithLink(ctx(), { token: "inconnu", password: "nouveau-mdp-solide", signIn: true });
    assert.ok(!result.ok);
    const response = await apiError(result.error, "en");
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "resetLinkInvalid");
    assert.ok(body.error.message.length > 0);
  });
});

test("POST /lists d'un compte non confirmé : 403 emailNotVerified, avec son message (T021)", async () => {
  const doc = apiDoc();
  doc.users[1]!.emailVerifiedAt = null;
  await withMailDryRun(() =>
    withStore(doc, async () => {
      // Même chaîne que la route (`withApi` lit les en-têtes de Next, absents hors requête) : commande puis `apiError`.
      const camille = (await readDocument()).users[1]!;
      const result = await createList(ctx(camille), { title: "Ma liste", category: "Livres", person: "Moi" });
      assert.ok(!result.ok);
      const response = await apiError(result.error, "fr");
      assert.equal(response.status, 403);
      const body = (await response.json()) as { error: { code: string; message: string } };
      assert.equal(body.error.code, "emailNotVerified");
      assert.ok(body.error.message.length > 0);
    }),
  );
});

test("un non-membre ne distingue pas une liste qui existe", () => {
  assert.equal(publicErrorCode("notMember"), "listMissing");
  assert.equal(publicErrorCode("priceInvalid"), "priceInvalid");
});

test("originDecision : site, clients natifs et origines déclarées", () => {
  const siteOrigin = "https://ohyoushouldnt.app";
  const allowed = ["capacitor://localhost"];
  assert.equal(originDecision({ origin: null, siteOrigin, allowed }), "allow");
  assert.equal(originDecision({ origin: siteOrigin, siteOrigin, allowed }), "allow");
  assert.equal(originDecision({ origin: "capacitor://localhost", siteOrigin, allowed }), "allow-cors");
  assert.equal(originDecision({ origin: "https://evil.example", siteOrigin, allowed }), "deny");
  assert.equal(originDecision({ origin: "capacitor://localhost", siteOrigin, allowed: [] }), "deny");
  assert.equal(originDecision({ origin: null, siteOrigin, allowed: [] }), "allow");
});

test("apiLocaleFrom : anglais si demandé en premier, sinon français", () => {
  assert.equal(apiLocaleFrom("en-US,en;q=0.9"), "en");
  assert.equal(apiLocaleFrom("en"), "en");
  assert.equal(apiLocaleFrom("fr-FR,en;q=0.5"), "fr");
  assert.equal(apiLocaleFrom("de"), "fr");
  assert.equal(apiLocaleFrom(null), "fr");
});

test("parseAllowedOrigins ignore les vides et les entrées invalides", () => {
  assert.deepEqual(parseAllowedOrigins(" capacitor://localhost , https://localhost/ ,"), [
    "capacitor://localhost",
    "https://localhost",
  ]);
  assert.deepEqual(parseAllowedOrigins("pas une url, https://app.example.test"), ["https://app.example.test"]);
  assert.deepEqual(
    parseAllowedOrigins("https://user:pw@app.example.test, https://app.example.test/chemin, ftp://x.test"),
    [],
  );
  assert.deepEqual(parseAllowedOrigins(""), []);
  assert.deepEqual(parseAllowedOrigins(undefined), []);
});

function jsonRequest(body: BodyInit, contentType = "application/json"): Request {
  return new Request("http://localhost/api/v1/x", { method: "POST", headers: { "content-type": contentType }, body });
}

test("readJsonBody : JSON objet seulement, en JSON, 64 Ko au plus", async () => {
  assert.deepEqual(await readJsonBody(jsonRequest('{"a":1}')), { ok: true, body: { a: 1 } });
  assert.deepEqual(await readJsonBody(jsonRequest("a=1", "text/plain")), { ok: false, error: "unsupportedMediaType" });
  assert.deepEqual(await readJsonBody(jsonRequest("[1]")), { ok: false, error: "invalidJson" });
  assert.deepEqual(await readJsonBody(jsonRequest("{cassé")), { ok: false, error: "invalidJson" });
  assert.deepEqual(await readJsonBody(jsonRequest("null")), { ok: false, error: "invalidJson" });
  const big = JSON.stringify({ a: "x".repeat(64 * 1024) });
  assert.deepEqual(await readJsonBody(jsonRequest(big)), { ok: false, error: "payloadTooLarge" });
});

test("readJsonBody : un corps envoyé en morceaux, sans taille déclarée, est coupé à 64 Ko", async () => {
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent += 16 * 1024;
      controller.enqueue(new Uint8Array(16 * 1024).fill(0x20));
      if (sent > 1024 * 1024) controller.close();
    },
  });
  // `duplex` est exigé par Node pour un corps en flux, absent des types DOM de RequestInit.
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  };
  const req = new Request("http://localhost/api/v1/x", init);
  assert.deepEqual(await readJsonBody(req), { ok: false, error: "payloadTooLarge" });
  assert.ok(sent < 1024 * 1024, "la lecture s'arrête avant la fin du flux");
});
