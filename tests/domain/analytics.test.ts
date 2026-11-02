import assert from "node:assert/strict";
import test from "node:test";
import { analyticsBeforeSendSource, analyticsCollectAllowed } from "../../src/site/analytics-public";
import { analyticsConfig, analyticsUpstreamHeaders, prepareAnalyticsEvent } from "../../src/server/analytics";

const ID = "11111111-2222-4333-8444-555555555555";

test("sans les deux variables, la mesure est absente", () => {
  assert.equal(analyticsConfig({}), null);
  assert.equal(analyticsConfig({ UMAMI_WEBSITE_ID: ID }), null);
  assert.equal(analyticsConfig({ UMAMI_URL: "http://analytics.internal" }), null);
  assert.equal(analyticsConfig({ UMAMI_WEBSITE_ID: "pas-un-uuid", UMAMI_URL: "http://analytics.internal" }), null);
  assert.equal(
    analyticsConfig({ UMAMI_WEBSITE_ID: ID, UMAMI_URL: "http://user:secret@analytics.internal" }),
    null,
  );
});

test("l'origine seule est conservée, pas le chemin ni l'identifiant en dur", () => {
  const config = analyticsConfig({
    UMAMI_WEBSITE_ID: ID,
    UMAMI_URL: "https://analytics.example/ignored",
  });
  assert.deepEqual(config, { websiteId: ID, upstream: "https://analytics.example" });
});

test("les adresses de liste, de compte et d'invitation ne partent pas", () => {
  assert.equal(analyticsCollectAllowed("/"), true);
  assert.equal(analyticsCollectAllowed("/en/faq"), true);
  assert.equal(analyticsCollectAllowed("/l/secret"), false);
  assert.equal(analyticsCollectAllowed("/en/l/secret"), false);
  assert.equal(analyticsCollectAllowed("/inviter/secret"), false);
  assert.equal(analyticsCollectAllowed("/en/reinitialiser/secret"), false);
  assert.equal(analyticsCollectAllowed("/confirmer-email/secret?suite=%2Finviter%2Fx"), false);
  assert.equal(analyticsCollectAllowed("/en/confirmer-email/secret"), false);
  assert.equal(analyticsCollectAllowed("/listes/abc"), false);
  assert.equal(analyticsCollectAllowed("/connexion"), false);
  assert.equal(analyticsCollectAllowed("/u/script.js"), false);
});

test("le script de filtre ne contient pas d'identifiant d'instance", () => {
  const source = analyticsBeforeSendSource();
  assert.match(source, /wishlist-analytics-optout/);
  assert.match(source, /\/reinitialiser/);
  assert.match(source, /\/confirmer-email/);
  assert.doesNotMatch(source, /UMAMI_URL|website-id|analytics\.example/);
});

test("le serveur n'envoie pas une liste et impose le site configuré", () => {
  const page = JSON.stringify({
    type: "event",
    payload: {
      website: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      hostname: "evil.example",
      url: "https://ohyoushouldnt.app/faq?next=/l/secret",
      title: "FAQ",
      referrer: "https://ohyoushouldnt.app/l/secret",
      screen: "800x600",
      language: "fr",
    },
  });
  const clean = prepareAnalyticsEvent(page, ID, "ohyoushouldnt.app");
  assert.equal(typeof clean, "string");
  const body = JSON.parse(clean as string) as { payload: Record<string, string> };
  assert.equal(body.payload.website, ID);
  assert.equal(body.payload.hostname, "ohyoushouldnt.app");
  assert.equal(body.payload.url, "/faq");
  assert.equal(body.payload.referrer, "");
  assert.equal(prepareAnalyticsEvent(JSON.stringify({ type: "event", payload: { url: "/l/secret" } }), ID, "h"), "drop");
  assert.equal(prepareAnalyticsEvent("{", ID, "h"), "invalid");
});

test("l'adresse IP et le cookie ne sont pas relayés", () => {
  const headers = analyticsUpstreamHeaders(
    {
      get(name: string) {
        if (name === "content-type") return "application/json";
        if (name === "cookie") return "wishlist_session=secret";
        if (name === "x-forwarded-for") return "203.0.113.5";
        return null;
      },
    },
    ID,
  );
  assert.equal(headers.get("x-umami-website-id"), ID);
  assert.equal(headers.get("x-forwarded-for"), "0.0.0.0");
  assert.equal(headers.get("cookie"), null);
  assert.equal(headers.get("content-type"), "application/json");
});
