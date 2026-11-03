import assert from "node:assert/strict";
import { before, test } from "node:test";
import { API_KEY_PREFIX, createApiKey } from "../../src/auth/api-keys";
import { API_KEY_FAILURE_RATE, apiKeyUser } from "../../src/server/api/auth";
import { mcpAccess } from "../../src/server/mcp/gate";
import { apiDoc, ensurePasswordHash, withStore } from "./helpers/api-fixtures";
import { withEnv } from "./helpers/env";

before(ensurePasswordHash);

const IP = "203.0.113.7";
const OTHER_IP = "198.51.100.9";
const unknownKey = (n: number) => `${API_KEY_PREFIX}inconnue-${n}`;
const isRateLimited = (error: Error) => error.message === "rateLimited";

function withKey() {
  const doc = apiDoc();
  const created = createApiKey(doc, doc.users[0]!, { name: "Claude" });
  if (!created.ok) throw new Error(created.error);
  return created;
}

/** Épuise les échecs autorisés de `ip` : chacun reste un simple refus (null). */
async function failUpToLimit(ip: string) {
  for (let i = 0; i < API_KEY_FAILURE_RATE.limit; i++) assert.equal(await apiKeyUser(unknownKey(i), ip), null, `échec ${i + 1}`);
}

test("limite par IP : 20 clés inconnues en 15 minutes, comme les échecs de connexion", () => {
  assert.deepEqual(API_KEY_FAILURE_RATE, { limit: 20, windowMs: 15 * 60 * 1000 });
});

test("clé inconnue : au-delà de la limite, l'IP reçoit rateLimited, même avec une clé valide ; une autre IP non", async () => {
  const { doc, token } = withKey();
  await withStore(doc, async () => {
    await failUpToLimit(IP);
    await assert.rejects(() => apiKeyUser(unknownKey(99), IP), isRateLimited);
    await assert.rejects(() => apiKeyUser(token, IP), isRateLimited, "l'IP bloquée ne teste plus aucune clé");
    assert.equal((await apiKeyUser(token, OTHER_IP))?.id, "alex");
    assert.equal(await apiKeyUser(unknownKey(1), OTHER_IP), null, "les échecs sont comptés par IP");
  });
});

test("seuls les échecs comptent : les requêtes d'une clé valide n'usent pas le budget de l'IP", async () => {
  const { doc, token } = withKey();
  await withStore(doc, async () => {
    for (let i = 0; i < 100; i++) assert.equal((await apiKeyUser(token, IP))?.id, "alex");
    await failUpToLimit(IP);
    await assert.rejects(() => apiKeyUser(unknownKey(99), IP), isRateLimited);
  });
});

test("une clé révoquée compte comme un échec", async () => {
  const { doc, token } = withKey();
  await withStore({ ...doc, apiKeys: [] }, async () => {
    for (let i = 0; i < API_KEY_FAILURE_RATE.limit; i++) assert.equal(await apiKeyUser(token, IP), null);
    await assert.rejects(() => apiKeyUser(token, IP), isRateLimited);
  });
});

test("MCP : unauthorized jusqu'à la limite, puis rateLimited pour cette IP", async () => {
  const { doc, token } = withKey();
  const access = (authorization: string, ip: string) =>
    mcpAccess({ origin: null, siteOrigin: "https://ohyoushouldnt.example.test", authorization: `Bearer ${authorization}`, ip });
  await withStore(doc, async () => {
    for (let i = 0; i < API_KEY_FAILURE_RATE.limit; i++) {
      assert.deepEqual(await access(unknownKey(i), IP), { ok: false, error: "unauthorized" });
    }
    assert.deepEqual(await access(unknownKey(99), IP), { ok: false, error: "rateLimited" });
    assert.deepEqual(await access(token, IP), { ok: false, error: "rateLimited" });
    const other = await access(token, OTHER_IP);
    assert.equal(other.ok && other.user.id, "alex");
  });
});

test("sans IP de confiance : en production un échec est refusé, une clé valide passe", async () => {
  const { doc, token } = withKey();
  await withStore(doc, async () => {
    await withEnv({ NODE_ENV: "production" }, async () => {
      await assert.rejects(() => apiKeyUser(unknownKey(1), null), isRateLimited);
      assert.equal((await apiKeyUser(token, null))?.id, "alex");
    });
    await withEnv({ NODE_ENV: "test" }, async () => {
      assert.equal(await apiKeyUser(unknownKey(1), null), null, "en dev, pas de limite sans IP");
    });
  });
});
