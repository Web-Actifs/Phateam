import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { businessError, unexpected } from "@/lib/api-errors";

/**
 * POST /api/deposit — crédit de points contre un dépôt d'emballages.
 *
 * Se fait au seul scan du QR : pas de code à 4 chiffres. Créditer le
 * compte de quelqu'un d'autre par erreur est sans gravité ; le débiter
 * ne l'est pas. Le PIN n'est donc exigé que sur /api/redeem.
 *
 * L'en-tête Idempotency-Key est OBLIGATOIRE. Un partenaire qui
 * double-clique parce que le réseau rame ne doit jamais créditer deux
 * fois : le second appel renvoie le même résultat avec replayed = true.
 */
export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "IDEMPOTENCY_KEY_REQUIRED", message: "En-tête Idempotency-Key manquant." },
      { status: 400 },
    );
  }

  let body: {
    accountRef?: string;
    partnerId?: string;
    weightGrams?: number;
    wasteCategory?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON", message: "Requête illisible." }, { status: 400 });
  }

  const { accountRef, partnerId, weightGrams, wasteCategory } = body;
  if (!accountRef || !partnerId || !weightGrams) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Client, boutique et poids sont requis." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin().rpc("fn_deposit", {
    p_account_ref: String(accountRef).trim(),
    p_partner_id: partnerId,
    p_weight_grams: Math.round(Number(weightGrams)),
    // La catégorie part vers le domaine « collecte » et n'atteint jamais
    // le compte : fn_deposit l'écrit dans collection_events, qui ne porte
    // aucun account_id.
    p_waste_category: wasteCategory ?? "non précisé",
    p_idempotency_key: idempotencyKey,
  });

  if (error) return businessError(error.message) ?? unexpected(error.message);
  return NextResponse.json(data);
}
