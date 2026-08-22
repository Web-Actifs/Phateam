// Vérification des invariants critiques, AVANT de construire l'interface.
// Ces trois propriétés ne se rattrapent pas après coup.
import { connect } from './db.mjs';
import crypto from 'crypto';

const c = await connect();
const c2 = await connect();          // seconde connexion : concurrence réelle
let fails = 0;
const check = (ok, label, detail='') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

// --- jeu d'essai ---------------------------------------------------
const { rows:[partner] } = await c.query(
  `insert into partners (name, address, city) values ('TEST Optique','1 rue du Test','Bordeaux') returning id`);
const { rows:[acc] } = await c.query(
  `insert into accounts (email, pin, short_code) values ($1,'1234','TST001') returning id, account_token`,
  [`test-${Date.now()}@example.test`]);
const { rows:[rw] } = await c.query(
  `insert into rewards (partner_id, title, cost_points) values ($1,'Récompense test',15) returning id`,
  [partner.id]);

const tok = acc.account_token;

// --- 1. Double-clic : même clé d'idempotence, deux appels simultanés -
{
  const key = crypto.randomUUID();
  const call = (cli) => cli.query(
    `select fn_deposit($1,$2,$3,$4,$5) as r`, [tok, partner.id, 200, 'blister', key]);
  const [a, b] = await Promise.allSettled([call(c), call(c2)]);
  const ok = [a,b].filter(x => x.status==='fulfilled');
  const bal = (await c.query('select account_balance($1) b',[acc.id])).rows[0].b;
  const ev  = (await c.query('select count(*)::int n from collection_events where partner_id=$1',[partner.id])).rows[0].n;
  const entries = (await c.query('select count(*)::int n from point_entries where idempotency_key=$1',[key])).rows[0].n;

  check(entries === 1, 'Double-clic : une seule entrée de points', `${entries} entrée(s)`);
  check(bal === 20,    'Double-clic : solde crédité une seule fois', `solde = ${bal} (attendu 20)`);
  check(ev === 1,      'Double-clic : un seul événement de collecte', `${ev} événement(s)`);
  check(ok.length === 2, 'Double-clic : les deux appels répondent sans erreur');
}

// --- 2. Verrou : deux débits simultanés > solde ----------------------
{
  const call = (cli) => cli.query(
    `select fn_redeem($1,'1234',$2,$3) as r`, [tok, rw.id, crypto.randomUUID()]);
  const [a, b] = await Promise.allSettled([call(c), call(c2)]);
  const okCount = [a,b].filter(x => x.status==='fulfilled').length;
  const insuff  = [a,b].filter(x => x.status==='rejected' && /INSUFFICIENT_BALANCE/.test(x.reason.message)).length;
  const bal = (await c.query('select account_balance($1) b',[acc.id])).rows[0].b;

  check(okCount === 1, 'Débits concurrents : un seul passe', `${okCount} réussi(s)`);
  check(insuff === 1,  'Débits concurrents : l\'autre reçoit INSUFFICIENT_BALANCE');
  check(bal >= 0,      'Le solde ne passe JAMAIS négatif', `solde = ${bal} (attendu 5)`);
  check(bal === 5,     'Solde exact après un seul débit de 15', `solde = ${bal}`);
}

// --- 3. Débit sans le code à 4 chiffres ------------------------------
{
  const r = await c.query(`select fn_redeem($1,'9999',$2,$3) as r`, [tok, rw.id, crypto.randomUUID()])
    .then(()=>'passé').catch(e => e.message);
  check(/INVALID_PIN/.test(r), 'Débit refusé si le code à 4 chiffres est faux', r.slice(0,40));
}

// --- 4. Étanchéité des deux domaines (RGPD art. 9) -------------------
{
  const cols = await c.query(
    `select column_name from information_schema.columns
      where table_name='collection_events' and column_name like '%account%'`);
  check(cols.rowCount === 0, 'collection_events ne porte aucune colonne de compte');

  const fks = await c.query(
    `select 1 from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.table_name='collection_events' and tc.constraint_type='FOREIGN KEY'
        and ccu.table_name in ('accounts','point_entries')`);
  check(fks.rowCount === 0, 'Aucune clé étrangère de collection_events vers le domaine compte');

  const cat = await c.query(
    `select column_name from information_schema.columns
      where table_name='point_entries'
        and column_name in ('waste_category','category','partner_id')`);
  check(cat.rowCount === 0, 'point_entries ne porte ni catégorie de déchet ni identité de partenaire');
}

// --- nettoyage (seul endroit où un DELETE sur le registre est toléré :
//     compte de test, jamais un compte réel) ---------------------------
await c.query('delete from point_entries where account_id=$1',[acc.id]);
await c.query('delete from collection_events where partner_id=$1',[partner.id]);
await c.query('delete from rewards where partner_id=$1',[partner.id]);
await c.query('delete from accounts where id=$1',[acc.id]);
await c.query('delete from partners where id=$1',[partner.id]);

await c.end(); await c2.end();
console.log(fails === 0 ? '\n✅ Tous les invariants tiennent.' : `\n❌ ${fails} vérification(s) en échec.`);
process.exit(fails === 0 ? 0 : 1);
