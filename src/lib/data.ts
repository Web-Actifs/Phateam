import "server-only";
import { supabaseAdmin } from "./supabase";

export type Partner = {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
};

export type Reward = {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  cost_points: number;
};

export type Account = {
  id: string;
  email: string;
  account_token: string;
  pin: string;
  short_code: string;
};

export async function listPartners(): Promise<Partner[]> {
  const { data, error } = await supabaseAdmin()
    .from("partners")
    .select("id,name,address,city,lat,lng")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPartner(id: string): Promise<Partner | null> {
  const { data } = await supabaseAdmin()
    .from("partners")
    .select("id,name,address,city,lat,lng")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function listRewards(partnerId: string): Promise<Reward[]> {
  const { data, error } = await supabaseAdmin()
    .from("rewards")
    .select("id,partner_id,title,description,cost_points")
    .eq("partner_id", partnerId)
    .order("cost_points");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Résout un compte depuis le jeton du QR ou le code à 6 chiffres. */
export async function findAccount(ref: string): Promise<Account | null> {
  const db = supabaseAdmin();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  const { data } = await db
    .from("accounts")
    .select("id,email,account_token,pin,short_code")
    .eq(isUuid ? "account_token" : "short_code", ref.trim())
    .maybeSingle();
  return data ?? null;
}

/**
 * Les trois comptes de démonstration nommés, dans un ordre parlant :
 * du compte vide au compte chargé. Les 120 porteurs anonymes sont exclus.
 */
export async function listDemoAccounts() {
  const { data } = await supabaseAdmin()
    .from("accounts")
    .select("id,email,account_token,pin,short_code")
    .in("email", [
      "nouveau@demo.regardplus.fr",
      "actif@demo.regardplus.fr",
      "ancien@demo.regardplus.fr",
    ]);

  const order = ["nouveau@", "actif@", "ancien@"];
  const sorted = (data ?? []).sort(
    (a, b) =>
      order.findIndex((p) => a.email.startsWith(p)) -
      order.findIndex((p) => b.email.startsWith(p)),
  );

  return Promise.all(
    sorted.map(async (a) => ({ ...a, balance: await getBalance(a.id) })),
  );
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  const { data } = await supabaseAdmin()
    .from("accounts")
    .select("id,email,account_token,pin,short_code")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  return data ?? null;
}

/**
 * Le solde est TOUJOURS dérivé du registre, jamais lu dans une colonne.
 * Il n'existe pas de `accounts.points_balance` — et il ne doit pas en exister.
 */
export async function getBalance(accountId: string): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("account_balance", {
    p_account_id: accountId,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export type LedgerRow = {
  amount: number;
  reason: string;
  created_at: string;
};

/**
 * Historique du compte. Il ne contient que des montants et des dates :
 * aucune catégorie de déchet, aucune identité de partenaire. C'est
 * précisément ce que la contrainte n°3 impose.
 */
export async function getLedger(accountId: string, limit = 12): Promise<LedgerRow[]> {
  const { data } = await supabaseAdmin()
    .from("point_entries")
    .select("amount,reason,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Prochaine récompense atteignable, tous partenaires confondus. */
export async function nextReward(balance: number) {
  const { data } = await supabaseAdmin()
    .from("rewards")
    .select("title,cost_points")
    .gt("cost_points", balance)
    .order("cost_points")
    .limit(1);
  const r = data?.[0];
  if (!r) return null;
  return { title: r.title, cost: r.cost_points, missing: r.cost_points - balance };
}

/** Récompense la plus chère déjà accessible avec ce solde. */
export async function affordableReward(balance: number) {
  const { data } = await supabaseAdmin()
    .from("rewards")
    .select("title,cost_points")
    .lte("cost_points", balance)
    .order("cost_points", { ascending: false })
    .limit(1);
  const r = data?.[0];
  return r ? { title: r.title, cost: r.cost_points } : null;
}
