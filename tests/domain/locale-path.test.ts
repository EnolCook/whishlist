import assert from "node:assert/strict";
import { test } from "node:test";
import { decideLocaleRoute, internalPath, stripLocalePrefix, withLocale } from "../../src/i18n/locale-path";

test("withLocale ne double pas le préfixe", () => {
  assert.equal(withLocale("fr", "/faq"), "/faq");
  assert.equal(withLocale("en", "/faq"), "/en/faq");
  assert.equal(withLocale("en", "/"), "/en");
  assert.equal(withLocale("en", "/en/faq"), "/en/faq");
  assert.equal(withLocale("fr", "/en/faq"), "/faq");
  assert.equal(withLocale("fr", "/fr/guide"), "/guide");
  assert.equal(withLocale("en", "/l/demo?qui=1#idee"), "/en/l/demo?qui=1#idee");
  assert.deepEqual(stripLocalePrefix("/en/l/demo"), { locale: "en", path: "/l/demo" });
});

test("?lang= mène à l'adresse canonique et garde les autres paramètres", () => {
  assert.deepEqual(decideLocaleRoute({ pathname: "/faq", search: "?lang=en&x=1", nextUrl: null }), {
    type: "redirect",
    status: 301,
    pathname: "/en/faq",
    search: "?x=1",
    locale: "en",
  });
  assert.deepEqual(decideLocaleRoute({ pathname: "/en/faq", search: "?lang=fr", nextUrl: null }), {
    type: "redirect",
    status: 301,
    pathname: "/faq",
    search: "",
    locale: "fr",
  });
});

test("/fr redirige vers le français sans préfixe, /en est réécrit", () => {
  const frenchPrefix = decideLocaleRoute({ pathname: "/fr/guide", search: "", nextUrl: null });
  assert.equal(frenchPrefix.type, "redirect");
  if (frenchPrefix.type === "redirect") assert.equal(frenchPrefix.pathname, "/guide");
  assert.deepEqual(decideLocaleRoute({ pathname: "/en/guide", search: "?x=1", nextUrl: null }), {
    type: "rewrite",
    pathname: "/guide",
    search: "?x=1",
    locale: "en",
  });
  assert.deepEqual(decideLocaleRoute({ pathname: "/en", search: "", nextUrl: null }), {
    type: "rewrite",
    pathname: "/",
    search: "",
    locale: "en",
  });
});

test("une navigation depuis /en garde le préfixe, une adresse française reste française", () => {
  assert.deepEqual(decideLocaleRoute({ pathname: "/guide", search: "", nextUrl: "/en/faq" }), {
    type: "redirect",
    status: 307,
    pathname: "/en/guide",
    search: "",
    locale: "en",
  });
  assert.deepEqual(decideLocaleRoute({ pathname: "/faq", search: "", nextUrl: null }), {
    type: "continue",
    locale: "fr",
  });
  assert.equal(decideLocaleRoute({ pathname: "/faq", search: "", nextUrl: "https://evil.example/en" }).type, "continue");
});

test("internalPath : un chemin du site seulement, jamais une autre origine", () => {
  assert.equal(internalPath("/inviter/abc?x=1"), "/inviter/abc?x=1");
  assert.equal(internalPath("/"), "/");
  for (const value of ["//ailleurs.example", "/\\ailleurs.example", "https://ailleurs.example", "inviter", "", null, 3]) {
    assert.equal(internalPath(value), null, String(value));
  }
});
