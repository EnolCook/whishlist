# Data Model: Validation de l'adresse e-mail et changement d'adresse

Une colonne ajoutée à `users`, une table ajoutée. Une seule migration Drizzle, `drizzle/0001_*.sql`, générée par `npm run db:generate` puis complétée à la main par le `UPDATE` de reprise (R6).

## `User` (table `users`)

| Champ | Colonne | Type | Règle |
| --- | --- | --- | --- |
| `emailVerifiedAt` | `email_verified_at` | `string \| null` (ISO) | `null` : adresse non vérifiée. Posé à la confirmation d'une demande `verify` ou `change`, à une réinitialisation réussie, ou au changement immédiat sans envoi d'e-mail. Repris à `created_at` pour les comptes existants (migration et import JSON). |

`email` ne change qu'à la confirmation d'un changement (ou tout de suite sans envoi d'e-mail). Il garde son index unique et sa normalisation (`normalizeEmail`).

## `EmailConfirmation` (nouvelle table `email_confirmations`)

| Champ | Colonne | Type | Règle |
| --- | --- | --- | --- |
| `id` | `id` | `string` | clé primaire, `newId()` |
| `userId` | `user_id` | `string` | clé étrangère vers `users.id`, index `email_confirmations_user_id` |
| `purpose` | `purpose` | `"verify" \| "change"` | `CHECK (purpose in ('verify','change'))` |
| `email` | `email` | `string` | adresse à confirmer, normalisée : l'adresse actuelle pour `verify`, la nouvelle pour `change` |
| `tokenHash` | `token_hash` | `string` | empreinte du jeton, unique ; le jeton en clair n'existe que dans le lien envoyé |
| `expiresAt` | `expires_at` | `string` (ISO) | création + 24 h |
| `createdAt` | `created_at` | `string` (ISO) | |

Contraintes :
- au plus une ligne par (`user_id`, `purpose`) : la règle du domaine l'assure, et un index unique `email_confirmations_user_purpose` le garantit ;
- pas de `ON DELETE CASCADE` (convention du schéma) : `deleteAccount` supprime les lignes du compte, comme pour `passwordResets`.

Ajouts liés :
- `Database.emailConfirmations: EmailConfirmation[]` dans `src/domain/types.ts`, et `emptyDatabase()` ;
- `COLLECTIONS` et `COLLECTION_NAMES` (`src/store/rows.ts`), lecture dans `readAll` ;
- `legacy-json.ts` : collection facultative (`OPTIONAL`), champs contrôlés, doublons de `tokenHash`, référence au compte (`ofUser`), et `emailVerifiedAt: "string?"` sur `users`, normalisé à `createdAt` s'il manque ;
- `scripts/db-check.ts` passe par les mêmes contrôles.

## Transitions

```text
Compte créé (envoi actif)  ── registerUser ──▶ emailVerifiedAt = null, demande verify créée
demande verify ── nouveau renvoi ──▶ remplacée (ancien jeton refusé)
demande verify ── confirmation (jeton valide, non expiré, email = adresse actuelle) ──▶ emailVerifiedAt = now, demande supprimée
demande verify ── réinitialisation du mot de passe réussie ──▶ emailVerifiedAt = now, demande supprimée

Compte ── requestEmailChange (mot de passe OK, adresse libre et différente)
   ├─ envoi actif   ──▶ demande change créée (remplace la précédente)
   └─ envoi inactif ──▶ email = nouvelle, emailVerifiedAt = now
demande change ── annulation ──▶ supprimée
demande change ── confirmation (adresse toujours libre) ──▶ email = nouvelle, emailVerifiedAt = now,
                                                            demandes change et verify supprimées, avis à l'ancienne adresse
demande change ── confirmation (adresse prise entre-temps) ──▶ refus emailTaken, demande supprimée
```

Une demande `verify` dont l'adresse n'est plus l'adresse du compte (changement entre-temps) est refusée comme `confirmationLinkInvalid`.

## Erreurs (codes `errors.json`)

| Code | Quand | HTTP |
| --- | --- | --- |
| `emailNotVerified` | créer une liste, accepter ou envoyer une invitation avec un compte non vérifié | 403 |
| `emailAlreadyVerified` | demander un lien pour un compte déjà vérifié | 409 |
| `emailUnchanged` | nouvelle adresse identique à l'actuelle | 400 |
| `emailInvalid`, `emailTaken` | existants | 400 |
| `wrongCurrentPassword` | existant | 400 |
| `confirmationLinkInvalid` | jeton inconnu, déjà utilisé, remplacé, ou adresse qui ne correspond plus | page du site |
| `confirmationLinkExpired` | jeton expiré | page du site |

## Export du compte

`AccountExport.account` gagne `emailVerifiedAt: string | null` et `pendingEmail: string | null` (FR-020).
