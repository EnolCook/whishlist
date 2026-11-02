import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, test } from "node:test";
import { NextRequest } from "next/server";
import {
  API_KEY_PREFIX,
  MAX_API_KEYS,
  createApiKey,
  findApiKey,
  listApiKeys,
  revokeApiKey,
  touchApiKey,
} from "../../src/auth/api-keys";
import { deleteAccount } from "../../src/domain/account";
import { apiKeyUser, optionalApiUser, usesApiKey } from "../../src/server/api/auth";
import { refuseApiKey } from "../../src/server/api/http";
import { createMyApiKey, revokeMyApiKey } from "../../src/server/commands/api-keys";
import { resetRateLimitsForTests } from "../../src/server/rate-limit";
import { readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

function withKey(name = "Claude") {
  const doc = apiDoc();
  const created = createApiKey(doc, doc.users[0]!, { name }, Date.parse("2026-11-02T10:00:00Z"));
  if (!created.ok) throw new Error(created.error);
  return created;
}

const bearer = (token: string) => new NextRequest("http://localhost/api/v1/lists", { headers: { authorization: `Bearer ${token}` } });

test("création : préfixe oys_, gardée hachée, indice des 4 derniers caractères, jeton rendu une seule fois", () => {
  const { doc, token, key } = withKey();
  assert.ok(token.startsWith(API_KEY_PREFIX));
  const stored = doc.apiKeys[0]!;
  assert.notEqual(stored.tokenHash, token);
  assert.ok(!JSON.stringify(doc.apiKeys).includes(token), "le jeton en clair n'est nulle part dans la base");
  assert.equal(key.hint, token.slice(-4));
  assert.deepEqual(listApiKeys(doc, "alex"), [{ id: key.id, name: "Claude", hint: key.hint, createdAt: "2026-11-02T10:00:00.000Z", lastUsedAt: null }]);
  assert.deepEqual(listApiKeys(doc, "camille"), []);
});

test("création refusée : sans nom, nom trop long, plus de 20 clés", () => {
  const doc = apiDoc();
  const alex = doc.users[0]!;
  assert.deepEqual(createApiKey(doc, alex, { name: "  " }), { ok: false, error: "apiKeyNeedsName" });
  assert.deepEqual(createApiKey(doc, alex, { name: "x".repeat(61) }), { ok: false, error: "apiKeyNameTooLong" });
  let current = doc;
  for (let i = 0; i < MAX_API_KEYS; i++) {
    const created = createApiKey(current, alex, { name: `clé ${i}` });
    assert.ok(created.ok);
    if (created.ok) current = created.doc;
  }
  assert.deepEqual(createApiKey(current, alex, { name: "une de trop" }), { ok: false, error: "apiKeyLimit" });
});

test("retrouver une clé : bonne clé → son compte ; autre jeton, clé révoquée ou compte supprimé → rien", () => {
  const { doc, token, key } = withKey();
  assert.equal(findApiKey(doc, token)?.user.id, "alex");
  assert.equal(findApiKey(doc, `${token}x`), null);
  assert.equal(findApiKey(doc, "jeton-de-session"), null);
  assert.deepEqual(revokeApiKey(doc, { userId: "camille", keyId: key.id }), { ok: false, error: "apiKeyMissing" });
  const revoked = revokeApiKey(doc, { userId: "alex", keyId: key.id });
  assert.ok(revoked.ok);
  if (revoked.ok) assert.equal(findApiKey(revoked.doc, token), null);
  const deleted = deleteAccount(doc, { userId: "alex" });
  assert.ok(deleted.ok);
  if (deleted.ok) assert.deepEqual(deleted.doc.apiKeys, []);
});

test("dernière utilisation : notée, puis pas réécrite avant une heure", () => {
  const { doc, key } = withKey();
  const first = touchApiKey(doc, key.id, Date.parse("2026-11-02T10:00:00Z"));
  assert.equal(first?.apiKeys[0]?.lastUsedAt, "2026-11-02T10:00:00.000Z");
  assert.equal(touchApiKey(first!, key.id, Date.parse("2026-11-02T10:59:00Z")), null);
  assert.equal(touchApiKey(first!, key.id, Date.parse("2026-11-02T11:01:00Z"))?.apiKeys[0]?.lastUsedAt, "2026-11-02T11:01:00.000Z");
});

test("API : une clé en bearer donne son compte et note son utilisation ; elle est reconnue comme clé", async () => {
  const { doc, token } = withKey();
  await withStore(doc, async () => {
    resetRateLimitsForTests();
    assert.equal(usesApiKey(bearer(token)), true);
    assert.equal(usesApiKey(bearer("jeton-de-session")), false);
    assert.equal((await optionalApiUser(bearer(token)))?.id, "alex");
    assert.ok((await readDocument()).apiKeys[0]?.lastUsedAt);
    assert.equal(await optionalApiUser(bearer(`${API_KEY_PREFIX}inconnue`)), null);
  });
});

test("API : au-delà de 120 requêtes par minute, la clé est limitée", async () => {
  const { doc, token } = withKey();
  await withStore(doc, async () => {
    resetRateLimitsForTests();
    for (let i = 0; i < 120; i++) await apiKeyUser(token);
    await assert.rejects(() => apiKeyUser(token), (error: Error) => error.message === "rateLimited");
  });
});

test("routes de compte : une clé est refusée (403 apiKeyNotAllowed), un jeton de session passe", async () => {
  const { token } = withKey();
  const api = (bearerToken: string) => ({ req: bearer(bearerToken), locale: "fr" as const, ip: null, cors: null });
  const refused = await refuseApiKey(api(token));
  assert.equal(refused?.status, 403);
  assert.equal(((await refused!.json()) as { error: { code: string } }).error.code, "apiKeyNotAllowed");
  assert.equal(await refuseApiKey(api("jeton-de-session")), null);
});

test("chaque route de compte commence par refuser une clé (mot de passe, suppression, export, déconnexion)", () => {
  for (const [file, handlers] of [
    ["app/api/v1/me/password/route.ts", ["POST"]],
    ["app/api/v1/me/deletion/route.ts", ["GET", "POST"]],
    ["app/api/v1/me/export/route.ts", ["GET"]],
    ["app/api/v1/auth/logout/route.ts", ["POST"]],
  ] as const) {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    for (const method of handlers) {
      const body = source.split(`export const ${method} = withApi(async (api) => {`)[1] ?? "";
      assert.match(body.trimStart(), /^const refused = await refuseApiKey\(api\);\s+if \(refused\) return refused;/, `${method} ${file}`);
    }
  }
});

test("commandes de la page Compte : créer puis révoquer ; un compte ne révoque pas la clé d'un autre", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    resetRateLimitsForTests();
    const created = await createMyApiKey(ctx(doc.users[0]!), { name: "Script" });
    assert.ok(created.ok);
    if (!created.ok) return;
    assert.deepEqual(await revokeMyApiKey(ctx(doc.users[1]!), { keyId: created.key.id }), { ok: false, error: "apiKeyMissing" });
    assert.deepEqual(await revokeMyApiKey(ctx(doc.users[0]!), { keyId: created.key.id }), { ok: true });
    assert.deepEqual((await readDocument()).apiKeys, []);
  });
});
