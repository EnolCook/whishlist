# Research: Validation de l'adresse e-mail et changement d'adresse

Décisions prises pour le plan. Aucune question ouverte.

## R1. Quand la validation est-elle exigée

- **Decision**: la validation est exigée quand l'envoi d'e-mail est actif, c'est-à-dire quand `mailConfigured()` est vrai (Resend configuré) ou en mode d'envoi simulé (R2). Une seule fonction, `emailVerificationRequired()` dans `src/server/mail.ts`, en décide. Le domaine ne connaît que l'état du compte (`emailVerifiedAt`). La décision « exigée ou non » se prend dans les commandes.
- **Rationale**: constitution, « Hébergement Docker » : sans service externe, le mécanisme est absent (FR-008). En prod, Resend est configuré (vérifié le 2026-11-01 sur `macbuntu`), donc la validation y sera active dès le déploiement.
- **Alternatives considered**: une variable dédiée `EMAIL_VERIFICATION=on|off` (rejetée : une variable de plus, et elle n'a de sens qu'avec l'envoi d'e-mail) ; exiger la validation partout en dev (rejetée : casserait la suite e2e, qui crée des comptes puis des listes sans e-mail).

## R2. Tester sans Resend : mode d'envoi simulé

- **Decision**: une nouvelle variable `MAIL_DRY_RUN=1`. Avec elle, `sendMail` n'appelle pas Resend : il écrit l'e-mail dans `data/mail.log`, comme le repli actuel, et `emailVerificationRequired()` est vrai. Elle est **ignorée quand `NODE_ENV=production`**. Comme pour la réinitialisation en dev, le site affiche le lien de confirmation après l'inscription (`?lien=`), mais jamais en production.
- **Rationale**: le parcours du `quickstart.md` (principe IV) doit pouvoir valider une adresse sur la base de démo sans clé Resend ni vraie boîte aux lettres.
- **Documentation**: la variable va dans le tableau du `README.md` et dans `.env.example`, avec la mention « développement uniquement ». **Écart assumé avec AGENTS.md** : elle ne va pas dans `deploy/compose.prod.yml`, car elle n'a aucun effet en production. Le plan le signale pour validation.
- **Alternatives considered**: une fausse clé Resend (rejetée : appel réseau, erreur 401 dans les logs) ; lire le jeton dans la base de dev (rejetée : les jetons ne sont stockés que hachés).

## R3. Jeton et table des demandes

- **Decision**: une table `email_confirmations` sur le modèle de `password_resets` : jeton aléatoire (`newSecretToken`), seule son empreinte stockée (`hashSecretToken`), date d'expiration, `purpose` = `verify` | `change`, `email` = l'adresse à confirmer. Une demande au plus par compte et par motif : une nouvelle demande supprime l'ancienne. La confirmation supprime la demande. Validité de 24 h pour les deux motifs.
- **Rationale**: même schéma éprouvé que la réinitialisation, avec ses tests. L'adresse est copiée dans la demande, si bien qu'un lien de validation envoyé avant un changement d'adresse ne vérifie pas la nouvelle.
- **Alternatives considered**: un jeton signé sans stockage (HMAC de l'adresse et de la date d'expiration). Rejeté : impossible d'invalider l'ancien lien au renvoi (FR-006) ou à l'annulation (FR-012).

## R4. Confirmer par un bouton, pas à l'ouverture du lien

- **Decision**: le lien ouvre `/confirmer-email/<token>`, qui affiche le compte concerné (adresse masquée si la personne n'est pas connectée à ce compte) et un bouton « Confirmer ». La confirmation passe par une server action (POST). Un lien inconnu ou expiré affiche l'erreur dès l'ouverture.
- **Rationale**: les antivirus de messagerie ouvrent les liens (GET) avant la personne. Une confirmation à l'ouverture consommerait le jeton, et la personne verrait ensuite « lien déjà utilisé ». Une page App Router n'écrit pas pendant son rendu.
- **Conséquence sur la spec**: SC-001 devient « deux gestes (ouvrir le lien, confirmer) en moins d'une minute ».
- **Alternatives considered**: confirmer au GET et rendre un succès si l'adresse est déjà vérifiée. Rejeté : ne règle pas le cas du changement d'adresse, dont la demande disparaît à la confirmation.

## R5. Où bloquer un compte non vérifié

- **Decision**: une garde `verifiedUser(ctx)` dans `src/server/commands/context.ts`, construite sur `activeUser`, qui rend `emailNotVerified` si `emailVerificationRequired()` et `user.emailVerifiedAt === null`. Elle remplace `activeUser` dans trois commandes : `createList` (lists.ts), `joinInvite` et `sendInvite` (sharing.ts). Les autres écritures n'en ont pas besoin : un compte non vérifié n'est membre d'aucune liste, puisqu'il n'a pu ni en créer ni en rejoindre. La réservation reste publique (`publicAccount`), sans garde.
- **HTTP**: `emailNotVerified` → 403 dans `src/server/api/errors.ts`.
- **Rationale**: une seule règle, appliquée côté serveur pour le site comme pour l'API (FR-005), au même endroit que `mustChangePassword`.
- **Cas limite**: un compte créé quand l'envoi était inactif reste non vérifié (`emailVerifiedAt` vide). Si l'envoi est activé plus tard, il voit le bandeau et la garde s'applique. Il peut alors être membre de listes : il continue à les éditer, mais ne crée, ne rejoint et n'invite plus avant d'avoir confirmé. C'est conforme à FR-005.

## R6. Comptes existants

- **Decision**: la migration ajoute `users.email_verified_at` (texte, nullable) puis lance `UPDATE users SET email_verified_at = created_at`. L'import d'un ancien fichier JSON fait de même pour un compte sans `emailVerifiedAt` (normalisation dans `legacy-json.ts`). `registerUser` crée les nouveaux comptes avec `emailVerifiedAt: null`.
- **Rationale**: FR-005b. La date de création est la meilleure date connue, et l'export la montre telle quelle.

## R7. Changement d'adresse

- **Decision**: `requestEmailChange` vérifie le mot de passe actuel (`verifyPassword`), normalise l'adresse et refuse `emailInvalid`, `emailUnchanged` et `emailTaken`. Si la validation est exigée, il crée une demande `change`. Sinon, il applique l'adresse tout de suite (FR-015). La confirmation revérifie que l'adresse est libre, l'applique par `setUserEmail` (aujourd'hui sans appelant, réutilisé ici), pose `emailVerifiedAt = now` et supprime aussi une éventuelle demande `verify`. Une notification part ensuite vers l'ancienne adresse, avec la nouvelle masquée (`maskEmail` : `ca•••@example.test`).
- **Sessions**: inchangées, ni `sessionVersion` incrémenté ni jetons d'API révoqués (hypothèse de la spec). L'e-mail à l'ancienne adresse renvoie vers « Mot de passe oublié ».
- **Unicité**: une adresse en attente n'est pas réservée. Deux comptes peuvent demander la même adresse, et le premier qui confirme l'obtient. L'autre reçoit `emailTaken` à la confirmation (scénario US3-6). L'index unique sur `users.email` garantit l'issue sous transaction.
- **Alternatives considered**: réserver l'adresse dès la demande. Rejeté : un compte pourrait bloquer l'adresse de quelqu'un d'autre pendant 24 h.

## R8. Réinitialisation du mot de passe

- **Decision**: `resetPasswordWithToken` pose `emailVerifiedAt = now` s'il était vide et supprime la demande `verify` du compte (cas limite de la spec, FR-007).

## R9. Reprendre une invitation après la confirmation

- **Decision**: l'inscription passe déjà `next` (par exemple `/inviter/<token>`). La commande `register` reçoit ce chemin, le valide comme `nextPath` (chemin interne seulement) et l'ajoute au lien de confirmation en `?suite=`. Après la confirmation, la page propose « Reprendre l'invitation » si `suite` commence par `/inviter/`, sinon « Mes listes ». Côté API, `register` ne reçoit pas de `next` : l'app n'accepte pas les invitations, elle ne fait qu'en envoyer.
- **Rationale**: aucune donnée en plus en base. Le lien part à la personne elle-même, et le jeton d'invitation qu'il porte, elle le connaît déjà.

## R10. Bandeau sur le site

- **Decision**: un composant `components/site/email-verification-banner.tsx`, rendu par `app/layout.tsx` sous l'en-tête quand le compte est connecté, actif (pas de `mustChangePassword`), non vérifié, et que la validation est exigée. Il compose l'`Alert` de `components/ui/` avec un formulaire « Renvoyer le lien » (server action). Le bandeau n'apparaît pas sur la page `/confirmer-email/…` elle-même.

## R11. App mobile

- **Decision**: `MeView` gagne `emailVerified` (vrai si la validation n'est pas exigée) et `pendingEmail` (`string | null`). L'app :
  - affiche un bandeau (`Alert` de `mobile/src/ui/`) sur « Mes listes » et « Mon compte » si `emailVerified` est faux, avec « Renvoyer le lien » (`POST /me/email-verification`) ;
  - désactive « Créer une liste » si `emailVerified` est faux, avec le même message ;
  - ajoute à « Mon compte » une carte repliable « Adresse e-mail » (`CollapsibleCard`, comme la 009), avec l'adresse actuelle, le changement en attente et son annulation, et le formulaire nouvelle adresse et mot de passe ;
  - rafraîchit `/me` au retour au premier plan (`AppState` "active", dans `mobile/src/auth/session.ts`), pour que le bandeau disparaisse après la confirmation faite dans le navigateur.
- **Hors ligne**: les trois nouvelles opérations sont des appels directs (`useServerAction`), pas des entrées de la file. Elles affichent `NetworkNote` hors ligne, comme le changement de mot de passe.
- **Anciennes versions de l'app** (déjà sur les stores) : les champs ajoutés à `Me` sont ignorés. Une création de liste refusée par `emailNotVerified` passe en « rejected » dans la file, avec le message générique. C'est acceptable : seuls les nouveaux comptes sont concernés, et la nouvelle version sort avec la feature.

## R12. E-mails

- **Decision**: trois fonctions dans `src/server/mail.ts` : `sendEmailVerificationMail` (tag `email-verification`), `sendEmailChangeMail` (vers la nouvelle adresse, tag `email-change`) et `sendEmailChangedNoticeMail` (vers l'ancienne, tag `email-changed`, sans lien d'action). `redactMailLogBody` masque aussi les URL des deux premiers tags en production (FR-017). Les textes vont dans `locales/{fr,en}/mail.json` (`verify.*`, `change.*`, `changed.*`).
- **Échec d'envoi**: la demande reste enregistrée. La commande rend `{ ok: true, sent: false }`, et l'écran invite à renvoyer le lien plus tard.

## R13. Limites de débit

- **Decision**: `rateLimitForIp` avec une clé par compte, comme `export:<id>` : `email-verification:<id>` à 5 par heure (FR-006), `email-change:<id>` à 5 par heure, et `confirm-email` par IP à 20 par 15 minutes.

## R14. Parcours e2e de l'app

- **Decision** (révisée le 2026-11-02) : la suite Maestro reçoit les e-mails dans **MailDev**. Le serveur e2e envoie par SMTP (`MAIL_SMTP_URL=smtp://localhost:1025`, variable de dev ignorée en production), la validation y est donc active. `subflows/register.yaml` confirme l'adresse du compte qu'il crée : lien lu dans l'API REST de MailDev (`scripts/maildev-link.js`), ouvert dans le navigateur du simulateur, bouton « Confirmer », retour à l'app sans la relancer. `subflows/register-unconfirmed.yaml` s'arrête avant, pour `010-us1` (rappel, création bloquée puis débloquée), `010-us2` (renvoi, deux liens, le dernier confirme) et `010-us3` (changement en attente, confirmation par la nouvelle adresse, avis à l'ancienne, reconnexion). La commande e2e vérifie MailDev (`E2E_MAILDEV_URL`) et que le serveur envoie ses e-mails, puis vide la boîte. Plus d'exclusion pour la 010.
- **Rationale** : le parcours réel passe par l'e-mail ; MailDev le rend jouable sans Resend ni vraie boîte. Resend ne parle que HTTP, MailDev que SMTP : un transport SMTP de dev (nodemailer, chargé à la demande) fait le lien.
- **Alternatives considered** : serveur e2e sans e-mail et exclusions (première version de cette décision, remplacée par MailDev à la demande du projet) ; un second serveur e2e réservé à la 010 (rejeté : la commande ne gère qu'un serveur) ; Mailpit, qui accepte un envoi HTTP (non retenu : MailDev demandé).
