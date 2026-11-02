import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { User } from "../../src/domain/types";
import { buildMcpServer } from "../../src/server/mcp/server";
import { resetRateLimitsForTests } from "../../src/server/rate-limit";
import { readDocument } from "../../src/store/db";
import { apiDoc, ctx, ensurePasswordHash, withStore } from "./helpers/api-fixtures";

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
      "create_list",
      "delete_category",
      "delete_idea",
      "delete_list",
      "delete_person",
      "fill_from_url",
      "get_list",
      "list_lists",
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
    resetRateLimitsForTests();
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
    resetRateLimitsForTests();
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

test("archive_idea, add_category, add_person : mêmes règles que le site (un doublon de nom est refusé par la règle)", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    resetRateLimitsForTests();
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
    resetRateLimitsForTests();
    const alex = client(doc.users[0]!);
    assert.deepEqual(json(await alex.call("delete_idea", { listId: "w", ideaId: "gift" })), { deleted: { id: "gift", name: "Idée gift" } });
    const reserved = await alex.call("delete_idea", { listId: "w", ideaId: "taken" });
    assert.equal(reserved.isError, true);
    assert.match(reserved.content[0]!.text, /itemHasReservation/);
    assert.deepEqual((await readDocument()).items.map((item) => item.id).sort(), ["gift2", "taken"]);
    assert.match((await client(doc.users[1]!).call("delete_idea", { listId: "w", ideaId: "gift2" })).content[0]!.text, /listMissing/);
  });
});

test("rename_* et delete_* : catégorie et « qui » par leur nom ; un libellé encore utilisé n'est pas retiré", async () => {
  const doc = apiDoc();
  await withStore(doc, async () => {
    resetRateLimitsForTests();
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
    resetRateLimitsForTests();
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
