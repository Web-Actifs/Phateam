import Link from "next/link";
import { listPartners } from "@/lib/data";
import { DemoReset } from "./DemoReset";

export const dynamic = "force-dynamic";

/**
 * Choix de la boutique. Dans une vraie mise en service, le partenaire est
 * authentifié et cet écran n'existe pas — ici il permet de jouer n'importe
 * lequel des 8 points de collecte pendant la démonstration.
 */
export default async function ConsoleHome() {
  const partners = await listPartners();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted">Phateam</p>
      <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.01em]">
        Console partenaire
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        Sélectionnez votre boutique pour ouvrir le comptoir. Le client n&apos;a aucune
        application à ouvrir : vous scannez son pass depuis cet écran.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {partners.map((p) => (
          <li key={p.id}>
            <Link
              href={`/console/${p.id}`}
              className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-ink-soft/60"
            >
              <span>
                <span className="block text-[17px] font-medium text-ink-deep">{p.name}</span>
                <span className="block text-[13px] text-muted">
                  {p.address} · {p.city}
                </span>
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

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-[13px] text-muted">
        <p>
          Écran investisseurs :{" "}
          <Link href="/impact" className="text-ink underline underline-offset-4">
            /impact
          </Link>
        </p>
        <DemoReset />
      </div>
    </main>
  );
}
