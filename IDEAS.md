# Idées et bugs

Carnet de bord de l'instance auto-hébergée : bugs constatés, pistes d'amélioration, idées de
fonctionnalités. Rien ici n'est décidé — c'est une liste à trier.

Format d'une entrée : ce qui est observé, puis (quand elle est connue) la cause dans le code et
l'ampleur du changement. `fork` = divergence d'avec le dépôt d'origine, à garder en tête pour les
futures mises à jour.

---

## Ordre de marche

Classement par *rapport valeur / coût / risque*, pas par envie. Trois vagues : d'abord ce qui est
court et sûr, ensuite ce qui touche au schéma et au contrat d'API, enfin les gros morceaux.

### Vague 1 — court, sans migration, à faire en premier

| # | Quoi | Pourquoi d'abord |
|---|---|---|
| 1 | **MAC du déverrouillage de lecture** (`src/auth/read-unlock.ts:15`) | Vrai défaut de sécurité, correction d'une ligne, test évident. Le meilleur rapport du lot. |
| 2 | **B5 — erreurs CSP** | 33 par page. Diagnostic d'abord : soit c'est cosmétique, soit des styles ne s'appliquent pas en production. Tant qu'on ne sait pas, on ne peut pas arbitrer. |
| 3 | **Rejoindre une liste sur un GET** (`app/inviter/[token]/page.tsx:43`) | Effet de bord dans un rendu ; passer par un bouton. Petit et isolé. |
| 4 | **Trous IPv6 du filtre SSRF** (`src/domain/safe-http.ts:52`) | Quelques lignes, entièrement couvrable par des tests purs. |
| 5 | **B4 — doublons de libellés** | Décision produit à trancher, puis quelques lignes. |

Rien là-dedans ne touche au schéma, au contrat d'API ni à l'app mobile : chacun peut partir en
PR séparée sans coordination.

### Vague 2 — friction produit, périmètre maîtrisé

| # | Quoi | Remarque |
|---|---|---|
| 6 | **A1 — alléger la création de liste** | Le plus gros gain ressenti du fichier. Attention : rend `category` et `person` facultatifs dans le contrat et dans l'app mobile, pas seulement sur le site. |
| 7 | **F3 — « l'occasion me va »** | Petite fonctionnalité, mais c'est le **premier aller-retour complet** colonne → migration → contrat → web → mobile → export. À faire avant A2 : elle sert de patron. |
| 8 | **A2 — description sur une idée** | Même mécanique que F3, plus une clé dans le prompt d'enrichissement. Bien moins chère une fois F3 passée. |
| 9 | **Déplacer une idée d'une liste à l'autre** | N'existe pas (vérifié). Manque à l'interface, et bloque tout agent un peu utile (voir F6). Règle de domaine à écrire et à tester. |

### Vague 3 — gros morceaux, une à la fois

| # | Quoi | Remarque |
|---|---|---|
| 10 | **F2 — partage vers l'app mobile** | Indépendant de tout le reste (config Expo + une route). Peut se faire en parallèle. |
| 11 | **F6 — clé d'API, puis MCP** | Livrer **la clé seule d'abord** : déjà utile pour des scripts, et ça ne préjuge pas du MCP. |
| 12 | **F1 — prix et suivi de prix** | L'extraction existe déjà ; c'est le *suivi* (table d'historique, rafraîchissement en tâche de fond) qui est lourd. |
| 13 | **F4 — cadeaux participatifs** | Forme arrêtée (mise en relation, aucun flux d'argent). Reste à trancher la cohabitation avec la réservation. |
| 14 | **F5 — Secret Santa** | De loin le plus gros. Passer par `/speckit-specify`, et **trancher d'abord qui voit quoi** : c'est ça qui dicte le modèle de données. |

### Ce que je ferais ensuite, concrètement

Le **1** (MAC du déverrouillage) : c'est une faille réelle, la correction tient en une ligne et le
test est trivial. Puis le **2** (CSP), parce qu'on ignore encore s'il cache un vrai problème — et
tant qu'on l'ignore, il peut invalider des arbitrages d'interface pris plus tard.

---

## Déjà corrigé (branches poussées sur le fork, aucune PR ouverte)

| Sujet | Branche |
|---|---|
| Crénelage du cadeau du hero sur Firefox (rotation conservée ailleurs) | `fix/hero-gift-aliasing` |
| B1 — dialogue « Modifier l'idée » illisible (requêtes de conteneur) | `fix/item-form-container-queries` |
| Colonne « niveau d'envie » qui écrasait la grille en pleine page | `improve/item-form-priority-column` |
| B2 — toute la carte de « Mes listes » ouvre la liste | `fix/list-card-click-target` |
| B3 — les virgules créent plusieurs catégories / « qui » | `feat/split-labels-on-comma` |

Les deux branches du formulaire touchent la même ligne : chacune s'applique seule sur `main`,
mais les fusionner toutes les deux demande une résolution d'une ligne (réunir les deux jeux de
classes).

---

## Bugs ouverts

### B4 — Rien n'empêche deux « qui » (ou deux catégories) de même nom

**Observé** : depuis la correction de B3, taper `Wilh, Nathan` dans une liste qui a déjà un
`Nathan` donne deux `Nathan`. Ce n'était déjà pas empêché avant (`addPerson` n'a jamais vérifié
les doublons), mais la saisie multiple le rend beaucoup plus facile à déclencher.

**À décider** : ignorer silencieusement un libellé déjà présent (surprenant : on croit l'avoir
ajouté), le refuser avec une erreur, ou le laisser passer comme aujourd'hui. Le dédoublonnage
existe déjà *à l'intérieur* d'une saisie (`splitLabels`), pas contre l'existant.

**Priorité** : basse.

---

### B5 — 33 erreurs CSP à chaque chargement de page

**Observé** : la console du navigateur affiche ~33 fois
`Applying inline style violates the following Content Security Policy directive 'style-src ...'`
sur l'accueil, connecté comme déconnecté.

**Pré-existant** : compté sur `main` et sur nos branches, **33 des deux côtés** — ce n'est pas une
régression de nos changements.

**Pas encore diagnostiqué** : la politique pose pourtant `style-src-attr 'unsafe-inline'`
(`src/server/content-security.ts`), donc l'attribut `style` est censé être autorisé ; le message
pointe `style-src`, ce qui ferait plutôt penser à une feuille ou un élément `<style>` injecté sans
nonce par un composant d'interface (Base UI ?).

**Pourquoi ça compte** : en développement c'est du bruit, mais si un style est réellement refusé,
il ne s'applique pas non plus en production. À qualifier avant de décider quoi que ce soit :
trouver *quel* composant déclenche l'erreur, et si quelque chose casse visuellement.

**Priorité** : à diagnostiquer tôt (vague 1), à corriger selon ce qu'on trouve.

---

## Améliorations d'ergonomie

### A1 — La création de liste demande trop de choses

**Observé** : nom de la liste + catégorie + destinataire sont tous obligatoires
(`createList` renvoie `listNeedsCategory` / `listNeedsPerson`, `src/server/commands/lists.ts:61`).
Trois décisions avant d'avoir vu quoi que ce soit : c'est beaucoup pour un premier contact.

**Proposition** : ne demander que le nom, et donner des valeurs par défaut au reste —
`Divers` (ou `Cadeaux`) pour la catégorie, le nom du compte pour le destinataire. Les deux
restent modifiables dans les réglages de la liste juste après.

**Et si le nom est vide** : au lieu d'une erreur, proposer de continuer avec un nom par défaut —
`Liste de <prénom>`, numérotée s'il en existe déjà une (`Liste de Nathan 2`). Une confirmation
plutôt qu'un blocage.

**Ampleur** : la logique est déjà centralisée dans `createList`, les valeurs par défaut s'y
posent bien. Attention : le contrat `specs/004-mobile-api/contracts/openapi.yaml` rend `category`
et `person` obligatoires, et l'app mobile les envoie — il faut les passer en optionnels des deux
côtés, pas seulement sur le site.

### A2 — Une description facultative sur les idées

**Pourquoi** : laisser au destinataire la place de donner du contexte (« la taille M », « celui
avec la couverture rouge »), ou simplement décrire le produit.

**Lien avec l'IA** : l'enrichissement par URL pourrait la pré-remplir — le prompt
(`src/domain/product-llm.ts:52`) rend déjà `name`, `price`, `imageUrl`, `typeLabel` ; ajouter une
clé `description` est une modification mineure du prompt.

**Ampleur** : nouvelle colonne → migration Drizzle, contrat d'API, formulaire web, écran mobile,
export de compte (`exportAccount` liste les champs un par un, volontairement).

---

## Idées de fonctionnalités

### F1 — Prix et image récupérés depuis l'URL, et suivi du prix

Inspiré de l'app **Droplet**.

**Récupération** : déjà en place côté serveur — `enrichFromUrl` → `fetchPageHtml` +
`extractProductHints` (+ LLM si une clé est configurée). Rien à inventer pour le principe.

**« En local, pas côté serveur »** : réaliste dans l'app mobile (requête native, pas de CORS),
mais **impossible depuis le navigateur** pour le site : une page de boutique ne renvoie pas
d'en-tête CORS, le `fetch` du navigateur est bloqué. Pour le web, ça restera serveur.

**Suivi du prix** : nouvelle idée, plus lourde.
- Un historique = nouvelle table (`item_price_history` : itemId, prix, date), donc migration.
- Rafraîchir « quand quelqu'un ouvre la liste » rend l'affichage dépendant d'un appel réseau
  externe : à faire en arrière-plan, avec un cache et un âge minimum (ex. 6 h), jamais dans le
  rendu de la page.
- Les boutiques bloquent les robots : prévoir l'échec comme cas normal (garder le dernier prix
  connu, ne pas afficher d'erreur).
- Affichage intéressant même avec peu de points : prix le plus bas / le plus haut vus, et une
  pastille « -20 % depuis l'ajout ».
- À surveiller : coût LLM si l'enrichissement est rejoué à chaque rafraîchissement. Pour un
  simple prix, l'extraction sans LLM (`visibleEuroPrice`, JSON-LD `offers`) suffit généralement.

### F2 — Partage vers l'app mobile (« ajouter à une liste » depuis n'importe où)

**Idée** : enregistrer l'app comme cible de partage (Android `ACTION_SEND`, iOS *Share
Extension*). Depuis Amazon, un SMS, un navigateur → « Partager » → l'app s'ouvre sur le choix de
la liste, puis sur l'ajout d'une idée avec le lien déjà rempli.

**Pourquoi c'est la bonne idée** : c'est le geste naturel pour alimenter une liste, et ça
supprime le copier-coller.

**Ampleur** : config Expo (`expo-share-intent` ou un plugin natif), nouvelle route dans Expo
Router, et le reste existe déjà (choix de liste, formulaire, enrichissement par URL).

### F3 — Marquer qu'une idée convient aussi d'occasion

**Idée** : une case « l'occasion me va » sur l'idée (livres, jeux, vinyles…). Affichée sur la page
publique pour guider celui qui offre.

**Ampleur** : un booléen → migration, contrat d'API, formulaire, carte publique, mobile. Petit,
bien cerné. Bon premier ticket.

### F4 — Cadeaux participatifs (cagnotte / achat à plusieurs)

**Idée** : pour les cadeaux chers, permettre à plusieurs personnes de se regrouper au lieu qu'une
seule réserve.

**Difficulté** : le modèle actuel ne s'y prête pas. Une réservation est unique par idée et
l'archive aussitôt (`reserveItem`, `src/domain/reserve.ts:41` refuse `itemAlreadyReserved`, et
`nextItem.archived = true`). Un achat groupé demande un objet distinct : une « participation »
avec N contributeurs, un état (ouvert / complet / abandonné), et la question de savoir qui
coordonne et qui avance l'argent — ce qui dépasse largement le code.

**Suggestion** : commencer par le minimum utile — « je participe » comme simple manifestation
d'intérêt, visible des autres invités, sans montant ni paiement. Ça couvre probablement 80 % du
besoin pour 10 % de la complexité. La partie argent (qui paie, qui rembourse) est un autre sujet,
et un sujet réglementaire dès qu'on touche au paiement.

**Précision retenue** : on déclare vouloir participer, **avec un montant indicatif et un moyen
d'être recontacté** (prénom + e-mail, ou ce que la personne veut y mettre). Les autres visiteurs
de la liste voient qu'une personne cherche à co-offrir et son montant, et se mettent d'accord
entre eux en direct. L'app ne gère que la mise en relation.

C'est la bonne forme : elle règle le problème réglementaire (aucun flux d'argent ne transite,
aucune cagnotte à tenir) et elle évite d'avoir à inventer un état « complet / abandonné ».
Les points à trancher quand même :
- l'idée reste-t-elle visible et réservable pendant qu'une co-participation est ouverte ? (sinon
  on retombe sur le verrou actuel `itemAlreadyReserved`) ;
- le moyen de contact est une donnée personnelle affichée à des inconnus munis du lien de
  lecture : le dire clairement au moment de la saisie, et le couvrir dans la page
  « Données personnelles » ;
- prévoir le retrait d'une participation, et sa purge quand l'idée est réservée ou supprimée.

### F5 — Secret Santa (tirage au sort), utilisable sans compte

**L'idée** : une personne (la seule à avoir un compte) crée un Secret Santa et y ajoute des
participants — juste des prénoms, aucun compte requis. Chaque participant reçoit **un lien
unique**, qu'on lui transmet comme on veut. En ouvrant son lien, il découvre à qui il doit
offrir.

**Le vrai intérêt** : le lien fait office de « compte léger ». Avec lui, un participant peut :
- voir sa personne attribuée ;
- **créer sa propre liste d'envies**, pour que celui qui l'a tiré ait des idées ;
- s'il a déjà un vrai compte, s'y connecter et **choisir quelles listes existantes** partager
  dans ce Secret Santa, ou **rattacher** à son compte la liste créée depuis le lien ;
- revenir plus tard : rouvrir le lien, c'est retrouver son « compte » et ses listes.

**Cycle de vie** : les participants sans compte sont supprimés quand le Secret Santa est
supprimé ou terminé. Une liste rattachée à un vrai compte, elle, survit.

**L'animation** : ouvrir le lien doit être un moment — une ouverture de cadeau facon *lootbox*
qui révèle le nom tiré. Une seule fois ; ensuite le lien affiche directement la page.

**Ce qui est déjà là** : le dépôt a toutes les primitives. Les jetons secrets
(`newSecretToken`, stockés hachés), le partage par lien de lecture, et surtout le modèle
« invité sans compte » avec preuve signée par cookie (`src/auth/reservation-claim.ts`) — un lien
de participant, c'est la même idée avec une durée de vie et un périmètre différents.

**Les parties difficiles, dans l'ordre** :

1. **Le secret, pas l'interface.** Aujourd'hui un membre voit toute la liste. Ici il faut un
   filtrage par participant : personne ne doit pouvoir déduire les autres attributions, ni par
   l'interface, ni par l'API, ni par l'export de compte. À décider aussi : **l'organisateur
   voit-il les attributions ?** S'il participe, il ne devrait pas. C'est ce point qui détermine
   le modèle de données, pas l'écran.
2. **Le tirage.** Il faut une permutation sans point fixe (personne ne se tire soi-même), avec
   idéalement des exclusions (les conjoints ne se tirent pas). Classique, mais à écrire comme
   fonction pure testée dans `src/domain/`, avec un test sur les cas dégénérés (2 participants,
   exclusions impossibles à satisfaire).
3. **Le rattachement d'une liste à un vrai compte.** C'est un transfert de propriété : que
   deviennent les réservations déjà posées, et que se passe-t-il si la même personne ouvre son
   lien sur deux appareils ? À spécifier avant de coder.
4. **« Révélé une seule fois ».** Le cookie seul ne suffit pas : vider ses cookies ou changer
   d'appareil rejouerait l'animation. Stocker l'état `revealed` **côté serveur** sur le
   participant, et ne se servir du cookie que pour ne pas rejouer l'animation dans la session.
5. **Le lien est le mot de passe.** Qui a le lien *est* le participant — même modèle de confiance
   que les liens de lecture actuels, ce qui est cohérent, mais sans récupération possible en cas
   de perte. Prévoir que l'organisateur puisse régénérer le lien d'un participant.
6. **Données personnelles.** Des pseudo-comptes qui stockent des listes nominatives : la page
   « Données personnelles » et la durée de conservation sont à mettre à jour.

**Ampleur** : c'est de loin la plus grosse idée de ce fichier — nouvelles tables, nouveau modèle
d'accès, nouvelles pages, et l'app mobile derrière. À passer par `/speckit-specify` plutôt qu'à
attaquer au jugé, en commençant par trancher le point 1.

**Note d'animation** (leçon du crénelage du hero) : pour la révélation, éviter de faire tourner
de quelques degrés un dessin à arêtes dures et très contrastées — c'est le pire cas et ça
grouille. Une ouverture par échelle, opacité et translation reste nette ; si une rotation est
voulue, un angle franc passe beaucoup mieux qu'un angle faible.

### F6 — Rendre le site pilotable par un agent IA (clé d'API + serveur MCP)

**L'idée** : depuis son compte, on génère **une clé** et on la donne à son agent. L'agent découvre
tout seul ce qu'il peut faire, et on lui parle en langage naturel : « liste ce qu'il y a dans ma
liste Noël », « déplace ce livre vers la liste de Léa », « ajoute ça à une nouvelle liste ».

**Très bonne nouvelle : l'essentiel existe déjà.** Le dépôt a une API JSON complète
(`/api/v1`, 30 chemins), décrite dans un contrat OpenAPI versionné
(`specs/004-mobile-api/contracts/openapi.yaml`), authentifiée par jeton *bearer*, **sans cookie**
— donc sans CSRF à gérer. Et `originDecision` (`src/server/api/http.ts:41`) accepte déjà les
appels sans en-tête `Origin`, ce qui est exactement le cas d'un agent. Le travail n'est pas de
construire une API, c'est de l'emballer.

**Les trois morceaux à faire** :

1. **Une vraie clé d'API, distincte d'une session.** Aujourd'hui un jeton d'API naît d'un
   `login` e-mail + mot de passe, expire au bout de 30 jours et meurt au changement de mot de
   passe (`sessionVersion`). Pour un agent on veut autre chose : une clé **nommée**, **listable**,
   **révocable individuellement**, sans expiration courte, et idéalement **limitée en portée**
   (lecture seule / lecture-écriture). C'est une nouvelle table, proche de `apiSessions` : même
   stockage haché (`hashSecretToken`), mais sans `sessionVersion` et avec un libellé et une date
   de dernière utilisation. Écran de gestion dans « Mon compte ».

2. **Un serveur MCP.** Deux options :
   - *dans l'app Next*, en HTTP streamable sur `/api/mcp` → un seul conteneur à héberger, la clé
     d'API sert d'authentification. C'est la bonne option pour de l'auto-hébergement ;
   - *un paquet séparé* qui appelle l'API REST → plus simple à publier, mais une deuxième chose
     à installer.
   La découverte est native en MCP (`tools/list`) : rien à inventer, l'agent s'informe tout seul.

3. **Une opération qui manque : déplacer une idée d'une liste à l'autre.** Elle n'existe nulle
   part aujourd'hui (vérifié : aucun `moveItem`). Une idée est liée à son `wishlistId`, et sa
   catégorie comme son « qui » doivent appartenir à la même liste — déplacer veut donc dire
   réattribuer, ou recréer, catégorie et destinataire dans la liste d'arrivée, et décider du sort
   d'une réservation existante. C'est une règle de domaine à écrire et à tester, utile bien
   au-delà de l'agent (elle manque aussi à l'interface).

**Points de sécurité à ne pas rater** :
- une clé d'agent est un porteur : elle vaut le compte entier tant qu'elle n'est pas limitée en
  portée. Commencer par exclure du périmètre agent ce qui est destructeur et irréversible
  (suppression de compte, suppression de liste), ou l'enfermer derrière une portée explicite ;
- la limitation de débit est **par IP** et, en production, **refuse** tout appel sans IP de
  confiance (`missingIpPolicy`). Un agent qui appelle depuis la même machine que le serveur n'a
  pas d'IP de confiance : il faut soit que le proxy pose `X-Real-IP`, soit — mieux — limiter
  **par clé** plutôt que par IP pour ce chemin-là ;
- journaliser l'usage (date de dernier appel par clé) pour qu'on puisse repérer une clé qui fuit.

**Ampleur** : moyenne, et bien découpée. La clé d'API seule est déjà utile (scripts, cron,
domotique) et peut être livrée avant le MCP.

---

## Suivi sécurité (audit du 2026-11-01, commit `b62e03c`)

Détail complet dans l'historique de la revue. Aucun backdoor, pas d'injection SQL, pas de XSS,
pas de contournement d'autorisation. À traiter malgré tout :

**Configuration du déploiement** (à faire avant toute mise en ligne) :
- `APP_ORIGIN` **obligatoire** : sans lui, l'origine vient des en-têtes et un attaquant peut
  faire pointer un lien de réinitialisation vers son domaine (vol de jeton → prise de compte).
- `deploy/compose.prod.yml` met par défaut `https://ohyoushouldnt.app` : sans surcharge, les
  liens d'une instance auto-hébergée partent vers le domaine de l'autrice.
- Le proxy doit poser `X-Real-IP` **et** filtrer `CF-Connecting-IP` venant du client, sinon la
  limitation de débit se contourne en changeant un en-tête. Sans IP de confiance en production,
  la connexion est au contraire totalement bloquée (`missingIpPolicy` → `deny`).
- scrypt coûte ~128 Mio par vérification, y compris pour un e-mail inconnu : prévoir ≥ 2 Gio de
  RAM et une limite mémoire sur le conteneur.

**Code** :
- `src/auth/read-unlock.ts:15` — le `iat` n'entre pas dans le HMAC : la durée de 14 jours du
  déverrouillage par mot de passe de lecture n'est pas applicable, la preuve vaut jusqu'au
  changement du mot de passe. Correction d'une ligne (faire comme
  `src/auth/reservation-claim.ts:13`, qui inclut bien le `iat`).
- `src/domain/safe-http.ts:52` — trous IPv6 dans la liste de blocage (`fe81::`…`febf::` en
  partie, `fec0::`, NAT64 `64:ff9b::`, 6to4 `2002::`).
- `app/inviter/[token]/page.tsx:43` — rejoindre une liste est un effet de bord d'un GET, sans
  confirmation.
- Dépendances de production : 0 vulnérabilité. 28 avis en dev uniquement (non embarqués dans
  l'image).

---

## Environnement de test local

- `npm ci`, puis `SESSION_SECRET=<32+ caractères> npm run dev -- --port 3010`.
- Tests de domaine : `node --import tsx --test --test-concurrency=1 tests/domain/*.test.ts`.
  Le `npm test` du dépôt passe le motif entre guillemets et ne trouve **aucun** fichier sous
  Windows (0 test exécuté, sortie verte — trompeur). Développer la liste par le shell.
- `tmp/` est ignoré par git : c'est là que vivent les scripts Playwright de vérification visuelle
  (`tmp/verify-gift.mjs`, `tmp/gift-aliasing-lab.html`, `tmp/serve-lab.mjs`).
- **Une capture d'écran headless ne reproduit pas les artefacts de composition GPU** : elle force
  un nouveau rendu et ressort toujours nette. Pour juger du crénelage, il faut un vrai navigateur.
- Pour figer une animation CSS à un instant précis, utiliser l'API Web Animations
  (`anim.pause(); anim.currentTime = ms`). Un `animation-delay` négatif **décale** la phase d'une
  animation déjà lancée au lieu de la fixer — une mesure faite ainsi lit une image au hasard.
