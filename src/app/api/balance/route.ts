import { NextRequest, NextResponse } from "next/server";
import { findAccount, getBalance } from "@/lib/data";

/**
 * GET /api/balance?token=… — lecture seule, pour que le pass voie son solde
 * bouger sans rechargement quand le partenaire valide un dépôt depuis son
 * propre appareil. Critère de recette : moins de 10 secondes.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  }
  const account = await findAccount(token);
  if (!account) {
    return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(
    { balance: await getBalance(account.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
