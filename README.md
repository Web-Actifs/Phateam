# Phateam — prototype de démonstration

Recyclage récompensé pour porteurs de lentilles de contact. Les porteurs rapportent
leurs emballages (blisters, opercules, étuis, flacons) chez un opticien partenaire,
gagnent des points, et les dépensent dans ce même réseau.

Prototype destiné à être **montré** à des opticiens et à des investisseurs. Il n'est
ni scalable, ni complet, ni sécurisé pour la production — c'est délibéré.

## Démarrer

```bash
npm install
#  créer .env.local avec les variables du tableau ci-dessous
npm run db:migrate                   # applique supabase/migrations/*.sql
npm run db:seed                      # jeu de démonstration
npm run dev
```

Aucun fichier d'exemple n'est versionné : `.gitignore` exclut tout `.env*` sans
exception, pour qu'une clé collée au mauvais endroit ne parte jamais dans un commit.
`.env.local` attend :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (clé `sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (clé `sb_secret_…`) — **serveur uniquement** |
| `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_HOST`, `SUPABASE_DB_USER` | connexion directe, pour les migrations seules |

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run db:migrate` | applique les migrations non encore appliquées |
| `npm run db:migrate -- --only=0003` | rejoue une migration précise (fonctions `create or replace`) |
| `npm run db:seed` | régénère le jeu de démonstration |
| `npm run db:verify` | éprouve les invariants au niveau Postgres (concurrence réelle) |
| `npm run test:e2e` | éprouve les critères de recette via les routes HTTP (serveur requis) |

## Comptes de démonstration

Le pass s'ouvre aussi bien avec le jeton du QR qu'avec le code à 6 chiffres —
ce dernier **ne change pas** d'un `db:seed` à l'autre, contrairement au jeton.
Utilisez donc ces URL, elles restent valides :

| Compte | URL du pass | Code | PIN | Solde | À quoi il sert |
|---|---|---|---|---|---|
| Nouveau | `/pass/100001` | `100001` | `1111` | 0 pt | montrer les états vides et le premier crédit |
| Actif | `/pass/100002` | `100002` | `2222` | 22 pts | à 3 points d'une récompense — le cas le plus parlant |
| Ancien | `/pass/100003` | `100003` | `3333` | 249 pts | long historique, deux récompenses déjà dépensées |

Les 120 autres porteurs sont anonymes (`porteur001@demo.phateam.fr` …), avec des
codes à partir de `200001`.

## Écrans

| Route | Pour qui |
|---|---|
| `/` | porteur — inscription, un seul champ |
| `/bienvenue/[token]` | porteur — ajout à l'écran d'accueil, puis formulation du plan |
| `/pass/[token]` ou `/pass/[code]` | porteur — le pass : QR, solde, code à 4 chiffres |
| `/console` | partenaire — choix de la boutique |
| `/console/[partnerId]` | partenaire — dépôt et dépense |
| `/impact` | **écran projeté devant les investisseurs** |

`POST /api/demo/reset` remet le jeu de données à zéro ; le bouton est en bas de `/console`.

## Dérouler la démonstration

1. Ouvrir `/impact` sur le vidéoprojecteur — c'est le décor.
2. Sur un téléphone, aller sur `/`, saisir une adresse, dérouler les deux écrans
   d'accueil. Le pass s'ouvre. Compter le temps : moins de 90 secondes.
3. Sur un second appareil (la « tablette du comptoir »), ouvrir `/console`, choisir
   une boutique, saisir le code à 6 chiffres du pass — ou scanner son QR.
4. Choisir 200 g, valider. **Le solde bouge sur le téléphone du client sans qu'il
   touche à rien**, en moins de 3 secondes.
5. Onglet « Dépenser », choisir une récompense, saisir le code à 4 chiffres du pass.
   Se tromper une fois volontairement : le refus est explicite.
6. Revenir sur `/impact` et recharger : les chiffres ont bougé.

## Architecture — les quatre contraintes

Elles viennent d'une analyse juridique et d'échecs documentés. Le détail et le
raisonnement sont dans `CLAUDE.md` ; en bref :

1. **Le solde n'est jamais une colonne.** Il est dérivé de `point_entries`, registre
   en écriture seule. Aucun `UPDATE`, aucun `DELETE` (hors remise à zéro de démo).
2. **Toute écriture de points passe par le serveur**, avec un en-tête
   `Idempotency-Key` obligatoire. Le débit prend un verrou consultatif par compte et
   vérifie le solde dans la même transaction que l'insertion — d'où le fait que la
   logique vive dans des fonctions Postgres et non en TypeScript : le client REST de
   Supabase ne sait pas ouvrir de transaction.
3. **La catégorie de déchet ne touche jamais le compte.** `collection_events` et
   `accounts` n'ont aucune clé étrangère ni identifiant commun. Le barème est fondé
   sur le **poids** et non sur le type d'objet, sans quoi le solde révélerait la
   catégorie et le découplage serait cosmétique. `npm run db:verify` échoue si
   quelqu'un rétablit un jour ce lien.
4. **Les points ne sont ni convertibles ni transférables.** Aucune fonctionnalité
   d'achat, de retrait ou de transfert — elles feraient basculer le dispositif dans le
   régime de la monnaie électronique.

## Écarts assumés par rapport au cahier des charges

- **Le lien magique n'envoie pas d'email.** La saisie de l'adresse ouvre directement
  le pass. Le passage en production consiste à remplacer un appel serveur par
  `supabase.auth.signInWithOtp()`. Raison : l'envoi SMTP par défaut de Supabase est
  limité à quelques messages par heure et peut tomber en indésirables — inutilisable
  pendant une démonstration en direct, où le critère est « moins de 90 secondes ».
- **Un index d'unicité supplémentaire** sur `point_entries (idempotency_key)` seul,
  en plus de celui de la spécification sur `(idempotency_key, created_at)`. Sans lui,
  l'unicité porte sur le couple et deux rejeux à deux instants différents passeraient
  tous les deux. Voir le commentaire dans `0001_init.sql`.
- **Le plan d'intention reste sur l'appareil** (`localStorage`) plutôt qu'en base :
  l'enregistrer reviendrait à noter « cette personne fréquente tel opticien ».

## Déployer sur Vercel

1. `git push` vers un dépôt GitHub.
2. Vercel → **New Project** → importer le dépôt.
3. Renseigner les trois variables d'environnement (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) pour les trois
   environnements (Production, Preview, Development). Les variables `SUPABASE_DB_*`
   ne servent qu'aux migrations locales et sont inutiles en ligne.
4. Déployer. Les migrations sont déjà appliquées sur le projet Supabase distant.

Le build réussit même sans variables d'environnement — aucune page n'interroge la base
au moment du build. C'est à la première requête que l'absence de clé se voit, avec un
message explicite. Si vous ajoutez les variables après un premier déploiement, il faut
**redéployer** : Vercel ne réinjecte pas les variables dans un build existant.

`vercel.json` épingle les fonctions à `dub1` (Dublin). Le projet Supabase est en
`eu-west-1` (Irlande) : sans cela, Vercel place les fonctions à Washington par défaut
et chaque lecture de solde traverse l'Atlantique deux fois. Si vous changez de région
Supabase, changez celle-ci en conséquence.

## Hors périmètre

Vrai pass Apple/Google Wallet · envoi postal de déchets · transfert ou conversion de
points · blockchain · application native · tableau de bord marque · notifications
push · internationalisation · tests exhaustifs · CI/CD.
