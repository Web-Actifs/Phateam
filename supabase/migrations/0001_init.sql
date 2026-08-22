-- =====================================================================
-- Regard+ — schéma initial
--
-- DEUX DOMAINES VOLONTAIREMENT DISJOINTS (RGPD art. 9)
--
--   domaine « compte »   : accounts, point_entries, partners, rewards
--   domaine « collecte » : collection_events
--
-- Il n'existe AUCUNE clé étrangère ni identifiant commun entre les deux.
-- `collection_events` ne porte pas d'account_id. Ce n'est pas un oubli :
-- « cette personne porte des lentilles » est une donnée de santé, et un
-- compte identifié portant l'historique des catégories de déchets serait
-- un traitement interdit par principe. NE PAS « réparer » ce schéma en
-- ajoutant la jointure manquante.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- DOMAINE « COMPTE »
-- ---------------------------------------------------------------------

create table accounts (
  id            uuid primary key default gen_random_uuid(),
  email         text        not null unique,
  -- jeton porté par le QR du pass ; rotatif, ne vaut que pour identifier le compte
  account_token uuid        not null unique default gen_random_uuid(),
  -- seconde preuve exigée pour un DÉBIT : sans elle, une capture d'écran
  -- du QR suffirait à dépenser les points d'autrui
  pin           char(4)     not null,
  -- mode dégradé du scanner partenaire : saisie manuelle
  short_code    char(6)     not null unique,
  created_at    timestamptz not null default now()
);

create table partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text not null,
  city        text not null,
  lat         numeric(9,6),
  lng         numeric(9,6),
  -- catégorie grossière reportée dans point_entries.partner_class
  class       text not null default 'optician',
  created_at  timestamptz not null default now()
);

create table rewards (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partners(id) on delete cascade,
  title        text not null,
  description  text,
  cost_points  integer not null check (cost_points > 0),
  created_at   timestamptz not null default now()
);

-- Registre de points EN ÉCRITURE SEULE.
-- Jamais d'UPDATE, jamais de DELETE. Le solde est dérivé (voir account_balance).
create type point_reason as enum ('deposit','redemption','adjustment','expiry');

create table point_entries (
  id              bigint generated always as identity,
  account_id      uuid          not null references accounts(id),
  amount          integer       not null check (amount <> 0),   -- + crédit / − débit
  reason          point_reason  not null,
  eur_value       numeric(10,4) not null default 0,  -- compteur réglementaire
  partner_class   text,                              -- JAMAIS l'identité du partenaire
  idempotency_key text          not null,
  created_at      timestamptz   not null default now(),
  primary key (id, created_at)                       -- created_at dans la PK : partitionnement futur
);

-- Index de la spec : compatible avec un partitionnement par created_at.
create unique index on point_entries (idempotency_key, created_at);

-- AJOUT hors spec, assumé : la contrainte ci-dessus porte sur le COUPLE
-- (clé, horodatage) — deux appels rejouant la même clé à deux instants
-- différents y passeraient tous les deux, ce qui viderait l'idempotence de
-- son sens et casserait le critère de recette « un double-clic ne crédite
-- jamais deux fois ». On ajoute donc l'unicité sur la clé seule.
-- Au moment de partitionner réellement, cet index devra devenir une
-- contrainte par partition + une table de clés dédiée.
create unique index point_entries_idempotency_key_uniq on point_entries (idempotency_key);

create index on point_entries (account_id, created_at desc) include (amount);
create index on point_entries using brin (created_at);

-- ---------------------------------------------------------------------
-- DOMAINE « COLLECTE » — aucun lien vers accounts, par construction
-- ---------------------------------------------------------------------

create table collection_events (
  id             bigint generated always as identity primary key,
  partner_id     uuid        not null references partners(id),
  waste_category text        not null,   -- blister, opercule, étui, flacon…
  weight_grams   integer     not null check (weight_grams > 0),
  occurred_at    timestamptz not null default now()
  -- PAS d'account_id. Volontaire. Voir l'en-tête de ce fichier.
);

create index on collection_events (occurred_at desc);
create index on collection_events (partner_id);

-- ---------------------------------------------------------------------
-- RLS : tout est fermé. Les écritures passent par les routes serveur,
-- qui utilisent la clé service_role (laquelle contourne la RLS).
-- Aucune policy n'est créée : anon et authenticated ne voient rien.
-- ---------------------------------------------------------------------

alter table accounts          enable row level security;
alter table point_entries     enable row level security;
alter table partners          enable row level security;
alter table rewards           enable row level security;
alter table collection_events enable row level security;
