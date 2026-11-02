import { redirectSystemPath } from "../../app/+native-intent";

// Le build de test vise https://api.example.test (__tests__/setup.ts).
describe("réception d'un lien (011)", () => {
  it("lien web du serveur de ce build, lien au schéma : écran de l'app", () => {
    expect(redirectSystemPath({ path: "https://api.example.test/en/reinitialiser/tok", initial: true })).toBe(
      "/links/reset-password/tok",
    );
    expect(redirectSystemPath({ path: "ohyoushouldnt://inviter/tok", initial: false })).toBe("/links/invite/tok");
    expect(redirectSystemPath({ path: "/l/read/reserver?itemId=i1", initial: false })).toBe(
      "/guest/read/reserve?itemId=i1",
    );
  });

  it("adresse inconnue, d'un autre serveur ou mal formée : l'accueil, sans lever", () => {
    for (const path of [
      "ohyoushouldnt://guide",
      "https://evil.example/inviter/tok",
      "ohyoushouldnt://inviter/%E0%A4%A",
      "",
    ]) {
      expect(redirectSystemPath({ path, initial: true })).toBe("/");
    }
  });
});
