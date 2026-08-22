import fs from 'fs';
import path from 'path';
import { connect } from './db.mjs';

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const client = await connect();

await client.query(`
  create table if not exists schema_migrations (
    filename   text primary key,
    applied_at timestamptz not null default now()
  )`);

const { rows } = await client.query('select filename from schema_migrations');
const done = new Set(rows.map(r => r.filename));

// --force rejoue tout ; --only=<fragment> ne rejoue que les fichiers dont le
// nom contient ce fragment. Utile pour les migrations qui ne contiennent que
// des `create or replace function`, idempotentes par nature — contrairement
// à 0001, qui crée les tables et échouerait à être rejouée.
const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

let applied = 0;
for (const f of files) {
  if (only && !f.includes(only)) continue;
  if (done.has(f) && !force && !only) { console.log(`· ${f} (déjà appliquée)`); continue; }
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  process.stdout.write(`→ ${f} ... `);
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query(
      `insert into schema_migrations (filename) values ($1)
       on conflict (filename) do update set applied_at = now()`, [f]);
    await client.query('commit');
    console.log('OK');
    applied++;
  } catch (e) {
    await client.query('rollback');
    console.log(`ÉCHEC\n   ${e.message}`);
    await client.end();
    process.exit(1);
  }
}
await client.end();
console.log(applied ? `\n${applied} migration(s) appliquée(s).` : '\nRien à appliquer.');
