import { createClient } from "@supabase/supabase-js";
import "server-only";

/**
 * Client serveur, porteur de la clé secrète.
 *
 * La RLS est fermée sur toutes les tables et aucune policy n'est définie :
 * le navigateur ne peut donc rien lire ni écrire directement. Tout passe
 * par ici, c'est-à-dire par du code serveur. C'est la contrainte n°2 —
 * un crédit de points est une opération à valeur, elle se valide côté
 * serveur, jamais dans le navigateur même avec RLS.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env.local",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
