import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unexpected } from "@/lib/api-errors";
import { revalidatePath } from "next/cache";

/**
 * POST /api/demo/reset — remet le jeu de démonstration à zéro.
 *
 * Existe pour pouvoir refaire une démonstration proprement. C'est le seul
 * chemin du code qui efface le registre de points, et il n'aurait pas
 * d'équivalent en production.
 */
export async function POST() {
  const { data, error } = await supabaseAdmin().rpc("fn_demo_reset");
  if (error) return unexpected(error.message);

  revalidatePath("/impact");
  revalidatePath("/console");
  return NextResponse.json({ status: "ok", ...data });
}
