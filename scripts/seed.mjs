import { connect } from './db.mjs';
const c = await connect();
const { rows:[r] } = await c.query('select fn_demo_reset() as r');
console.log('Jeu de démonstration régénéré :', r.r);
const { rows: demo } = await c.query(
  `select a.email, a.short_code, a.pin, account_balance(a.id) as solde
     from accounts a where a.email like '%@demo.regardplus.fr' and a.email not like 'porteur%'
    order by a.email`);
console.table(demo);
await c.end();
