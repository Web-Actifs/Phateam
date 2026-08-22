/**
 * Parcours de recette, à travers les routes HTTP réelles.
 *
 * verify.mjs éprouve les fonctions Postgres ; celui-ci éprouve ce que le
 * navigateur appelle vraiment. Le serveur de développement doit tourner.
 */
import { connect } from './db.mjs';
import crypto from 'crypto';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let fails = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

const post = (path, body, key) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

const c = await connect();
const { rows: [partner] } = await c.query('select id from partners limit 1');
const { rows: [reward] }  = await c.query('select id, cost_points from rewards where cost_points = 15 limit 1');
const REF = '100001'; // compte de démonstration « nouveau », solde 0
const PIN = '1111';

const balance = async () => {
  const { rows: [r] } = await c.query(
    'select account_balance(id) b from accounts where short_code = $1', [REF]);
  return r.b;
};

console.log(`Solde de départ : ${await balance()}\n`);

// --- 1. en-tête d'idempotence obligatoire ---------------------------
{
  const r = await post('/api/deposit', { accountRef: REF, partnerId: partner.id, weightGrams: 100 });
  check(r.status === 400 && r.body.error === 'IDEMPOTENCY_KEY_REQUIRED',
    'Dépôt sans Idempotency-Key refusé', `HTTP ${r.status}`);
}

// --- 2. double-clic : deux requêtes simultanées, même clé -----------
{
  const before = await balance();
  const key = crypto.randomUUID();
  const payload = { accountRef: REF, partnerId: partner.id, weightGrams: 200, wasteCategory: 'blister' };
  const [a, b] = await Promise.all([post('/api/deposit', payload, key), post('/api/deposit', payload, key)]);
  const after = await balance();

  check(a.status === 200 && b.status === 200, 'Double-clic : les deux requêtes répondent 200');
  check(after - before === 20, 'Double-clic : +20 points une seule fois', `${before} → ${after}`);
  check([a, b].filter((r) => r.body.replayed).length === 1,
    'Double-clic : exactement une réponse marquée « rejouée »');
}

// --- 3. clé différente = nouveau dépôt ------------------------------
{
  const before = await balance();
  const r = await post('/api/deposit',
    { accountRef: REF, partnerId: partner.id, weightGrams: 100, wasteCategory: 'étui' },
    crypto.randomUUID());
  const after = await balance();
  check(r.status === 200 && after - before === 10, 'Nouvelle clé : le dépôt suivant crédite bien',
    `${before} → ${after}`);
}

// --- 4. dépense avec un mauvais code à 4 chiffres --------------------
{
  const r = await post('/api/redeem',
    { accountRef: REF, pin: '0000', rewardId: reward.id }, crypto.randomUUID());
  check(r.status === 403 && r.body.error === 'INVALID_PIN',
    'Mauvais code à 4 chiffres refusé', `HTTP ${r.status} · ${r.body.message}`);
}

// --- 5. dépense supérieure au solde ---------------------------------
{
  const { rows: [big] } = await c.query(
    'select id, cost_points from rewards order by cost_points desc limit 1');
  const bal = await balance();
  const r = await post('/api/redeem',
    { accountRef: REF, pin: PIN, rewardId: big.id }, crypto.randomUUID());
  const expected = bal < big.cost_points;
  check(!expected || (r.status === 409 && r.body.error === 'INSUFFICIENT_BALANCE'),
    'Débit supérieur au solde refusé proprement',
    `solde ${bal}, récompense ${big.cost_points} · HTTP ${r.status} · ${r.body.message ?? ''}`);
  check(await balance() === bal, 'Le solde est inchangé après un refus');
}

// --- 6. dépense valide ------------------------------------------------
{
  const before = await balance();
  const r = await post('/api/redeem',
    { accountRef: REF, pin: PIN, rewardId: reward.id }, crypto.randomUUID());
  const after = await balance();
  check(r.status === 200 && before - after === reward.cost_points,
    'Dépense valide débitée une fois', `${before} → ${after}`);
}

// --- 7. le solde ne descend jamais sous zéro -------------------------
{
  const bal = await balance();
  check(bal >= 0, 'Solde final positif ou nul', `solde = ${bal}`);
}

// --- 8. étanchéité : rien ne relie ce compte à une catégorie ---------
{
  const { rows } = await c.query(`
    select column_name from information_schema.columns
     where table_name = 'point_entries'`);
  const cols = rows.map((r) => r.column_name);
  check(!cols.some((c) => /categor|waste|partner_id/.test(c)),
    'point_entries reste dépourvu de catégorie et d\'identité partenaire',
    cols.join(', '));
}

await c.end();

// Remise à zéro pour laisser la démonstration propre.
await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
console.log('\nJeu de démonstration réinitialisé.');
console.log(fails === 0 ? '✅ Parcours de recette complet.' : `❌ ${fails} échec(s).`);
process.exit(fails === 0 ? 0 : 1);
