import assert from "node:assert/strict";
import { test } from "node:test";
import { phonePlatform } from "../../src/site/device";
import { appStoreUrl, playStoreUrl } from "../../src/site/links";
import { withEnv } from "./helpers/env";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36",
};

test("téléphone : iPhone (Safari ou Chrome) → ios, Android avec Mobile → android", () => {
  assert.equal(phonePlatform(UA.iphoneSafari), "ios");
  assert.equal(phonePlatform(UA.iphoneChrome), "ios");
  assert.equal(phonePlatform(UA.androidPhone), "android");
  assert.equal(phonePlatform(UA.androidTablet, true), "android");
});

test("pas un téléphone : tablette Android, iPad (vu comme un Mac), ordinateurs", () => {
  for (const ua of [UA.androidTablet, UA.ipad, UA.mac, UA.windows, UA.linux, ""]) {
    assert.equal(phonePlatform(ua), null, ua);
    assert.equal(phonePlatform(ua, false), null, ua);
  }
  assert.equal(phonePlatform(UA.mac, true), null);
});

test("adresses des stores : https seulement, sinon pas de badge", async () => {
  await withEnv({ APP_STORE_URL: undefined, PLAY_STORE_URL: "  " }, () => {
    assert.equal(appStoreUrl(), null);
    assert.equal(playStoreUrl(), null);
  });
  await withEnv({ APP_STORE_URL: "http://apps.apple.com/app/id1" }, () => assert.equal(appStoreUrl(), null));
  await withEnv(
    {
      APP_STORE_URL: " https://apps.apple.com/app/id6829423495 ",
      PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=app.ohyoushouldnt.mobile",
    },
    () => {
      assert.equal(appStoreUrl(), "https://apps.apple.com/app/id6829423495");
      assert.equal(playStoreUrl(), "https://play.google.com/store/apps/details?id=app.ohyoushouldnt.mobile");
    },
  );
});
