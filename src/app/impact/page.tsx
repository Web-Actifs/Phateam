import { supabaseAdmin } from "@/lib/supabase";
import { CumulativeChart, CategoryChart, type MonthPoint, type CategoryRow } from "./Charts";

export const dynamic = "force-dynamic";

type Stats = {
  partnersActive: number;
  partnersTotal: number;
  deposits: number;
  grams: number;
  members: number;
  monthly: MonthPoint[];
  categories: CategoryRow[];
  partners: { name: string; address: string; grams: number; deposits: number }[];
};

const nf = new Intl.NumberFormat("fr-FR");

export default async function ImpactPage() {
  const { data, error } = await supabaseAdmin().rpc("fn_impact_stats");
  if (error) throw new Error(error.message);
  const s = data as Stats;

  const kilos = s.grams / 1000;
  // Un blister vide pèse environ 4 g : l'ordre de grandeur parle davantage
  // qu'un poids brut devant une salle.
  const packagings = Math.round(s.grams / 4);

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-16 lg:py-24">
      <header>
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-muted">
          Regard+ · Réseau bordelais
        </p>
        <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.6rem,6vw,4.4rem)] leading-[1.02] tracking-[-0.02em]">
          {kilos.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kg d&apos;emballages
          n&apos;ont pas fini au tout-venant.
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
          Soit environ <span className="text-ink-deep">{nf.format(packagings)} pièces</span>{" "}
          rapportées en boutique par {nf.format(s.members)} porteurs, sur huit mois
          d&apos;exploitation.
        </p>
      </header>

      {/* --- compteurs ---------------------------------------------------- */}
      <section className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line lg:grid-cols-4">
        {[
          { label: "Points de collecte actifs", value: `${s.partnersActive}/${s.partnersTotal}` },
          { label: "Dépôts enregistrés", value: nf.format(s.deposits) },
          { label: "Porteurs inscrits", value: nf.format(s.members) },
          {
            label: "Poids moyen par dépôt",
            value: `${Math.round(s.grams / Math.max(1, s.deposits))} g`,
          },
        ].map((tile) => (
          <div key={tile.label} className="bg-paper px-6 py-7">
            <p className="tabular font-display text-[40px] leading-none tracking-[-0.01em] text-ink">
              {tile.value}
            </p>
            <p className="mt-3 text-[13px] leading-snug text-muted">{tile.label}</p>
          </div>
        ))}
      </section>

      {/* --- courbe ------------------------------------------------------- */}
      <section className="mt-20">
        <CumulativeChart data={s.monthly} />
      </section>

      {/* --- gisement + réseau -------------------------------------------- */}
      <section className="mt-20 grid gap-16 lg:grid-cols-2">
        <CategoryChart data={s.categories} />

        <figure>
          <figcaption className="mb-1 text-[13px] uppercase tracking-[0.12em] text-muted">
            Densité du réseau
          </figcaption>
          <p className="mb-6 text-[15px] text-muted">
            Huit opticiens partenaires, tous dans Bordeaux intra-muros.
          </p>
          <ul className="divide-y divide-line border-y border-line">
            {s.partners.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-4 py-3.5">
                <span>
                  <span className="block text-[15px] text-ink-deep">{p.name}</span>
                  <span className="block text-[12px] text-muted">{p.address}</span>
                </span>
                <span className="tabular shrink-0 text-right">
                  <span className="block text-[15px] font-medium text-ink-deep">
                    {(p.grams / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg
                  </span>
                  <span className="block text-[12px] text-muted">{p.deposits} dépôts</span>
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </section>

      {/* --- note de fin --------------------------------------------------- */}
      <footer className="mt-24 border-t border-line pt-8">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          Les chiffres de cette page sont agrégés à partir des seuls événements de collecte —
          poids, catégorie, point de dépôt. Ils ne sont reliés à aucun compte porteur : la base
          ne permet pas de savoir qui a rapporté quoi, et c&apos;est une propriété du schéma,
          pas une règle d&apos;usage.
        </p>
      </footer>
    </main>
  );
}
