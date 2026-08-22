import Link from "next/link";
import { headers } from "next/headers";
import { QrCode } from "@/components/QrCode";
import { DemoReset } from "@/app/console/DemoReset";
import { listPartners, listDemoAccounts } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Phateam — salle de contrôle" };

const nf = new Intl.NumberFormat("fr-FR");

const ROLES: Record<string, { role: string; usage: string }> = {
  "nouveau@demo.phateam.fr": {
    role: "Compte neuf",
    usage: "Solde nul. Sert à montrer les états vides et le tout premier crédit.",
  },
  "actif@demo.phateam.fr": {
    role: "À trois points du but",
    usage: "Le cas le plus parlant : la barre de progression est presque pleine.",
  },
  "ancien@demo.phateam.fr": {
    role: "Habitué",
    usage: "Huit mois d'historique et deux récompenses déjà dépensées.",
  },
};

/**
 * Salle de contrôle de la démonstration.
 *
 * Cette page n'est pas un écran du produit — aucun porteur, aucun opticien
 * ne la verra. Elle existe pour qu'on puisse mener la démonstration sans
 * retenir d'identifiant : les QR sont là pour être scannés depuis le
 * téléphone qui joue le client, et chaque boutique s'ouvre d'un clic.
 */
export default async function DemoPage() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  // Le bandeau de chiffres est du décor : s'il manque, la page doit rester
  // utilisable. C'est elle qui pilote la démonstration.
  const loadStats = async () => {
    try {
      const { data } = await supabaseAdmin().rpc("fn_impact_stats");
      return data as { deposits: number; grams: number; members: number } | null;
    } catch {
      return null;
    }
  };

  const [partners, accounts, stats] = await Promise.all([
    listPartners(),
    listDemoAccounts(),
    loadStats(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-16">
      <header className="border-b border-line pb-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-muted">
          Phateam · Salle de contrôle
        </p>
        <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.05] tracking-[-0.02em]">
          Tout le prototype, depuis une seule page.
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted">
          Gardez cet écran sur l&apos;ordinateur. Scannez les QR ci-dessous avec le téléphone
          qui joue le client, ouvrez une boutique dans un autre onglet pour jouer le comptoir.
        </p>
        {stats && (
          <p className="mt-4 text-[13px] text-muted">
            {nf.format(stats.deposits)} dépôts · {(stats.grams / 1000).toFixed(0)} kg collectés ·{" "}
            {nf.format(stats.members)} porteurs
          </p>
        )}
      </header>

      {/* --- 1. le porteur ------------------------------------------------ */}
      <section className="mt-14">
        <div className="flex items-baseline gap-4">
          <span className="tabular font-display text-[28px] text-ink">01</span>
          <div>
            <h2 className="font-display text-[26px] leading-tight">Côté porteur</h2>
            <p className="text-[14px] text-muted">
              Scannez un QR avec votre téléphone : le pass s&apos;ouvre en plein écran.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {accounts.map((a) => {
            const meta = ROLES[a.email];
            const url = `${origin}/pass/${a.short_code}`;
            return (
              <div
                key={a.id}
                className="flex flex-col rounded-2xl border border-line p-6 transition-colors hover:border-ink-tint"
              >
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{meta.role}</p>
                <p className="tabular mt-2 font-display text-[38px] leading-none text-ink">
                  {a.balance}
                  <span className="ml-1.5 font-sans text-[14px] text-muted">pts</span>
                </p>

                <div className="mx-auto my-6 aspect-square w-full max-w-[148px]">
                  <QrCode value={url} />
                </div>

                <dl className="space-y-1.5 border-t border-line pt-4 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-muted">Code sans scanner</dt>
                    <dd className="tabular font-medium">{a.short_code}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Code pour dépenser</dt>
                    <dd className="tabular font-medium">{a.pin}</dd>
                  </div>
                </dl>

                <p className="mt-4 text-[12px] leading-relaxed text-muted">{meta.usage}</p>

                <Link
                  href={`/pass/${a.short_code}`}
                  className="mt-5 rounded-xl bg-ink py-2.5 text-center text-[14px] font-medium text-paper transition-colors hover:bg-ink-hover"
                >
                  Ouvrir ce pass
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-ink-soft px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-ink-deep">
              Ou créez un compte de zéro
            </p>
            <p className="text-[13px] leading-relaxed text-muted">
              Le parcours d&apos;inscription complet : email, ajout à l&apos;écran d&apos;accueil,
              formulation du plan. Comptez moins de 90 secondes.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0">
              <QrCode value={origin} />
            </div>
            <Link
              href="/"
              className="rounded-xl border border-ink px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              S&apos;inscrire
            </Link>
          </div>
        </div>
      </section>

      {/* --- 2. le partenaire ---------------------------------------------- */}
      <section className="mt-16">
        <div className="flex items-baseline gap-4">
          <span className="tabular font-display text-[28px] text-ink">02</span>
          <div>
            <h2 className="font-display text-[26px] leading-tight">Côté comptoir</h2>
            <p className="text-[14px] text-muted">
              Ouvrez une boutique, scannez le pass du client — ou saisissez son code à
              6 chiffres si la caméra refuse.
            </p>
          </div>
        </div>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-2">
          {partners.map((p) => (
            <li key={p.id}>
              <Link
                href={`/console/${p.id}`}
                className="group flex h-full items-center justify-between gap-4 bg-paper px-6 py-4 transition-colors hover:bg-ink-soft"
              >
                <span>
                  <span className="block text-[15px] font-medium text-ink-deep">{p.name}</span>
                  <span className="block text-[12px] text-muted">{p.address}</span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-ink transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <p className="rounded-xl border border-line px-5 py-4 text-[13px] leading-relaxed text-muted">
            <span className="font-medium text-ink-deep">Onglet « Dépôt »</span> — le scan du QR
            suffit. Saisissez un poids, validez. Le solde bouge sur le téléphone du client sans
            qu&apos;il touche à rien.
          </p>
          <p className="rounded-xl border border-line px-5 py-4 text-[13px] leading-relaxed text-muted">
            <span className="font-medium text-ink-deep">Onglet « Dépenser »</span> — le code à
            4 chiffres du pass est exigé en plus. Trompez-vous une fois : le refus est explicite.
          </p>
        </div>
      </section>

      {/* --- 3. les investisseurs ------------------------------------------ */}
      <section className="mt-16">
        <div className="flex items-baseline gap-4">
          <span className="tabular font-display text-[28px] text-ink">03</span>
          <div>
            <h2 className="font-display text-[26px] leading-tight">L&apos;écran projeté</h2>
            <p className="text-[14px] text-muted">
              Les chiffres agrégés du réseau. C&apos;est cette page qui va au vidéoprojecteur.
            </p>
          </div>
        </div>
        <Link
          href="/impact"
          className="mt-6 flex items-center justify-between rounded-2xl bg-ink px-7 py-6 text-paper transition-colors hover:bg-ink-hover"
        >
          <span>
            <span className="block font-display text-[24px] leading-tight">/impact</span>
            <span className="block text-[13px] text-paper/70">
              Courbe cumulée sur huit mois, gisement par type, densité du réseau
            </span>
          </span>
          <span aria-hidden className="text-[22px]">
            →
          </span>
        </Link>
      </section>

      {/* --- 4. le déroulé -------------------------------------------------- */}
      <section className="mt-16 rounded-2xl border border-line p-8">
        <h2 className="font-display text-[22px]">Le déroulé, en six temps</h2>
        <ol className="mt-6 space-y-4">
          {[
            "Projetez /impact. C'est le décor : le réseau existe déjà.",
            "Sur un téléphone, scannez le QR « compte neuf » ou inscrivez-vous de zéro.",
            "Ajoutez le pass à l'écran d'accueil, rouvrez-le : plein écran, sans barre d'adresse.",
            "Sur l'ordinateur, ouvrez une boutique et scannez le pass du téléphone. 200 g, validez.",
            "Le solde grimpe sur le téléphone, seul. Personne ne l'a touché.",
            "Onglet « Dépenser » : choisissez une récompense, saisissez le code à 4 chiffres.",
          ].map((t, i) => (
            <li key={i} className="flex gap-4 text-[15px] leading-relaxed">
              <span className="tabular shrink-0 text-ink">0{i + 1}</span>
              <span className="text-ink-deep">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-7 border-t border-line pt-5 text-[13px] leading-relaxed text-muted">
          Deux gestes valent d&apos;être montrés à un interlocuteur technique : double-cliquer
          sur « Valider » lors d&apos;un dépôt — le compte n&apos;est crédité qu&apos;une fois,
          et l&apos;écran le dit — et tenter une dépense au-dessus du solde, refusée sans que
          le compte ne passe négatif.
        </p>
      </section>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <p className="text-[13px] text-muted">
          Les jetons des QR changent à chaque réinitialisation ; les codes à 6 chiffres, non.
        </p>
        <DemoReset />
      </footer>
    </main>
  );
}
