import { readFileSync } from "node:fs";
import { resolveTheme } from "../domain/theme";
import type { Database } from "../domain/types";

/** L'ancien fichier ne peut pas être importé ; `problems` ne cite que des collections et des identifiants. */
export class LegacyImportError extends Error {
  readonly problems: string[];

  constructor(file: string, problems: string[]) {
    super(`Import de ${file} impossible :\n- ${problems.join("\n- ")}`);
    this.name = "LegacyImportError";
    this.problems = problems;
  }
}

const REQUIRED = ["users", "wishlists", "memberships", "types", "people", "views", "items", "reservations"] as const;
const OPTIONAL = ["subscriptions", "passwordResets", "apiSessions", "emailConfirmations"] as const;

/**
 * Forme attendue de chaque champ dans l'ancien fichier, avant normalisation.
 * `?` : peut manquer (normalisé ensuite, ou colonne qui accepte NULL) ; un tableau : valeurs permises.
 */
type FieldCheck = "string" | "string?" | "number" | "number?" | "boolean" | "boolean?" | "string[]" | readonly string[];

const FIELDS: { [K in keyof Database]: Record<string, FieldCheck> } = {
  users: {
    id: "string",
    email: "string",
    passwordHash: "string",
    displayName: "string",
    createdAt: "string",
    mustChangePassword: "boolean?",
    sessionVersion: "number?",
    emailVerifiedAt: "string?",
  },
  wishlists: {
    id: "string",
    title: "string",
    subtitle: "string?",
    coverImageUrl: "string?",
    readToken: "string",
    inviteToken: "string",
    readPasswordHash: "string?",
    fromTemplate: "boolean",
    createdAt: "string",
  },
  memberships: { wishlistId: "string", userId: "string", role: ["owner", "member"], joinedAt: "string" },
  subscriptions: {
    wishlistId: "string",
    userId: "string",
    readPasswordHash: "string?",
    createdAt: "string",
  },
  types: { id: "string", wishlistId: "string", label: "string", sortOrder: "number?" },
  people: { id: "string", wishlistId: "string", label: "string" },
  views: {
    id: "string",
    wishlistId: "string",
    label: "string",
    kind: ["all", "types", "person"],
    typeIds: "string[]",
    personId: "string?",
    pinned: "boolean",
  },
  items: {
    id: "string",
    wishlistId: "string",
    name: "string",
    typeId: "string",
    url: "string?",
    imageUrl: "string?",
    priceCents: "number?",
    priority: "string?",
    secondHandOk: "boolean?",
    description: "string?",
    personId: "string",
    sortOrder: "number",
    archived: "boolean?",
  },
  reservations: {
    id: "string",
    wishlistId: "string",
    itemId: "string",
    fromName: "string?",
    note: "string?",
    userId: "string?",
    createdAt: "string",
  },
  passwordResets: { id: "string", userId: "string", tokenHash: "string", expiresAt: "string", createdAt: "string" },
  apiSessions: {
    id: "string",
    userId: "string",
    tokenHash: "string",
    sessionVersion: "number",
    createdAt: "string",
    expiresAt: "string",
  },
  emailConfirmations: {
    id: "string",
    userId: "string",
    purpose: ["verify", "change"],
    email: "string",
    tokenHash: "string",
    expiresAt: "string",
    createdAt: "string",
  },
};

function fieldOk(value: unknown, check: FieldCheck): boolean {
  if (typeof check !== "string") return typeof value === "string" && check.includes(value);
  const optional = check.endsWith("?");
  if (optional && (value === undefined || value === null)) return true;
  switch (check.replace("?", "")) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "string[]":
      return Array.isArray(value) && value.every((entry) => typeof entry === "string");
    default:
      return false;
  }
}

/** Champs obligatoires présents et du bon type ; ne cite que la collection, l'identifiant et le champ. */
function checkFields(raw: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    const rows = raw[name];
    if (!Array.isArray(rows)) continue;
    rows.forEach((row: unknown, index) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        problems.push(`${name}: #${index} n'est pas un objet`);
        return;
      }
      const values = new Map(Object.entries(row));
      const id = values.get("id");
      const label =
        name === "memberships" || name === "subscriptions"
          ? `${String(values.get("wishlistId"))}/${String(values.get("userId"))}`
          : typeof id === "string"
            ? id
            : `#${index}`;
      for (const [field, check] of Object.entries(FIELDS[name])) {
        if (!fieldOk(values.get(field), check)) problems.push(`${name}: ${label} → ${field} absent ou invalide`);
      }
    });
  }
  return problems;
}

/** Complète les champs ajoutés au fil des versions (ex-lecture du fichier JSON). */
export function normalizeDocument(doc: Database): Database {
  if (!doc.subscriptions) doc.subscriptions = [];
  if (!doc.passwordResets) doc.passwordResets = [];
  if (!doc.apiSessions) doc.apiSessions = [];
  if (!doc.emailConfirmations) doc.emailConfirmations = [];
  for (const subscription of doc.subscriptions) {
    if (subscription.readPasswordHash === undefined) subscription.readPasswordHash = null;
  }
  for (const user of doc.users) {
    // Comptes d'avant la validation des adresses : vérifiés d'office (010, FR-005b).
    if (user.emailVerifiedAt === undefined) user.emailVerifiedAt = user.createdAt;
    if (user.mustChangePassword === undefined) user.mustChangePassword = false;
    if (typeof user.sessionVersion !== "number") user.sessionVersion = 0;
  }
  for (const list of doc.wishlists) {
    if (list.subtitle === undefined) list.subtitle = null;
    if (list.coverImageUrl === undefined) list.coverImageUrl = null;
    if (list.readPasswordHash === undefined) list.readPasswordHash = null;
    list.theme = resolveTheme(list.theme);
  }
  for (const item of doc.items) {
    if (item.imageUrl === undefined) item.imageUrl = null;
    if (item.archived === undefined) item.archived = false;
    if (item.secondHandOk === undefined) item.secondHandOk = false;
    if (item.description === undefined) item.description = null;
  }
  const typesByList = new Map<string, typeof doc.types>();
  for (const type of doc.types) {
    if (typeof type.sortOrder !== "number") type.sortOrder = 0;
    const bucket = typesByList.get(type.wishlistId) ?? [];
    bucket.push(type);
    typesByList.set(type.wishlistId, bucket);
  }
  for (const types of typesByList.values()) {
    const needsOrder = types.every((type) => type.sortOrder === 0);
    if (!needsOrder) continue;
    [...types]
      .sort((a, b) => a.label.localeCompare(b.label, "fr") || a.id.localeCompare(b.id))
      .forEach((type, index) => {
        type.sortOrder = index;
      });
  }
  for (const reservation of doc.reservations) {
    if (reservation.userId === undefined) reservation.userId = null;
  }
  return doc;
}

/** Groupes d'identifiants qui partagent la même valeur de `key` (valeurs nulles ignorées). */
function duplicates<T>(rows: T[], key: (row: T) => string | null, id: (row: T) => string): string[][] {
  const seen = new Map<string, string[]>();
  for (const row of rows) {
    const value = key(row);
    if (value === null) continue;
    seen.set(value, [...(seen.get(value) ?? []), id(row)]);
  }
  return [...seen.values()].filter((ids) => ids.length > 1);
}

/**
 * Contrôle d'intégrité (data-model.md) : doublons, unicité, références.
 * Une ligne par problème ; jamais d'e-mail, de nom ni de jeton dans le message.
 */
export function checkDocument(doc: Database): string[] {
  const problems: string[] = [];
  const byId = (row: { id: string }) => row.id;
  const doubled = (name: string, label: string, groups: string[][]) => {
    for (const group of groups) problems.push(`${name}: ${label} (${group.join(", ")})`);
  };
  // Un identifiant en double : le citer une fois suffit.
  const sameId = (groups: string[][]) => groups.map((group) => [group[0]]);
  const idDoubled = (name: string, rows: { id: string }[]) =>
    doubled(name, "identifiant en double", sameId(duplicates(rows, byId, byId)));

  idDoubled("users", doc.users);
  idDoubled("wishlists", doc.wishlists);
  idDoubled("types", doc.types);
  idDoubled("people", doc.people);
  idDoubled("views", doc.views);
  idDoubled("items", doc.items);
  idDoubled("reservations", doc.reservations);
  idDoubled("passwordResets", doc.passwordResets);
  idDoubled("apiSessions", doc.apiSessions);
  idDoubled("emailConfirmations", doc.emailConfirmations);
  const membership = (m: Database["memberships"][number]) => `${m.wishlistId}/${m.userId}`;
  doubled("memberships", "adhésion en double", sameId(duplicates(doc.memberships, membership, membership)));
  const subscription = (s: Database["subscriptions"][number]) => `${s.wishlistId}/${s.userId}`;
  doubled("subscriptions", "abonnement en double", sameId(duplicates(doc.subscriptions ?? [], subscription, subscription)));

  doubled("users", "e-mail en double", duplicates(doc.users, (u) => u.email, byId));
  doubled("wishlists", "readToken en double", duplicates(doc.wishlists, (w) => w.readToken, byId));
  doubled("wishlists", "inviteToken en double", duplicates(doc.wishlists, (w) => w.inviteToken, byId));
  doubled("passwordResets", "tokenHash en double", duplicates(doc.passwordResets, (r) => r.tokenHash, byId));
  doubled("apiSessions", "tokenHash en double", duplicates(doc.apiSessions, (s) => s.tokenHash, byId));
  doubled(
    "emailConfirmations",
    "tokenHash en double",
    duplicates(doc.emailConfirmations, (c) => c.tokenHash, byId),
  );
  doubled(
    "emailConfirmations",
    "plusieurs demandes du même motif pour un compte",
    duplicates(doc.emailConfirmations, (c) => `${c.userId}/${c.purpose}`, byId),
  );
  doubled(
    "reservations",
    "plusieurs réservations pour la même idée",
    duplicates(doc.reservations, (r) => r.itemId, byId),
  );

  const ids = (rows: { id: string }[]) => new Set(rows.map(byId));
  const users = ids(doc.users);
  const lists = ids(doc.wishlists);
  const types = ids(doc.types);
  const people = ids(doc.people);
  const items = ids(doc.items);
  const missing = (name: string, id: string, field: string, value: string) =>
    problems.push(`${name}: ${id} → ${field} absent (${value})`);

  for (const m of doc.memberships) {
    if (!lists.has(m.wishlistId)) missing("memberships", membership(m), "wishlistId", m.wishlistId);
    if (!users.has(m.userId)) missing("memberships", membership(m), "userId", m.userId);
  }
  for (const s of doc.subscriptions ?? []) {
    if (!lists.has(s.wishlistId)) missing("subscriptions", subscription(s), "wishlistId", s.wishlistId);
    if (!users.has(s.userId)) missing("subscriptions", subscription(s), "userId", s.userId);
  }
  const inList = (name: string, rows: { id: string; wishlistId: string }[]) => {
    for (const row of rows) if (!lists.has(row.wishlistId)) missing(name, row.id, "wishlistId", row.wishlistId);
  };
  inList("types", doc.types);
  inList("people", doc.people);
  inList("views", doc.views);
  inList("items", doc.items);
  inList("reservations", doc.reservations);
  for (const view of doc.views) {
    for (const typeId of view.typeIds) if (!types.has(typeId)) missing("views", view.id, "typeIds", typeId);
    if (view.personId !== null && !people.has(view.personId)) missing("views", view.id, "personId", view.personId);
  }
  for (const item of doc.items) {
    if (!types.has(item.typeId)) missing("items", item.id, "typeId", item.typeId);
    if (!people.has(item.personId)) missing("items", item.id, "personId", item.personId);
  }
  for (const reservation of doc.reservations) {
    if (!items.has(reservation.itemId)) missing("reservations", reservation.id, "itemId", reservation.itemId);
    if (reservation.userId !== null && !users.has(reservation.userId)) {
      missing("reservations", reservation.id, "userId", reservation.userId);
    }
  }
  const ofUser = (name: string, rows: { id: string; userId: string }[]) => {
    for (const row of rows) if (!users.has(row.userId)) missing(name, row.id, "userId", row.userId);
  };
  ofUser("passwordResets", doc.passwordResets);
  ofUser("apiSessions", doc.apiSessions);
  ofUser("emailConfirmations", doc.emailConfirmations);
  return problems;
}

/**
 * Le message de JSON.parse cite un extrait du fichier (donc parfois un e-mail ou une empreinte) :
 * on n'en garde que la position.
 */
function parseErrorPosition(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (lineColumn) return ` (ligne ${lineColumn[1]}, colonne ${lineColumn[2]})`;
  const position = /position (\d+)/.exec(message);
  return position ? ` (position ${position[1]})` : "";
}

/** Lit, contrôle et normalise un ancien fichier. Ne le modifie jamais. */
export function loadLegacyDocument(file: string): Database {
  let text: string;
  try {
    text = readFileSync(/*turbopackIgnore: true*/ file, "utf8");
  } catch {
    throw new LegacyImportError(file, ["fichier illisible"]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new LegacyImportError(file, [`JSON invalide${parseErrorPosition(error)}`]);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new LegacyImportError(file, ["le fichier ne contient pas un objet JSON"]);
  }
  const raw = new Map(Object.entries(parsed));
  const absent = REQUIRED.filter((name) => !Array.isArray(raw.get(name)));
  const wrong = OPTIONAL.filter((name) => raw.get(name) !== undefined && !Array.isArray(raw.get(name)));
  if (absent.length > 0 || wrong.length > 0) {
    throw new LegacyImportError(
      file,
      [...absent, ...wrong].map((name) => `${name}: collection absente ou qui n'est pas un tableau`),
    );
  }
  const fieldProblems = checkFields(Object.fromEntries(raw));
  if (fieldProblems.length > 0) throw new LegacyImportError(file, fieldProblems);
  // Collections et champs vérifiés ci-dessus : le contenu a la forme d'un Database (champs anciens complétés ensuite).
  const doc = normalizeDocument(parsed as Database);
  const problems = checkDocument(doc);
  if (problems.length > 0) throw new LegacyImportError(file, problems);
  return doc;
}
