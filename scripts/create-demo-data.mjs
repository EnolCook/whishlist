import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const outputArg = process.argv[2];
if (!outputArg) {
  console.error("Usage: npm run demo:data -- <chemin, comme WISHLIST_DATA_PATH>");
  process.exit(1);
}

const output = path.resolve(outputArg);
const runtime = await import(pathToFileURL(path.resolve("src/domain/users.ts")).href);
const { registerUser } = runtime;
const { createWishlist, importTemplate } = await import(
  pathToFileURL(path.resolve("src/domain/import.ts")).href
);
const { emptyDatabase } = await import(pathToFileURL(path.resolve("src/domain/types.ts")).href);
const { DEFAULT_WISHLIST_THEME } = await import(
  pathToFileURL(path.resolve("src/domain/theme.ts")).href
);

const seed = JSON.parse(await readFile(path.resolve("data/demo-seed.json"), "utf8"));
const now = new Date("2026-10-21T08:00:00.000Z");
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 10) {
  console.error("DEMO_PASSWORD is required (at least 10 characters).");
  process.exit(1);
}

let doc = emptyDatabase();
const owner = await registerUser(doc, {
  id: "demo-owner",
  email: "alex@example.test",
  password,
  displayName: "Alex",
  now,
});
if (!owner.ok) throw new Error(owner.error);
doc = owner.doc;

const member = await registerUser(doc, {
  id: "demo-member",
  email: "camille@example.test",
  password,
  displayName: "Camille",
  now,
});
if (!member.ok) throw new Error(member.error);
doc = member.doc;

const created = createWishlist(doc, {
  ownerId: owner.value.id,
  title: "Nos envies toute l’année",
  importTemplate: false,
  id: "demo-list",
  now,
});
if (!created.ok) throw new Error(created.error);
doc = importTemplate(created.doc, created.wishlist.id, seed);

const list = doc.wishlists.find((candidate) => candidate.id === created.wishlist.id);
if (!list) throw new Error("demo list missing");
list.subtitle = "Des petites envies, de beaux cadeaux et quelques idées à partager.";
list.readToken = "demo-list-lecture";
list.inviteToken = "demo-list-invitation";
list.theme = {
  ...DEFAULT_WISHLIST_THEME,
  primary: "#335cff",
  accent: "#ff4d3d",
  highlight: "#ffd23f",
  background: "#f3f5ff",
};

doc.memberships.push({
  wishlistId: list.id,
  userId: member.value.id,
  role: "member",
  joinedAt: "2026-10-21T08:05:00.000Z",
});

doc.reservations.push({
  id: "demo-reservation",
  wishlistId: list.id,
  itemId: `${list.id}:jeu`,
  fromName: "Morgan",
  note: "Je m’en occupe !",
  userId: null,
  createdAt: "2026-10-21T09:00:00.000Z",
});

// La base `.db` à côté du chemin donné (même règle que WISHLIST_DATA_PATH), remplacée en une transaction :
// un serveur qui tourne sur cette base voit la nouvelle démo à la requête suivante.
process.env.WISHLIST_DATA_PATH = output;
const store = await import(pathToFileURL(path.resolve("src/store/db.ts")).href);
await store.replaceDocument(doc);
store.closeStore(output);
console.log(`Demo database written to ${store.databaseFilePath(output)}`);
console.log("Owner: alex@example.test");
console.log("Member: camille@example.test");
console.log(`Password: ${password}`);
console.log("Public list: /l/demo-list-lecture");
