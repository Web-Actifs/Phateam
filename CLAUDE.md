@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du dépôt

Application Next.js 16 (App Router) + TypeScript + Tailwind 4, branchée sur un projet
Supabase hébergé (région `eu-west-1`). Les trois parcours et l'écran de démonstration
sont fonctionnels. Voir `README.md` pour les commandes, les comptes de démonstration et
le déroulé de la démonstration. La spécification d'origine reste dans
`PROMPT - Claude Code - prototype.md` et fait autorité sur le périmètre.

Points d'entrée : `src/app/` (écrans et routes API), `src/lib/` (accès aux données),
`supabase/migrations/` (schéma et logique de points), `scripts/` (migrations, seed,
vérifications).

**La logique de points vit dans Postgres, pas dans TypeScript.** `fn_deposit` et
`fn_redeem` (`supabase/migrations/0002_functions.sql`) portent l'idempotence et le
verrou de débit, parce que le client REST de Supabase ne sait pas ouvrir de transaction
multi-requêtes et que le débit exige verrou + lecture du solde + insertion dans la même
transaction. Les routes `src/app/api/{deposit,redeem}/route.ts` ne font que valider
l'entrée, appeler la fonction en RPC avec la clé `service_role`, et traduire les erreurs
métier en messages lisibles au comptoir.

**Deux jeux de tests, à relancer après toute modification du schéma ou des routes :**
`npm run db:verify` (invariants au niveau Postgres, concurrence réelle sur deux
connexions) et `npm run test:e2e` (critères de recette via les routes HTTP, serveur de
développement requis). Le second réinitialise le jeu de démonstration en sortant.

Les migrations sont suivies dans la table `schema_migrations`. `0001_init.sql` crée les
tables et ne peut pas être rejouée ; les autres ne contiennent que des
`create or replace function` et se rejouent avec `npm run db:migrate -- --only=0003`.

## Contraintes d'architecture non négociables

Ces quatre points viennent d'une analyse juridique et d'échecs documentés. Ne pas les
simplifier ; si l'une paraît inutilement compliquée, **le signaler à l'utilisateur
plutôt que la contourner**.

### 1. Le solde n'est jamais une colonne

Pas de `points_balance`, pas d'`UPDATE ... SET points_balance = ...`. Le solde est
dérivé d'un registre **append-only** `point_entries` (INSERT uniquement) :
`select coalesce(sum(amount),0) from point_entries where account_id = $1`, exposé par la
fonction `account_balance()`. Le seul `DELETE`/`TRUNCATE` du dépôt est dans
`fn_demo_reset()`, qui n'aurait pas d'équivalent en production.

### 2. Toute écriture de points passe par le serveur, avec idempotence

Jamais depuis le navigateur, même avec RLS — la RLS est fermée sur toutes les tables et
aucune policy n'existe, donc `anon` ne peut rien lire ni écrire. Chaque appel à
`POST /api/deposit` et `POST /api/redeem` porte un en-tête `Idempotency-Key` (UUID v4
fabriqué **une fois par intention**, côté client, pas à chaque clic). Le débit prend
`pg_advisory_xact_lock(hashtext(account_id::text))` et vérifie le solde dans la même
transaction que l'insertion. Erreur métier : `INSUFFICIENT_BALANCE`.

### 3. Deux domaines strictement disjoints (RGPD art. 9)

« Porte des lentilles de contact » est une donnée de santé. Le domaine **compte**
(`accounts`, `point_entries`, `partners`, `rewards`) et le domaine **collecte**
(`collection_events`) n'ont **ni clé étrangère ni identifiant commun** ;
`collection_events` ne contient aucun `account_id`. L'absence de jointure est
intentionnelle — ne pas « rajouter la clé étrangère oubliée ». `npm run db:verify`
échoue si quelqu'un la rétablit.

Corollaire : le barème est fondé sur le **poids** (`points_for_weight`, 1 point par
tranche de 10 g), jamais sur le type d'objet. Si « lentilles = 12 points » était le seul
item à 12 points, le solde révélerait la catégorie et le découplage deviendrait
cosmétique. Le compteur d'impact du pass se calcule à partir des seuls points crédités,
sans jamais interroger `collection_events`.

### 4. Points non convertibles et non transférables

Aucun achat de points, retrait, conversion en euros, ni transfert entre utilisateurs —
ces fonctions feraient basculer le dispositif dans le régime de la monnaie électronique
(agrément bancaire requis).

## Surfaces

- **Pass porteur** (`/pass/[token]` ou `/pass/[code6]`) — plein écran, manifeste PWA en
  `standalone`. Le solde est scruté toutes les 2,5 s pour bouger pendant que le
  partenaire valide sur son propre appareil.
- **Console partenaire** (`/console/[partnerId]`) — scan caméra (`jsQR`) avec **mode
  dégradé obligatoire** (code à 6 chiffres, toujours visible, jamais replié). Le crédit
  se fait au seul scan ; le **débit exige en plus le code à 4 chiffres** du pass.
- **Inscription** (`/`) puis `/bienvenue/[token]` — email seul, **aucune question sur
  l'équipement optique**, puis écran d'intention de mise en œuvre.
- **`/impact`** — page publique projetée devant les investisseurs.
- **`POST /api/demo/reset`** — remise à zéro entre deux démonstrations.

## Direction artistique

L'apparence est un critère de recette, pas une finition. Registre optique / santé
visuelle : beaucoup de blanc, typographie éditoriale (Instrument Serif) pour les grands
chiffres, **une seule couleur d'accent** (`--color-ink`, `#1b3a6b`). Éviter le vert
écologie saturé, les feuilles, les icônes de planète. Mobile d'abord, testé à 390 px.
Le crédit de points a droit à son animation. Pas de mode sombre, pas de réglages.

## Hors périmètre

Vrai pass Apple/Google Wallet · envoi postal de déchets · transfert ou conversion de
points · blockchain · application native · tableau de bord marque · notifications push ·
i18n · tests exhaustifs · CI/CD.
