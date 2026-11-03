import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { priceInput } from "../../domain/price";
import { resolveTypeId } from "../../domain/product-from-url";
import { translateErrorFor } from "../../i18n/server";
import { publicErrorCode } from "../api/errors";
import { isRateLimitError } from "../rate-limit";
import type { CommandContext } from "../commands/context";
import { copyItem, deleteItem, enrichFromUrl, moveItem, patchItem, saveItem, type TransferFields } from "../commands/items";
import { manageLabel } from "../commands/labels";
import { createList, listMine, readMemberList, updateSettings } from "../commands/lists";
import { deleteList } from "../commands/sharing";

/**
 * Serveur MCP d'un compte : chaque outil appelle les mêmes commandes que le site et l'API, donc les mêmes
 * règles et les mêmes droits : une idée réservée ne se supprime pas, seul le propriétaire supprime une liste.
 * Rien pour le compte (mot de passe, suppression, export).
 * Les réservations ne sont jamais montrées : une idée dit seulement si elle est réservée (oui/non).
 *
 * Descriptions et messages propres aux outils en anglais : ils s'adressent au modèle, pas à l'interface.
 * Les erreurs des règles sont traduites dans la langue de la requête.
 */

type Labelled = { id: string; label: string };

// Indications pour le client, qui peut demander confirmation avant un outil qui supprime. Sans elles,
// MCP suppose qu'un outil qui écrit peut détruire.
const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DELETE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

// Bornes des entrées : le corps est déjà limité à 64 Kio, elles gardent des libellés lisibles.
const ID = z.string().max(100);
const NAME = z.string().trim().min(1).max(200);
const URL_MAX = 2048;

function ok(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Catégorie ou « qui » donné par son nom (casse et espaces ignorés) ou son id, comme « Remplir depuis le lien ». */
function find(options: Labelled[], wanted: string, what: string): Labelled | string {
  const id = resolveTypeId(options, wanted);
  const found = id ? options.find((option) => option.id === id) : undefined;
  return found ?? `Unknown ${what} "${wanted}". The list's ${what === "category" ? "categories" : "people"}: ${options.map((option) => option.label).join(", ") || "none"}.`;
}

/** Pour une nouvelle idée : absent ou vide, le premier de la liste. */
function findOrFirst(options: Labelled[], wanted: string | undefined, what: string): Labelled | string {
  if (!wanted?.trim()) return options[0] ?? `This list has no ${what} yet.`;
  return find(options, wanted, what);
}

export function buildMcpServer(ctx: CommandContext): McpServer {
  const server = new McpServer({ name: "oh-you-shouldnt", version: "1.0.0" });

  /** Une commande qui refuse, ou une limite de débit : message lisible pour le modèle. */
  async function run(action: () => Promise<ToolResult>): Promise<ToolResult> {
    try {
      return await action();
    } catch (error) {
      if (isRateLimitError(error)) return fail(await translateErrorFor(ctx.locale, "rateLimited"));
      // Comme l'API : le détail reste dans le journal, jamais dans la réponse lue par le modèle.
      console.error("MCP tool error", error);
      return fail(await translateErrorFor(ctx.locale, "serverError"));
    }
  }
  // Comme l'API : un non-membre reçoit la même réponse que pour une liste qui n'existe pas.
  const refused = async (code: string) => {
    const shown = publicErrorCode(code);
    return fail(`${await translateErrorFor(ctx.locale, shown)} (${shown})`);
  };

  async function listOf(listId: string) {
    const result = await readMemberList(ctx, { wishlistId: listId });
    return result.ok ? result.list : (result.error as string);
  }

  server.registerTool(
    "list_lists",
    { description: "List the wish lists the user is a member of (id, title, role, number of ideas).", inputSchema: z.object({}), annotations: READ },
    () =>
      run(async () => {
        const result = await listMine(ctx);
        if (!result.ok) return refused(result.error);
        return ok(result.lists.map((list) => ({ id: list.id, title: list.title, role: list.role, ideas: list.itemCount })));
      }),
  );

  server.registerTool(
    "get_list",
    {
      description:
        "Read one wish list: its categories, its people (who the gifts are for) and its ideas. Archived ideas are left out unless includeArchived is true. `price` is in euros, as add_idea and update_idea take it. `reserved` only says whether a giver has reserved an idea; who reserved it is never shown, to keep the surprise.",
      inputSchema: z.object({ listId: ID, includeArchived: z.boolean().optional() }),
      annotations: READ,
    },
    ({ listId, includeArchived }) =>
      run(async () => {
        const list = await listOf(listId);
        if (typeof list === "string") return refused(list);
        const reserved = new Set(list.reservations.map((reservation) => reservation.itemId));
        const category = new Map(list.categories.map((entry) => [entry.id, entry.label]));
        const person = new Map(list.people.map((entry) => [entry.id, entry.label]));
        return ok({
          id: list.id,
          title: list.title,
          categories: list.categories.map((entry) => entry.label),
          people: list.people.map((entry) => entry.label),
          ideas: list.items
            .filter((item) => includeArchived || !item.archived)
            .map((item) => ({
              id: item.id,
              name: item.name,
              category: category.get(item.typeId) ?? null,
              for: person.get(item.personId) ?? null,
              url: item.url,
              price: item.priceCents === null ? null : item.priceCents / 100,
              priority: item.priority ? Number(item.priority) : null,
              description: item.description,
              secondHandOk: item.secondHandOk,
              archived: item.archived,
              reserved: reserved.has(item.id),
            })),
        });
      }),
  );

  const ideaFields = {
    category: z.string().max(200).optional().describe("Category name (or id). Defaults to the list's first category."),
    for: z.string().max(200).optional().describe("Who the gift is for: a person's name (or id) from the list. Defaults to the first one."),
    url: z.string().max(URL_MAX).optional().describe("Link to the product page (http or https)."),
    // Un assistant envoie souvent un nombre (32.5) : les deux sont acceptés.
    price: z.union([z.string().max(20), z.number().nonnegative()]).optional().describe("Price in euros, e.g. \"18.50\" or 18.5."),
    priority: z.number().int().min(1).max(5).optional().describe("How much the person wants it, 1 to 5 stars."),
    // Borné par la règle (descriptionTooLong, message traduit), pas par le schéma.
    description: z
      .string()
      .optional()
      .describe("Context for the gift givers (size, colour, edition…), up to 2000 characters. An empty string removes it."),
    secondHandOk: z.boolean().optional().describe("True if a second-hand one is fine."),
  };

  server.registerTool(
    "add_idea",
    {
      description: "Add a gift idea to a wish list. Use fill_from_url first to get the name and price from a product link.",
      inputSchema: z.object({ listId: ID, name: NAME, ...ideaFields }),
      annotations: WRITE,
    },
    (input) =>
      run(async () => {
        const list = await listOf(input.listId);
        if (typeof list === "string") return refused(list);
        const type = findOrFirst(list.categories, input.category, "category");
        if (typeof type === "string") return fail(type);
        const person = findOrFirst(list.people, input.for, "person");
        if (typeof person === "string") return fail(person);
        const saved = await saveItem(ctx, {
          wishlistId: list.id,
          name: input.name,
          typeId: type.id,
          personId: person.id,
          url: input.url ?? "",
          imageUrl: "",
          price: input.price === undefined ? "" : String(input.price),
          priority: input.priority ? String(input.priority) : "",
          description: input.description,
          secondHandOk: input.secondHandOk,
        });
        if (!saved.ok) return refused(saved.error);
        return ok({ added: { id: saved.item.id, name: saved.item.name, category: type.label, for: person.label } });
      }),
  );

  server.registerTool(
    "update_idea",
    {
      description:
        "Change an idea: only the fields you give are changed (an empty category or for keeps the current one). Use priority 0 to remove the stars.",
      inputSchema: z.object({
        listId: ID,
        ideaId: ID,
        name: NAME.optional(),
        ...ideaFields,
        priority: z.number().int().min(0).max(5).optional().describe("1 to 5 stars, 0 to remove them."),
      }),
      annotations: WRITE,
    },
    (input) =>
      run(async () => {
        const list = await listOf(input.listId);
        if (typeof list === "string") return refused(list);
        const current = list.items.find((item) => item.id === input.ideaId);
        if (!current) return refused("itemMissing");
        // Absent ou vide : on garde la catégorie et le « qui » de l'idée, au lieu de prendre le premier.
        const type = input.category?.trim() ? find(list.categories, input.category, "category") : { id: current.typeId };
        if (typeof type === "string") return fail(type);
        const person = input.for?.trim() ? find(list.people, input.for, "person") : { id: current.personId };
        if (typeof person === "string") return fail(person);
        const saved = await saveItem(ctx, {
          wishlistId: list.id,
          itemId: current.id,
          name: input.name ?? current.name,
          typeId: type.id,
          personId: person.id,
          url: input.url ?? current.url ?? "",
          imageUrl: current.imageUrl ?? "",
          price: input.price === undefined ? priceInput(current.priceCents) : String(input.price),
          priority: input.priority === undefined ? (current.priority ?? "") : input.priority === 0 ? "" : String(input.priority),
          // Absents : la règle garde la description et « occasion acceptée » enregistrées.
          description: input.description,
          secondHandOk: input.secondHandOk,
        });
        if (!saved.ok) return refused(saved.error);
        return ok({ updated: { id: saved.item.id, name: saved.item.name } });
      }),
  );

  server.registerTool(
    "archive_idea",
    {
      description: "Archive an idea (it leaves the shared list but can be restored), or restore it with archived: false.",
      inputSchema: z.object({ listId: ID, ideaId: ID, archived: z.boolean().optional() }),
      annotations: WRITE,
    },
    ({ listId, ideaId, archived }) =>
      run(async () => {
        const result = await patchItem(ctx, { wishlistId: listId, itemId: ideaId, archived: archived ?? true });
        if (!result.ok) return refused(result.error);
        return ok({ id: result.item.id, name: result.item.name, archived: result.item.archived });
      }),
  );

  server.registerTool(
    "delete_idea",
    {
      description:
        "Delete an idea for good. An idea a giver has reserved cannot be deleted. Prefer archive_idea when the person may want it back.",
      inputSchema: z.object({ listId: ID, ideaId: ID }),
      annotations: DELETE,
    },
    ({ listId, ideaId }) =>
      run(async () => {
        const list = await listOf(listId);
        if (typeof list === "string") return refused(list);
        const idea = list.items.find((item) => item.id === ideaId);
        if (!idea) return refused("itemMissing");
        const result = await deleteItem(ctx, { wishlistId: list.id, itemId: idea.id });
        if (!result.ok) return refused(result.error);
        return ok({ deleted: { id: idea.id, name: idea.name } });
      }),
  );

  const transferFields = {
    listId: ID,
    ideaId: ID,
    targetListId: ID.describe("The list the idea goes to (can be the same list for a copy)."),
    category: z
      .string()
      .max(200)
      .optional()
      .describe("Category name (or id) in the target list. Defaults to the one with the same name, else the target list's first."),
    for: z
      .string()
      .max(200)
      .optional()
      .describe("Who the gift is for, a person's name (or id) in the target list. Defaults to the same name, else the first."),
  };
  type TransferInput = { listId: string; ideaId: string; targetListId: string; category?: string; for?: string };

  /** Catégorie et « qui » dans la liste d'arrivée : donnés par nom, sinon même nom qu'au départ, sinon le premier (comme le site). */
  async function transferTarget(
    input: TransferInput,
  ): Promise<
    | { refused: string }
    | { failed: string }
    | { fields: TransferFields; type: Labelled; person: Labelled; target: { title: string } }
  > {
    const source = await listOf(input.listId);
    if (typeof source === "string") return { refused: source };
    const idea = source.items.find((item) => item.id === input.ideaId);
    if (!idea) return { refused: "itemMissing" };
    const target = input.targetListId === source.id ? source : await listOf(input.targetListId);
    if (typeof target === "string") return { refused: target };
    const pick = (options: Labelled[], wanted: string | undefined, current: string | undefined, what: string) => {
      if (wanted?.trim()) return find(options, wanted, what);
      const same = current ? options.find((option) => option.label.trim().toLowerCase() === current.trim().toLowerCase()) : undefined;
      return same ?? options[0] ?? `The target list has no ${what} yet.`;
    };
    const currentType = source.categories.find((entry) => entry.id === idea.typeId)?.label;
    const currentPerson = source.people.find((entry) => entry.id === idea.personId)?.label;
    const type = pick(target.categories, input.category, currentType, "category");
    if (typeof type === "string") return { failed: type };
    const person = pick(target.people, input.for, currentPerson, "person");
    if (typeof person === "string") return { failed: person };
    return { fields: { wishlistId: source.id, itemId: idea.id, targetWishlistId: target.id, typeId: type.id, personId: person.id }, type, person, target };
  }

  server.registerTool(
    "move_idea",
    {
      description:
        "Move an idea to another wish list the user is a member of. An idea a giver has reserved cannot be moved (the giver would lose the reservation).",
      inputSchema: z.object(transferFields),
      annotations: WRITE,
    },
    (input) =>
      run(async () => {
        const found = await transferTarget(input);
        if ("refused" in found) return refused(found.refused);
        if ("failed" in found) return fail(found.failed);
        const result = await moveItem(ctx, found.fields);
        if (!result.ok) return refused(result.error);
        return ok({
          moved: { id: result.item.id, name: result.item.name, list: found.target.title, category: found.type.label, for: found.person.label },
        });
      }),
  );

  server.registerTool(
    "copy_idea",
    {
      description:
        "Copy an idea to a wish list the user is a member of (or within the same list). The copy has every field of the idea but no reservation, and is not archived.",
      inputSchema: z.object(transferFields),
      annotations: WRITE,
    },
    (input) =>
      run(async () => {
        const found = await transferTarget(input);
        if ("refused" in found) return refused(found.refused);
        if ("failed" in found) return fail(found.failed);
        const result = await copyItem(ctx, found.fields);
        if (!result.ok) return refused(result.error);
        return ok({
          copied: { id: result.item.id, name: result.item.name, list: found.target.title, category: found.type.label, for: found.person.label },
        });
      }),
  );

  for (const [kind, noun, what, entries] of [
    ["type", "category", "category", "categories"],
    ["person", "person", "person (someone the gifts are for)", "people"],
  ] as const) {
    server.registerTool(
      `add_${noun}`,
      { description: `Add a ${what} to a wish list.`, inputSchema: z.object({ listId: ID, name: NAME }), annotations: WRITE },
      ({ listId, name }) =>
        run(async () => {
          const result = await manageLabel(ctx, { kind, op: "add", wishlistId: listId, label: name });
          if (!result.ok) return refused(result.error);
          return ok({ added: result.label });
        }),
    );

    /** Le libellé visé par son nom ou son id ; jamais « le premier » par défaut (le schéma refuse un nom vide). */
    async function target(
      listId: string,
      wanted: string,
    ): Promise<{ refused: string } | { failed: string } | { list: { id: string }; entry: Labelled }> {
      const list = await listOf(listId);
      if (typeof list === "string") return { refused: list };
      const entry = find(list[entries], wanted, noun);
      return typeof entry === "string" ? { failed: entry } : { list, entry };
    }

    server.registerTool(
      `rename_${noun}`,
      {
        description: `Rename a ${what} of a wish list; its ideas keep it.`,
        inputSchema: z.object({ listId: ID, current: NAME.describe("Current name (or id)."), name: NAME }),
        annotations: WRITE,
      },
      ({ listId, current, name }) =>
        run(async () => {
          const found = await target(listId, current);
          if ("refused" in found) return refused(found.refused);
          if ("failed" in found) return fail(found.failed);
          const result = await manageLabel(ctx, { kind, op: "rename", wishlistId: found.list.id, id: found.entry.id, label: name });
          if (!result.ok) return refused(result.error);
          return ok({ renamed: { from: found.entry.label, to: result.label?.label ?? name } });
        }),
    );

    server.registerTool(
      `delete_${noun}`,
      {
        description: `Remove a ${what} from a wish list. Refused while ideas still use it: change or delete those ideas first.`,
        inputSchema: z.object({ listId: ID, name: NAME.describe("Name (or id).") }),
        annotations: DELETE,
      },
      ({ listId, name }) =>
        run(async () => {
          const found = await target(listId, name);
          if ("refused" in found) return refused(found.refused);
          if ("failed" in found) return fail(found.failed);
          const result = await manageLabel(ctx, { kind, op: "delete", wishlistId: found.list.id, id: found.entry.id });
          if (!result.ok) return refused(result.error);
          return ok({ deleted: found.entry.label });
        }),
    );
  }

  server.registerTool(
    "create_list",
    {
      description:
        "Create a wish list owned by the user. A list starts with one category and one person (who the gifts are for); add more with add_category and add_person.",
      inputSchema: z.object({
        title: NAME,
        category: NAME.describe('First category, e.g. "Books".'),
        for: NAME.describe("Who the gifts are for, e.g. the user's first name."),
      }),
      annotations: WRITE,
    },
    ({ title, category, for: person }) =>
      run(async () => {
        const result = await createList(ctx, { title, category, person });
        if (!result.ok) return refused(result.error);
        return ok({ created: { id: result.list.id, title: result.list.title } });
      }),
  );

  server.registerTool(
    "rename_list",
    { description: "Change a wish list's title.", inputSchema: z.object({ listId: ID, title: NAME }), annotations: WRITE },
    ({ listId, title }) =>
      run(async () => {
        const result = await updateSettings(ctx, { wishlistId: listId, title });
        if (!result.ok) return refused(result.error);
        return ok({ renamed: { id: result.list.id, title: result.list.title } });
      }),
  );

  server.registerTool(
    "delete_list",
    {
      description:
        "Delete a whole wish list for good, with its ideas and reservations, for every member. Only its owner can. Confirm with the user first.",
      inputSchema: z.object({ listId: ID }),
      annotations: DELETE,
    },
    ({ listId }) =>
      run(async () => {
        const list = await listOf(listId);
        if (typeof list === "string") return refused(list);
        const result = await deleteList(ctx, { wishlistId: list.id });
        if (!result.ok) return refused(result.error);
        return ok({ deleted: { id: list.id, title: list.title } });
      }),
  );

  server.registerTool(
    "fill_from_url",
    {
      description:
        "Read a product page and propose a name, a price, an image and a description for a new idea, like the site's \"Fill from the link\". Creates nothing.",
      inputSchema: z.object({ listId: ID, url: z.string().max(URL_MAX) }),
      // Lit une page web, ne change rien.
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ listId, url }) =>
      run(async () => {
        const result = await enrichFromUrl(ctx, { wishlistId: listId, url });
        if (!result.ok) return refused(result.error);
        const list = await listOf(listId);
        const category = typeof list === "string" ? null : (list.categories.find((entry) => entry.id === result.typeId)?.label ?? null);
        return ok({
          name: result.name || null,
          price: result.price || null,
          imageUrl: result.imageUrl || null,
          description: result.description || null,
          category,
        });
      }),
  );

  return server;
}
