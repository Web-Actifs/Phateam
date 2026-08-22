import { NextRequest, NextResponse } from "next/server";
import { findAccount, getBalance } from "@/lib/data";

/**
 * GET /api/account?ref=… — résolution d'un client depuis le QR ou le code
 * à 6 chiffres, pour que la console partenaire affiche une confirmation
 * avant de valider.
 *
 * Ne renvoie QUE le code court et le solde. Pas d'email, pas d'identité :
 * l'opticien n'a besoin de rien d'autre pour créditer, et le pass ne doit
 * pas devenir un annuaire de porteurs de lentilles.
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "MISSING_REF" }, { status: 400 });

  const account = await findAccount(ref);
  if (!account) {
    return NextResponse.json(
      { error: "ACCOUNT_NOT_FOUND", message: "Client non reconnu." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { shortCode: account.short_code, balance: await getBalance(account.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
