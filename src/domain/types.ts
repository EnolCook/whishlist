import type { WishlistTheme } from "./theme";

export type { WishlistTheme };

export type Role = "owner" | "member";
export type ViewKind = "all" | "types" | "person";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
  /** Si true, la session est redirigée vers le changement de mot de passe. */
  mustChangePassword: boolean;
  /** Incrémenté à chaque changement de mot de passe. Les jetons plus anciens sont refusés. */
  sessionVersion?: number;
  /** Date de confirmation de l'adresse. null : adresse non vérifiée. */
  emailVerifiedAt: string | null;
}

export interface Wishlist {
  id: string;
  title: string;
  /** Sous-titre affiché sous le titre sur la page publique. */
  subtitle: string | null;
  /** Image d'illustration (URL http(s)) — sinon le cadeau SVG aux couleurs du thème. */
  coverImageUrl: string | null;
  /** Palette propre à la liste (défaut = favicon cadeau). */
  theme: WishlistTheme;
  readToken: string;
  inviteToken: string;
  /** Si non null, la page publique `/l/[readToken]` exige ce mot de passe (hash scrypt). */
  readPasswordHash: string | null;
  fromTemplate: boolean;
  createdAt: string;
}

export interface Membership {
  wishlistId: string;
  userId: string;
  role: Role;
  joinedAt: string;
}

export interface Subscription {
  wishlistId: string;
  userId: string;
  /** Empreinte du mot de passe de lecture au moment où l'abonnement a été créé ou déverrouillé. */
  readPasswordHash: string | null;
  createdAt: string;
}

export interface WishType {
  id: string;
  wishlistId: string;
  label: string;
  /** Ordre d’affichage des catégories (accordéon). */
  sortOrder: number;
}

export interface Person {
  id: string;
  wishlistId: string;
  label: string;
}

export interface View {
  id: string;
  wishlistId: string;
  label: string;
  kind: ViewKind;
  typeIds: string[];
  personId: string | null;
  pinned: boolean;
}

export interface Item {
  id: string;
  wishlistId: string;
  name: string;
  typeId: string;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  priority: string | null;
  /** L'idée convient aussi d'occasion (livres, jeux…), signalé à qui offre. */
  secondHandOk: boolean;
  /** Contexte pour qui offre : ce qu'est le produit, pourquoi on le veut, à quoi il servira. */
  description: string | null;
  personId: string;
  sortOrder: number;
  archived: boolean;
}

export interface Reservation {
  id: string;
  wishlistId: string;
  itemId: string;
  fromName: string | null;
  note: string | null;
  /** Rempli si la réservation a été faite en étant connecté. */
  userId: string | null;
  createdAt: string;
}

export interface PasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Lien de confirmation d'une adresse : `verify` pour l'adresse actuelle, `change` pour une nouvelle.
 * Au plus une demande par compte et par motif ; le jeton n'est stocké que haché.
 */
export interface EmailConfirmation {
  id: string;
  userId: string;
  purpose: "verify" | "change";
  /** Adresse à confirmer, normalisée. */
  email: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

/** Connexion d'un client d'API (app mobile). Le jeton n'est stocké que haché. */
export interface ApiSession {
  id: string;
  userId: string;
  tokenHash: string;
  /** `user.sessionVersion` à l'émission : un changement de mot de passe la périme. */
  sessionVersion: number;
  createdAt: string;
  expiresAt: string;
}

export interface Database {
  users: User[];
  wishlists: Wishlist[];
  memberships: Membership[];
  subscriptions: Subscription[];
  types: WishType[];
  people: Person[];
  views: View[];
  items: Item[];
  reservations: Reservation[];
  passwordResets: PasswordReset[];
  apiSessions: ApiSession[];
  emailConfirmations: EmailConfirmation[];
}

export interface SeedFile {
  types: { id: string; label: string }[];
  people: { id: string; label: string }[];
  views: {
    id: string;
    label: string;
    kind: ViewKind;
    typeIds: string[];
    personId: string | null;
    pinned: boolean;
  }[];
  items: {
    id: string;
    name: string;
    typeId: string;
    url: string | null;
    imageUrl?: string | null;
    priceCents: number | null;
    priority: string | null;
    secondHandOk?: boolean;
    description?: string | null;
    personId: string;
    sortOrder: number;
    archived?: boolean;
  }[];
}

export function emptyDatabase(): Database {
  return {
    users: [],
    wishlists: [],
    memberships: [],
    subscriptions: [],
    types: [],
    people: [],
    views: [],
    items: [],
    reservations: [],
    passwordResets: [],
    apiSessions: [],
    emailConfirmations: [],
  };
}
