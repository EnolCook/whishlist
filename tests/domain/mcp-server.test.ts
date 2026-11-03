import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { User } from "../../src/domain/types";
import { createApiKey } from "../../src/auth/api-keys";
import { revokeApiKey } from "../../src/domain/api-keys";
import { mcpAccess } from "../../src/server/mcp/gate";
import { buildMcpServer } from "../../src/server/mcp/server";
import { readDocument } from "../../src/store/db";
import { apiDoc, apiDocWithSecondList, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

before(ensurePasswordHash);

type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };

/** Un appel JSON-RPC comme le ferait un assistant (transport HTTP sans état). */
function client(user: User) {
  const handler = createMcpHandler(() => buildMcpServer(ctx(user)));
  async function rpc(method: string, params: unknown): Promise<{ result?: unknown; error?: { message: string } }> {
    const res = await handler.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
    );
    const text = await res.text();
    const data = text.split("\n").find((line) => line.startsWith("data: "));
    return JSON.parse(data ? data.slice(6) : text);
  }
  return {
    listed: async () => ((await rpc("tools/list", {})).result as { tools: { name: string; annotations?: Record<string, boolean> }[] }).tools,
    tools: async () => ((await rpc("tools/list", {})).result as { tools: { name: string }[] }).tools.map((tool) => tool.name),
    call: async (name: string, args: Record<string, unknown>) => (await rpc("tools/call", { name, arguments: args })).result as ToolResult,
  };
}

const json = (result: ToolResult) => JSON.parse(result.content[0]!.text);

test("outils proposés : listes, idées, catégories et « qui », remplir depuis un lien ; rien pour le compte", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const tools = await client(doc.users[0]!).tools();
    assert.deepEqual(tools.sort(), [
      "add_category",
      "add_idea",
      "add_person",
      "archive_idea",
      "copy_idea",
      "create_list",
      "delete_category",
      "delete_idea",
      "delete_list",
      "delete_person",
      "fill_from_url",
      "get_list",
      "list_lists",
      "move_idea",
      "rename_category",
      "rename_list",
      "rename_person",
      "update_idea",
    ]);
  });
});

test("annotations : seuls les outils delete_* se disent destructifs ; les lectures se disent sans écriture", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    for (const tool of await client(doc.users[0]!).listed()) {
      const reads = ["list_lists", "get_list", "fill_from_url"].includes(tool.name);
      assert.equal(tool.annotations?.readOnlyHint, reads, tool.name);
      if (!reads) assert.equal(tool.annotations?.destructiveHint, tool.name.startsWith("delete_"), tool.name);
    }
  });
});

test("list_lists et get_list : les listes du compte ; une idée dit si elle est réservée, jamais par qui ni le mot", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    assert.deepEqual(json(await alex.call("list_lists", {})), [{ id: "w", title: "Liste d'Alex", role: "owner", ideas: 2 }]);
    const list = json(await alex.call("get_list", { listId: "w", includeArchived: true }));
    const taken = list.ideas.find((idea: { id: string }) => idea.id === "taken");
    assert.equal(taken.reserved, true);
    const raw = JSON.stringify(list);
    assert.ok(!raw.includes("Sam") && !raw.includes("anniversaire"), "ni le nom ni le mot de la réservation");
    assert.equal(json(await alex.call("get_list", { listId: "w" })).ideas.some((idea: { id: string }) => idea.id === "taken"), false);
  });
});

test("get_list d'une liste dont on n'est pas membre : refus traduit, comme l'API", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const result = await client(doc.users[1]!).call("get_list", { listId: "w" });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /listMissing/);
  });
});

test("add_idea : catégorie et « qui » par leur nom (casse ignorée), sinon les premiers ; nom inconnu → la liste des noms", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    const added = json(await alex.call("add_idea", { listId: "w", name: "Puzzle", category: "jeux", for: "ALEX", price: "24.90", priority: 4 }));
    assert.deepEqual(added.added, { id: added.added.id, name: "Puzzle", category: "Jeux", for: "Alex" });
    const item = (await readDocument()).items.find((entry) => entry.id === added.added.id)!;
    assert.deepEqual({ priceCents: item.priceCents, priority: item.priority }, { priceCents: 2490, priority: "4" });
    const numeric = json(await alex.call("add_idea", { listId: "w", name: "Mug", price: 12.5 }));
    assert.equal((await readDocument()).items.find((entry) => entry.id === numeric.added.id)?.priceCents, 1250, "un prix envoyé en nombre est accepté");
    const unknown = await alex.call("add_idea", { listId: "w", name: "Lampe", category: "Maison" });
    assert.equal(unknown.isError, true);
    assert.match(unknown.content[0]!.text, /Unknown category "Maison"\. The list's categories: Jeux\./);
  });
});

test("update_idea : seuls les champs donnés changent ; priority 0 retire les étoiles", async () => {
  const doc = apiDoc();
  doc.items.find((item) => item.id === "gift")!.priority = "3";
  doc.items.find((item) => item.id === "gift")!.url = "https://shop.example.test/a";
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    await alex.call("update_idea", { listId: "w", ideaId: "gift", name: "Idée renommée" });
    let item = (await readDocument()).items.find((entry) => entry.id === "gift")!;
    assert.deepEqual({ name: item.name, priority: item.priority, url: item.url, priceCents: item.priceCents }, { name: "Idée renommée", priority: "3", url: "https://shop.example.test/a", priceCents: 1990 });
    await alex.call("update_idea", { listId: "w", ideaId: "gift", priority: 0 });
    item = (await readDocument()).items.find((entry) => entry.id === "gift")!;
    assert.equal(item.priority, null);
    assert.equal((await alex.call("update_idea", { listId: "w", ideaId: "absente", name: "x" })).isError, true);
  });
});

test("description et « occasion acceptée » : lues par get_list, posées par add_idea, gardées ou changées par update_idea", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    const added = json(await alex.call("add_idea", { listId: "w", name: "Vélo", description: "  Taille M.  ", secondHandOk: true })).added;
    const shown = () => alex.call("get_list", { listId: "w" }).then((result) => json(result).ideas.find((idea: { id: string }) => idea.id === added.id));
    assert.deepEqual(await shown().then(({ description, secondHandOk }) => ({ description, secondHandOk })), { description: "Taille M.", secondHandOk: true });
    await alex.call("update_idea", { listId: "w", ideaId: added.id, name: "Vélo de ville" });
    assert.deepEqual(await shown().then(({ description, secondHandOk }) => ({ description, secondHandOk })), { description: "Taille M.", secondHandOk: true });
    await alex.call("update_idea", { listId: "w", ideaId: added.id, description: "", secondHandOk: false });
    assert.deepEqual(await shown().then(({ description, secondHandOk }) => ({ description, secondHandOk })), { description: null, secondHandOk: false });
    const plain = json(await alex.call("add_idea", { listId: "w", name: "Livre" })).added;
    const item = (await readDocument()).items.find((entry) => entry.id === plain.id)!;
    assert.deepEqual({ description: item.description, secondHandOk: item.secondHandOk }, { description: null, secondHandOk: false });
    const tooLong = await alex.call("add_idea", { listId: "w", name: "Long", description: "x".repeat(2001) });
    assert.equal(tooLong.isError, true);
    assert.match(tooLong.content[0]!.text, /descriptionTooLong/);
  });
});

test("archive_idea, add_category, add_person : mêmes règles que le site (un doublon de nom est refusé par la règle)", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    assert.deepEqual(json(await alex.call("archive_idea", { listId: "w", ideaId: "gift" })), { id: "gift", name: "Idée gift", archived: true });
    assert.equal(json(await alex.call("archive_idea", { listId: "w", ideaId: "gift", archived: false })).archived, false);
    assert.equal(json(await alex.call("add_category", { listId: "w", name: "Livres" })).added.label, "Livres");
    assert.equal(json(await alex.call("add_person", { listId: "w", name: "Lou" })).added.label, "Lou");
    const types = (await readDocument()).types.filter((type) => type.wishlistId === "w").map((type) => type.label);
    assert.deepEqual(types.sort(), ["Jeux", "Livres"]);
  });
});

test("delete_idea : supprime ; une idée réservée est refusée, comme sur le site", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    assert.deepEqual(json(await alex.call("delete_idea", { listId: "w", ideaId: "gift" })), { deleted: { id: "gift", name: "Idée gift" } });
    const reserved = await alex.call("delete_idea", { listId: "w", ideaId: "taken" });
    assert.equal(reserved.isError, true);
    assert.match(reserved.content[0]!.text, /itemHasReservation/);
    assert.deepEqual((await readDocument()).items.map((item) => item.id).sort(), ["gift2", "taken"]);
    assert.match((await client(doc.users[1]!).call("delete_idea", { listId: "w", ideaId: "gift2" })).content[0]!.text, /listMissing/);
  });
});

/** Alex devient membre de la liste de Camille, qui a aussi une catégorie « jeux ». */
function transferDoc() {
  const doc = apiDocWithSecondList();
  doc.memberships.push({ wishlistId: "w-camille", userId: "alex", role: "member", joinedAt: "2026-01-06T00:00:00.000Z" });
  doc.types.push({ id: "t-camille-jeux", wishlistId: "w-camille", label: "jeux", sortOrder: 1 });
  return doc;
}

test("move_idea : catégorie de même nom, sinon la première ; « qui » donné par nom ; nom inconnu → la liste des noms", async () => {
  const doc = transferDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    assert.deepEqual(json(await alex.call("move_idea", { listId: "w", ideaId: "gift", targetListId: "w-camille" })), {
      moved: { id: "gift", name: "Idée gift", list: "Les idées de Camille", category: "jeux", for: "Camille" },
    });
    const moved = (await readDocument()).items.find((item) => item.id === "gift")!;
    assert.deepEqual([moved.wishlistId, moved.typeId, moved.personId], ["w-camille", "t-camille-jeux", "p-camille"]);
    const named = json(await alex.call("move_idea", { listId: "w", ideaId: "gift2", targetListId: "w-camille", category: "LIVRES", for: "camille" }));
    assert.equal(named.moved.category, "Livres");
    const unknown = await alex.call("move_idea", { listId: "w-camille", ideaId: "gift", targetListId: "w", category: "Maison" });
    assert.match(unknown.content[0]!.text, /Unknown category "Maison"\. The list's categories: Jeux\./);
  });
});

test("move_idea : une idée réservée ne part pas ; il faut être membre des deux listes", async () => {
  const doc = transferDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    assert.match((await alex.call("move_idea", { listId: "w", ideaId: "taken", targetListId: "w-camille" })).content[0]!.text, /itemReservedCannotMove/);
    const camille = client(doc.users[1]!);
    assert.match((await camille.call("move_idea", { listId: "w", ideaId: "gift", targetListId: "w-camille" })).content[0]!.text, /listMissing/);
    assert.match((await camille.call("move_idea", { listId: "w-camille", ideaId: "camille-book", targetListId: "w" })).content[0]!.text, /listMissing/);
    const items = (await readDocument()).items;
    assert.deepEqual(["gift", "taken"].map((id) => items.find((item) => item.id === id)!.wishlistId), ["w", "w"]);
  });
});

test("copy_idea : copie sans réservation ni archivage, vers une autre liste ou la même ; non-membre refusé", async () => {
  const doc = transferDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    const copied = json(await alex.call("copy_idea", { listId: "w", ideaId: "taken", targetListId: "w-camille" })).copied;
    assert.deepEqual({ ...copied, id: undefined }, { id: undefined, name: "Idée taken", list: "Les idées de Camille", category: "jeux", for: "Camille" });
    const after = await readDocument();
    const copy = after.items.find((item) => item.id === copied.id)!;
    assert.deepEqual([copy.wishlistId, copy.archived, copy.priceCents], ["w-camille", false, 1990]);
    assert.equal(after.reservations.some((reservation) => reservation.itemId === copied.id), false);
    assert.equal(after.items.find((item) => item.id === "taken")!.wishlistId, "w", "l'original reste");
    const same = json(await alex.call("copy_idea", { listId: "w", ideaId: "gift", targetListId: "w" })).copied;
    assert.deepEqual([same.list, same.category, same.for], ["Liste d'Alex", "Jeux", "Alex"]);
    assert.match((await client(doc.users[1]!).call("copy_idea", { listId: "w", ideaId: "gift", targetListId: "w-camille" })).content[0]!.text, /listMissing/);
  });
});

test("rename_* et delete_* : catégorie et « qui » par leur nom ; un libellé encore utilisé n'est pas retiré", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    assert.deepEqual(json(await alex.call("rename_category", { listId: "w", current: "jeux", name: "Jeux de société" })), {
      renamed: { from: "Jeux", to: "Jeux de société" },
    });
    assert.match((await alex.call("delete_category", { listId: "w", name: "Jeux de société" })).content[0]!.text, /typeInUse/);
    assert.match((await alex.call("delete_person", { listId: "w", name: "Alex" })).content[0]!.text, /personInUse/);
    await alex.call("add_person", { listId: "w", name: "Lou" });
    assert.equal(json(await alex.call("rename_person", { listId: "w", current: "Lou", name: "Louise" })).renamed.to, "Louise");
    assert.deepEqual(json(await alex.call("delete_person", { listId: "w", name: "louise" })), { deleted: "Louise" });
    const unknown = await alex.call("rename_person", { listId: "w", current: "Max", name: "x" });
    assert.match(unknown.content[0]!.text, /Unknown person "Max"\. The list's people: Alex\./);
    const after = await readDocument();
    assert.deepEqual([after.types.map((type) => type.label), after.people.map((person) => person.label)], [["Jeux de société"], ["Alex"]]);
  });
});

test("create_list, rename_list, delete_list : seul le propriétaire supprime ; un non-membre ne voit pas la liste", async () => {
  const doc = apiDoc();
  doc.memberships.push({ wishlistId: "w", userId: "camille", role: "member", joinedAt: "2026-01-01T00:00:00.000Z" });
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    const created = json(await alex.call("create_list", { title: "Noël", category: "Livres", for: "Alex" })).created;
    assert.equal(created.title, "Noël");
    assert.deepEqual(json(await alex.call("rename_list", { listId: created.id, title: "Noël 2026" })).renamed, { id: created.id, title: "Noël 2026" });
    const camille = client(doc.users[1]!);
    assert.match((await camille.call("delete_list", { listId: "w" })).content[0]!.text, /ownerDeleteList/);
    assert.match((await camille.call("delete_list", { listId: created.id })).content[0]!.text, /listMissing/);
    assert.deepEqual(json(await alex.call("delete_list", { listId: "w" })), { deleted: { id: "w", title: "Liste d'Alex" } });
    const after = await readDocument();
    assert.deepEqual(after.wishlists.map((list) => list.title), ["Noël 2026"]);
    assert.equal(after.items.some((item) => item.wishlistId === "w"), false);
  });
});

test("accès au serveur : une clé valide seulement ; ni jeton de session, ni clé révoquée, ni page d'un autre site", async () => {
  const doc = apiDoc();
  const created = createApiKey(doc, doc.users[0]!, { name: "Claude" });
  assert.ok(created.ok);
  if (!created.ok) return;
  const site = "https://ohyoushouldnt.example.test";
  const access = (authorization: string | null, origin: string | null = null) => mcpAccess({ origin, siteOrigin: site, authorization });
  await withStore(created.doc, async () => {
    const ok = await access(`Bearer ${created.token}`);
    assert.equal(ok.ok && ok.user.id, "alex");
    assert.equal((await access(`Bearer ${created.token}`, site)).ok, true, "depuis le site lui-même");
    assert.deepEqual(await access(null), { ok: false, error: "unauthorized" });
    assert.deepEqual(await access("Bearer jeton-de-session-de-l-app"), { ok: false, error: "unauthorized" });
    assert.deepEqual(await access("Bearer oys_inconnue"), { ok: false, error: "unauthorized" });
    assert.deepEqual(await access(`Bearer ${created.token}`, "https://autre.example.test"), { ok: false, error: "originNotAllowed" });
  });
  const revoked = revokeApiKey(created.doc, { userId: "alex", keyId: created.key.id });
  assert.ok(revoked.ok);
  if (!revoked.ok) return;
  await withStore(revoked.doc, async () => {
    assert.deepEqual(await access(`Bearer ${created.token}`), { ok: false, error: "unauthorized" });
  });
});

test("accès au serveur : au-delà de 120 requêtes par minute, la clé reçoit rateLimited", async () => {
  const doc = apiDoc();
  const created = createApiKey(doc, doc.users[0]!, { name: "Claude" });
  assert.ok(created.ok);
  if (!created.ok) return;
  await withStore(created.doc, async () => {
    const access = () => mcpAccess({ origin: null, siteOrigin: "https://ohyoushouldnt.example.test", authorization: `Bearer ${created.token}` });
    for (let i = 0; i < 120; i++) assert.equal((await access()).ok, true);
    assert.deepEqual(await access(), { ok: false, error: "rateLimited" });
  });
});

test("rename_* et delete_* : un nom vide est refusé, jamais « le premier » de la liste", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    await alex.call("add_person", { listId: "w", name: "Lou" });
    for (const [tool, args] of [
      ["delete_person", { listId: "w", name: "  " }],
      ["delete_category", { listId: "w", name: "" }],
      ["rename_person", { listId: "w", current: " ", name: "Max" }],
    ] as const) {
      assert.equal((await alex.call(tool, args)).isError, true, tool);
    }
    const after = await readDocument();
    assert.deepEqual(after.people.map((person) => person.label).sort(), ["Alex", "Lou"]);
    assert.deepEqual(after.types.map((type) => type.label), ["Jeux"]);
  });
});

test("update_idea : une catégorie ou un « qui » vide garde ceux de l'idée", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    await alex.call("add_category", { listId: "w", name: "Livres" });
    await alex.call("add_person", { listId: "w", name: "Lou" });
    await alex.call("update_idea", { listId: "w", ideaId: "gift", category: "livres", for: "lou" });
    const before = (await readDocument()).items.find((entry) => entry.id === "gift")!;
    const result = await alex.call("update_idea", { listId: "w", ideaId: "gift", category: "", for: " ", name: "Renommée" });
    assert.notEqual(result.isError, true);
    const item = (await readDocument()).items.find((entry) => entry.id === "gift")!;
    assert.deepEqual({ typeId: item.typeId, personId: item.personId, name: item.name }, { typeId: before.typeId, personId: before.personId, name: "Renommée" });
  });
});

test("get_list : le prix en euros, tel que update_idea le reprend", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    const gift = json(await alex.call("get_list", { listId: "w" })).ideas.find((idea: { id: string }) => idea.id === "gift");
    assert.equal(gift.price, 19.9);
    await alex.call("update_idea", { listId: "w", ideaId: "gift", price: gift.price });
    assert.equal((await readDocument()).items.find((entry) => entry.id === "gift")?.priceCents, 1990);
  });
});

test("entrées bornées : un nom trop long est refusé avant la commande", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    const alex = client(doc.users[0]!);
    assert.equal((await alex.call("add_idea", { listId: "w", name: "x".repeat(201) })).isError, true);
    assert.equal((await alex.call("rename_list", { listId: "w", title: "x".repeat(201) })).isError, true);
    assert.equal((await readDocument()).items.length, doc.items.length);
  });
});

test("fill_from_url : un non-membre reçoit listMissing ; une adresse qui n'est pas un lien web est refusée", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    assert.match((await client(doc.users[1]!).call("fill_from_url", { listId: "w", url: "https://shop.example.test/a" })).content[0]!.text, /listMissing/);
    const invalid = await client(doc.users[0]!).call("fill_from_url", { listId: "w", url: "javascript:alert(1)" });
    assert.equal(invalid.isError, true);
    assert.match(invalid.content[0]!.text, /urlInvalid/);
  });
});
