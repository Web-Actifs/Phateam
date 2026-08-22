import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { businessError, unexpected } from "@/lib/api-errors";

/**
 * POST /api/redeem — débit de points contre une récompense.
 *
 * Exige DEUX preuves : le jeton du QR (ou le code à 6 chiffres) et le
 * code à 4 chiffres affiché sur le pass. Sans ce second facteur, une
 * simple capture d'écran du QR suffirait à dépenser les points d'autrui.
 *
 * Le verrou par compte et la vérification du solde vivent dans fn_redeem,
 * côté Postgres, parce qu'ils doivent tenir dans la même transaction que
 * l'insertion. Voir supabase/migrations/0002_functions.sql.
 */
export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "IDEMPOTENCY_KEY_REQUIRED", message: "En-tête Idempotency-Key manquant." },
      { status: 400 },
    );
  }

  let body: { accountRef?: string; pin?: string; rewardId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON", message: "Requête illisible." }, { status: 400 });
  }

  const { accountRef, pin, rewardId } = body;
  if (!accountRef || !pin || !rewardId) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Client, code à 4 chiffres et récompense sont requis." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin().rpc("fn_redeem", {
    p_account_ref: String(accountRef).trim(),
    p_pin: String(pin).trim(),
    p_reward_id: rewardId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) return businessError(error.message) ?? unexpected(error.message);
  return NextResponse.json(data);
}
