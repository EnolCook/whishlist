import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_LINK_ROUTES,
  androidAssociation,
  androidPathPrefixes,
  appleAssociation,
  appPathForSiteUrl,
} from "../../src/site/app-links";
import { androidAssociationResponse, appleAssociationResponse } from "../../src/site/app-links-config";
import { withEnv } from "./helpers/env";

const HOST = "ohyoushouldnt.app";
const to = (url: string) => appPathForSiteUrl(url, { apiHost: HOST });
const FINGERPRINT = Array.from({ length: 32 }, () => "AB").join(":");

test("chaque lien de la table ouvre son écran, en français comme sous /en", () => {
  const cases: [string, string][] = [
    ["/confirmer-email/tok", "/links/confirm-email/tok"],
    ["/reinitialiser/tok", "/links/reset-password/tok"],
    ["/inviter/tok", "/links/invite/tok"],
    ["/connexion", "/login"],
    ["/inscription", "/register"],
    ["/l/read", "/guest/read"],
    ["/l/read/reserver", "/guest/read/reserve"],
    ["/l/read/types", "/guest/read"],
  ];
  assert.equal(cases.length >= APP_LINK_ROUTES.length, true);
  for (const [site, app] of cases) {
    assert.equal(to(`https://${HOST}${site}`), app, site);
    assert.equal(to(`https://${HOST}/en${site}`), app, `/en${site}`);
  }
});

test("trois formes d'adresse : web, schéma de l'app, chemin seul", () => {
  assert.equal(to(`https://${HOST}/reinitialiser/tok`), "/links/reset-password/tok");
  assert.equal(to("ohyoushouldnt://reinitialiser/tok"), "/links/reset-password/tok");
  assert.equal(to("ohyoushouldnt:///reinitialiser/tok"), "/links/reset-password/tok");
  assert.equal(to("/reinitialiser/tok"), "/links/reset-password/tok");
  assert.equal(to(`http://localhost:3010/reinitialiser/tok`), null);
  assert.equal(
    appPathForSiteUrl("http://localhost:3010/reinitialiser/tok", { apiHost: "localhost:3010" }),
    "/links/reset-password/tok",
  );
  assert.equal(to(`https://${HOST}/reinitialiser/tok/`), "/links/reset-password/tok");
});

test("requête : seules les clés prévues passent, encodées", () => {
  assert.equal(
    to(`https://${HOST}/confirmer-email/tok?suite=%2Finviter%2Fabc&utm=x`),
    "/links/confirm-email/tok?suite=%2Finviter%2Fabc",
  );
  assert.equal(to(`https://${HOST}/l/read/reserver?itemId=i1&typeId=t1#x`), "/guest/read/reserve?itemId=i1&typeId=t1");
  assert.equal(to(`https://${HOST}/connexion?next=%2Finviter%2Fabc`), "/login?next=%2Finviter%2Fabc");
  assert.equal(to(`https://${HOST}/inviter/tok?foo=bar`), "/links/invite/tok");
  assert.equal(to(`https://${HOST}/l/read?typeId=`), "/guest/read");
});

test("adresses que l'app ne traite pas : null", () => {
  for (const url of [
    `https://${HOST}/`,
    `https://${HOST}/en`,
    `https://${HOST}/guide`,
    `https://${HOST}/compte/export`,
    `https://${HOST}/api/v1/me`,
    // Ouvertes exprès dans le navigateur depuis l'app (« Gérer le partage sur le site »).
    `https://${HOST}/listes/abc?onglet=partage`,
    `https://${HOST}/inviter/`,
    `https://${HOST}/inviter//x`,
    `https://${HOST}/inviter/a%2Fb`,
    `https://${HOST}/inviter/%E0%A4%A`,
    `https://${HOST}/l/read/autre`,
    `https://evil.example/inviter/tok`,
    `https://${HOST}.evil.example/inviter/tok`,
    "//evil.example/inviter/tok",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(to(url), null, url);
  }
});

test("un jeton est décodé puis réencodé une fois", () => {
  assert.equal(to(`https://${HOST}/inviter/a%20b`), "/links/invite/a%20b");
  assert.equal(to(`https://${HOST}/inviter/a-b_c`), "/links/invite/a-b_c");
});

test("fichier Apple : l'app publiée et chaque chemin, avec et sans /en", () => {
  const detail = appleAssociation("ABCDE12345").applinks.details[0]!;
  assert.deepEqual(detail.appIDs, ["ABCDE12345.app.ohyoushouldnt.mobile"]);
  const paths = detail.components.map((component) => component["/"]);
  for (const path of ["/confirmer-email/*", "/en/confirmer-email/*", "/l/*/reserver", "/connexion"]) {
    assert.equal(paths.includes(path), true, path);
  }
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.some((path) => path.startsWith("/guide") || path.startsWith("/listes") || path === "/"), false);
});

test("fichier Android : empreintes mal formées ignorées, préfixes de la table", () => {
  const [entry] = androidAssociation([FINGERPRINT.toLowerCase(), "pas-une-empreinte", " "]);
  assert.equal(entry!.target.package_name, "app.ohyoushouldnt.mobile");
  assert.deepEqual(entry!.target.sha256_cert_fingerprints, [FINGERPRINT]);
  const prefixes = androidPathPrefixes();
  for (const prefix of ["/confirmer-email/", "/en/confirmer-email/", "/l/", "/connexion", "/en/inscription"]) {
    assert.equal(prefixes.includes(prefix), true, prefix);
  }
  assert.equal(new Set(prefixes).size, prefixes.length);
  assert.equal(prefixes.some((prefix) => prefix.includes("/listes")), false);
});

function assertJsonHeaders(response: Response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
}

test("GET /.well-known/apple-app-site-association : 404 sans APPLE_TEAM_ID, JSON sinon", async () => {
  await withEnv({ APPLE_TEAM_ID: undefined }, () => assert.equal(appleAssociationResponse().status, 404));
  await withEnv({ APPLE_TEAM_ID: "trop-court" }, () => assert.equal(appleAssociationResponse().status, 404));
  await withEnv({ APPLE_TEAM_ID: "abcde12345" }, async () => {
    const response = appleAssociationResponse();
    assertJsonHeaders(response);
    const body = await response.json();
    assert.deepEqual(body.applinks.details[0].appIDs, ["ABCDE12345.app.ohyoushouldnt.mobile"]);
  });
});

test("GET /.well-known/assetlinks.json : 404 sans empreinte valide, JSON sinon", async () => {
  await withEnv({ ANDROID_CERT_SHA256: undefined }, () => assert.equal(androidAssociationResponse().status, 404));
  await withEnv({ ANDROID_CERT_SHA256: "nimporte-quoi" }, () => assert.equal(androidAssociationResponse().status, 404));
  await withEnv({ ANDROID_CERT_SHA256: `${FINGERPRINT}, ${FINGERPRINT.replace(/^AB/, "CD")}` }, async () => {
    const response = androidAssociationResponse();
    assertJsonHeaders(response);
    const body = await response.json();
    assert.equal(body[0].target.sha256_cert_fingerprints.length, 2);
  });
});
