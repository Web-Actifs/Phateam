import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { listPartners } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Arrivée par QR code ou lien. Page web : aucune application à télécharger.
 *
 * Un seul champ, l'email. Pas de mot de passe, et surtout aucune question
 * sur l'équipement optique de la personne.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const partners = await listPartners();

  async function signup(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const { data, error } = await supabaseAdmin().rpc("fn_signup", { p_email: email });

    if (error) {
      const code = error.message.includes("INVALID_EMAIL") ? "email" : "unknown";
      redirect(`/?error=${code}`);
    }
    redirect(`/bienvenue/${data.token}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted">Phateam</p>

      <h1 className="mt-8 font-display text-[42px] leading-[1.04] tracking-[-0.015em]">
        Vos emballages
        <br />
        valent des points.
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-muted">
        Rapportez blisters, opercules, étuis et flacons chez l&apos;un des{" "}
        <span className="text-ink-deep">{partners.length} opticiens</span> du réseau lyonnais.
        Vous gagnez des points, dépensables chez ces mêmes partenaires.
      </p>

      <form action={signup} className="mt-10">
        <label htmlFor="email" className="block text-[11px] uppercase tracking-[0.12em] text-muted">
          Votre email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="prenom@exemple.fr"
          className="mt-3 w-full rounded-xl border border-line px-4 py-4 text-[17px] outline-none placeholder:text-muted/60 focus:border-ink"
        />
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {error === "email"
              ? "Cette adresse ne semble pas valide."
              : "Une erreur est survenue. Réessayez."}
          </p>
        )}
        <button
          type="submit"
          className="mt-4 w-full rounded-2xl bg-ink py-4 text-[17px] font-medium text-paper transition-colors hover:bg-ink-hover"
        >
          Créer mon pass
        </button>
      </form>

      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        Pas de mot de passe, pas d&apos;application à installer. Nous ne vous demandons rien sur
        votre vue ni sur vos lentilles.
      </p>

      <div className="mt-auto space-y-4 pt-14">
        <div className="h-px bg-line" />
        <ul className="space-y-2.5 text-[13px] leading-relaxed text-muted">
          <li className="flex gap-3">
            <span className="tabular text-ink">01</span>
            Vous apportez votre boîte chez un opticien partenaire.
          </li>
          <li className="flex gap-3">
            <span className="tabular text-ink">02</span>
            Il scanne votre pass. Les points arrivent sous vos yeux.
          </li>
          <li className="flex gap-3">
            <span className="tabular text-ink">03</span>
            Vous les dépensez dans le réseau, quand vous voulez.
          </li>
        </ul>
      </div>
    </main>
  );
}
