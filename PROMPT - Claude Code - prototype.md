# Prompt pour Claude Code — prototype de démonstration

> **Mode d'emploi :** donne ce fichier entier à Claude Code en début de session (`@PROMPT - Claude Code - prototype.md` ou copier-coller). Il est auto-portant : Claude Code n'a pas besoin du cahier des charges.

---

## Ce qu'on construit

Un **prototype de démonstration déployé** pour une application de recyclage récompensé. Les porteurs de lentilles de contact rapportent leurs déchets d'emballage (blisters, opercules, étuis, flacons de solution) chez un opticien partenaire, gagnent des points, et les dépensent chez ce même réseau de partenaires.

**Ce prototype sera montré à des opticiens et à des investisseurs.** Il doit être fluide et soigné visuellement — pas un template SaaS générique, pas un exercice d'étudiant. En revanche il n'a pas à être scalable, ni complet, ni sécurisé pour la production. Optimise pour la démonstration, pas pour la charge.

**Trois parcours doivent fonctionner de bout en bout**, plus un écran de démonstration.

---

## Stack imposée

- **Next.js** (App Router) + TypeScript + Tailwind
- **Supabase** (PostgreSQL) — base et authentification
- **Vercel** — déploiement, URL publique partageable
- Pas de librairie de composants lourde. Tailwind et quelques composants maison suffisent.

Si les comptes Supabase et Vercel ne sont pas encore créés, **commence par écrire le code et fais tourner en local avec Supabase CLI**, puis donne-moi la marche à suivre exacte pour déployer. Ne bloque pas sur la création des comptes.

---

## Les quatre contraintes d'architecture — non négociables

Ces quatre points viennent d'une analyse juridique et d'un retour d'expérience sur des dispositifs comparables qui ont échoué. **Ils ne sont pas des préférences de style. Si tu es tenté de les simplifier, ne le fais pas — demande-moi d'abord.**

### 1. Le solde de points n'est JAMAIS une colonne

Interdit : `users.points_balance` et `UPDATE ... SET points_balance = points_balance + 10`.

Le solde est **dérivé d'un registre en écriture seule**. On n'y fait jamais d'UPDATE ni de DELETE, uniquement des INSERT.

```sql
create type point_reason as enum ('deposit','redemption','adjustment','expiry');

create table point_entries (
  id              bigint generated always as identity,
  account_id      uuid          not null references accounts(id),
  amount          integer       not null check (amount <> 0),   -- + crédit / − débit
  reason          point_reason  not null,
  eur_value       numeric(10,4) not null default 0,  -- valeur en euros, pour un compteur réglementaire
  partner_class   text,                              -- catégorie grossière, JAMAIS l'identité du partenaire
  idempotency_key text          not null,
  created_at      timestamptz   not null default now(),
  primary key (id, created_at)                       -- created_at dans la PK : partitionnement futur
);

create unique index on point_entries (idempotency_key, created_at);
create index on point_entries (account_id, created_at desc) include (amount);
create index on point_entries using brin (created_at);

alter table point_entries enable row level security;
```

Le solde se calcule à la volée : `select coalesce(sum(amount),0) from point_entries where account_id = $1`. À l'échelle de ce prototype c'est instantané, exact, et auditable.

### 2. Toute écriture de points passe par le serveur, avec idempotence

Jamais depuis le navigateur, même avec RLS. Un crédit de points est une opération à valeur : elle se valide côté serveur.

- Routes serveur : `POST /api/deposit`, `POST /api/redeem`
- Chaque appel porte un en-tête `Idempotency-Key` (UUID v4 généré par le client). **Un partenaire qui double-clique parce que le réseau rame ne doit jamais créditer deux fois.**
- **Le débit prend un verrou transactionnel par compte** : `select pg_advisory_xact_lock(hashtext(account_id::text))`, puis vérification du solde **dans la même transaction** que l'insertion. Sans ça, deux débits simultanés peuvent passer le solde en négatif. Retourne une erreur métier `INSUFFICIENT_BALANCE`.

### 3. La catégorie de déchet ne touche JAMAIS le compte utilisateur

Contrainte RGPD : « cette personne porte des lentilles de contact » est une **donnée de santé** au sens de l'article 9 — le cas est littéralement nommé dans la doctrine européenne. Un compte identifié portant l'historique des catégories de déchets est un traitement interdit par principe.

Concrètement, deux domaines **sans clé étrangère ni identifiant commun** :

| Domaine « compte » | Domaine « collecte » |
|---|---|
| `accounts`, `point_entries`, `partners` | `collection_events` (catégorie, poids, partenaire, horodatage) |
| Reçoit **un nombre de points** | Ne contient **aucun `account_id`** |

**Ne « rajoute pas la clé étrangère oubliée ».** Elle est absente exprès. Si tu as besoin d'un rapprochement pour la démo, fais-le dans une table de journal séparée, clairement nommée, avec un commentaire expliquant qu'elle est à rétention courte en production.

**Piège subtil à éviter dans le barème** : si « lentilles = 12 points » est le seul item valant 12 points, le solde révèle à lui seul la catégorie et le découplage devient cosmétique. **Fonde donc le barème sur le poids**, pas sur le type d'objet.

### 4. Les points ne sont ni convertibles en euros, ni transférables entre utilisateurs

Ne construis aucune fonctionnalité d'achat de points, de retrait, de conversion, ni de transfert d'un utilisateur à un autre. Ce n'est pas une question de périmètre : ces trois fonctionnalités feraient basculer le dispositif dans le régime de la monnaie électronique, qui exige un agrément bancaire.

---

## Les trois parcours à construire

### Parcours 1 — Inscription (côté porteur, mobile)

1. Arrivée par QR code ou lien → page web, **aucune application à télécharger**
2. Saisie de l'email uniquement. **Pas de mot de passe** : lien magique via Supabase Auth
3. **Aucune question sur l'équipement optique de l'utilisateur.** Jamais.
4. Écran « ajouter à mon écran d'accueil » → c'est le pass simulé (voir plus bas)
5. Un dernier écran fait formuler un plan : « **Si** je passe chez [partenaire] pour ma prochaine commande, **alors** j'apporte ma boîte. » Choix d'un lieu et d'un moment, puis confirmation. C'est une mécanique documentée d'intention de mise en œuvre, pas du remplissage — garde-la.

### Parcours 2 — Le dépôt (côté partenaire, tablette ou téléphone de comptoir)

**Zéro ouverture d'application côté client.** Le partenaire scanne le QR du client depuis sa propre console web.

- Scanner par caméra web (`getUserMedia` + une lib de décodage QR légère)
- **Mode dégradé obligatoire** : saisie manuelle d'un code à 6 chiffres si le scan échoue. Un scanner qui plante devant un client tue l'adoption.
- Saisie du **poids en grammes** (gros boutons : 50 / 100 / 200 / 500 g, plus une saisie libre)
- Confirmation en moins de 10 secondes, du scan au message de succès
- Le solde du client se met à jour immédiatement

### Parcours 3 — Dépenser ses points (côté partenaire)

Même console, onglet différent. Scan du QR, choix d'une récompense dans le catalogue du partenaire, débit.

**Le débit exige une seconde preuve** — un code à 4 chiffres affiché sur le pass du client, que le partenaire saisit. Sans ça, une capture d'écran du QR suffirait à dépenser les points d'autrui. Le crédit, lui, peut se faire au seul scan.

### Le pass simulé (côté porteur)

Une page web plein écran, ajoutable à l'écran d'accueil (manifeste PWA, mode standalone) :

- Grand QR code contenant un jeton de compte
- **Solde en très gros** — c'est l'information principale
- Le code à 4 chiffres pour autoriser un débit, discret sous le QR
- Prochaine récompense atteignable et ce qu'il manque
- Un compteur d'impact personnel

Ce n'est pas un vrai pass Apple/Google Wallet — c'est délibéré, on teste le concept avant d'investir dans les certificats. **Mais ça doit en donner l'impression :** plein écran, sans navigation, sans chrome de navigateur.

### L'écran de démonstration (pour les investisseurs)

Une page publique `/impact` avec les chiffres agrégés du réseau : partenaires actifs, dépôts, poids collecté, équivalent en emballages détournés du tout-venant, progression dans le temps. Un ou deux graphiques élégants. **C'est cet écran qui sera projeté — soigne-le particulièrement.**

Prévois aussi une route `/api/demo/reset` qui remet le jeu de données de démonstration à zéro, pour pouvoir refaire la démo proprement.

---

## Direction artistique

L'exigence est explicite : **ça doit avoir de la gueule.** Ce prototype passe devant des investisseurs.

- **Registre visuel** : optique et santé visuelle, pas « startup verte ». Évite le vert écologie saturé, les feuilles, les icônes de planète — c'est le cliché du secteur et ça fait amateur. Cherche plutôt du calme, de la précision, de la clarté : beaucoup de blanc, une typographie soignée, une seule couleur d'accent affirmée.
- **Mobile d'abord, vraiment.** Le parcours porteur sera montré sur un téléphone tenu en main. Teste à 390 px de large.
- **Le mouvement compte.** Le crédit de points mérite une animation satisfaisante — c'est le moment de récompense, c'est ce dont les gens se souviennent après la démo.
- **Soigne les états vides et les transitions.** C'est ce qui sépare un prototype crédible d'une maquette.
- Pas de mode sombre, pas de personnalisation, pas de réglages. Chaque écran superflu dilue la démonstration.

---

## Données de démonstration

Un script de seed qui crée :

- **8 partenaires fictifs** avec adresses réelles dans une même ville (prends Lyon ou Bordeaux — la densité locale fait partie du pitch). **Invente les noms d'enseigne** : n'utilise aucune enseigne réelle existante, ni son nom ni son style.
- **Un catalogue de récompenses crédible** : produit d'entretien offert, remise sur une paire de lunettes de soleil, étui, don à une association. Des seuils atteignables en 1 ou 2 dépôts — jamais un palier lointain.
- **Environ 120 comptes** avec un historique de dépôts étalé sur 8 mois, pour que l'écran d'impact ait une courbe qui monte de façon plausible plutôt qu'une ligne droite.
- **Trois comptes de démonstration nommés et documentés** dans le README : un nouveau (solde nul), un actif (proche d'une récompense), un ancien (long historique).

---

## Explicitement hors périmètre

Ne construis pas : vrai pass Apple ou Google Wallet · envoi postal de déchets · transfert de points entre utilisateurs · conversion des points en euros · blockchain ou tokenisation · application native · tableau de bord marque · notifications push · internationalisation · tests exhaustifs · CI/CD.

---

## Critères d'acceptation

Le prototype est terminé quand :

1. Je peux m'inscrire sur mon téléphone en moins de 90 secondes, sans télécharger d'application
2. Je peux ajouter le pass à mon écran d'accueil et le rouvrir en plein écran
3. Depuis un second appareil jouant le partenaire, je peux scanner mon QR et créditer un dépôt — le solde bouge en moins de 10 secondes
4. Je peux dépenser des points, avec le code à 4 chiffres exigé
5. Un double-clic sur « valider » ne crédite **jamais** deux fois
6. Un débit supérieur au solde est refusé proprement, avec un message clair
7. La table `point_entries` ne contient **aucune** trace de la catégorie de déchet, et aucune requête ne peut relier un compte à une catégorie
8. L'écran `/impact` est projetable tel quel devant une salle
9. Le tout est déployé sur une URL publique que je peux envoyer par SMS

---

## Comment travailler

- **Commence par le schéma de base de données et les deux routes serveur** (`deposit`, `redeem`), avec les contraintes ci-dessus. Vérifie l'idempotence et le verrou de débit avant de toucher à l'interface. C'est la seule partie qu'on ne peut pas rattraper après coup.
- Ensuite le parcours partenaire, puis le pass, puis l'inscription, puis l'écran d'impact.
- **Montre-moi l'interface tôt et souvent** — captures d'écran ou URL de préversion. Sur ce projet, l'apparence est un critère de recette, pas une finition.
- Si une contrainte de la section « non négociables » te paraît compliquer inutilement les choses : **dis-le-moi, ne la contourne pas**. Chacune vient d'un échec documenté ou d'une analyse juridique.
