import assert from "node:assert/strict";
import { test } from "node:test";
import { isSiteLink } from "../../src/site/dev-link";

const ORIGIN = "http://localhost:3010";

test("lien de dev : seulement une page de ce site, du bon type", () => {
  assert.equal(isSiteLink(`${ORIGIN}/confirmer-email/abc?suite=%2F`, ORIGIN, "/confirmer-email/"), true);
  assert.equal(isSiteLink(`${ORIGIN}/en/confirmer-email/abc`, ORIGIN, "/confirmer-email/"), true);
  assert.equal(isSiteLink(`${ORIGIN}/reinitialiser/abc`, ORIGIN, "/reinitialiser/"), true);
  for (const url of [
    "https://evil.example/confirmer-email/abc",
    `${ORIGIN}.evil.example/confirmer-email/abc`,
    `${ORIGIN}/compte`,
    `${ORIGIN}/reinitialiser/abc`,
    "javascript:alert(1)",
    "pas une url",
    "",
    null,
    undefined,
  ]) {
    assert.equal(isSiteLink(url, ORIGIN, "/confirmer-email/"), false, String(url));
  }
});
