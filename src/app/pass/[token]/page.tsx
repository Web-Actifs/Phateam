import { notFound } from "next/navigation";
import { QrCode } from "@/components/QrCode";
import { findAccount, getBalance, getLedger, nextReward, affordableReward } from "@/lib/data";
import { PassLive } from "./PassLive";
import { PassThemeShell } from "./PassThemeShell";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR");

export default async function PassPage({ params }: PageProps<"/pass/[token]">) {
  const { token } = await params;
  const account = await findAccount(token);
  if (!account) notFound();

  const [balance, ledger] = await Promise.all([
    getBalance(account.id),
    getLedger(account.id, 6),
  ]);
  const [next, affordable] = await Promise.all([
    nextReward(balance),
    affordableReward(balance),
  ]);

  // Impact personnel — calculé UNIQUEMENT depuis le domaine « compte ».
  // Le barème étant fondé sur le poids (1 point par tranche de 10 g), le
  // total des points crédités suffit à retrouver un ordre de grandeur du
  // poids rapporté, sans jamais interroger collection_events ni relier ce
  // compte à la moindre catégorie de déchet.
  const credited = ledger.length
    ? await getLedger(account.id, 500).then((rows) =>
        rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0),
      )
    : 0;
  const grams = credited * 10;
  const packagings = Math.round(grams / 4); // un blister vide pèse ~4 g

  const progress = next ? Math.min(100, Math.round((balance / next.cost) * 100)) : 100;

  return (
    <PassThemeShell>
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-medium tracking-[0.14em] text-muted uppercase">
          Regard+
        </span>
        <span className="rounded-full bg-ink-soft px-3 py-1 text-[11px] font-medium tracking-wide text-ink">
          Pass
        </span>
      </header>

      {/* Le solde est l'information principale du pass. */}
      <PassLive
        token={account.account_token}
        shortCode={account.short_code}
        initialBalance={balance}
      />

      <section className="mt-7">
        {next ? (
          <>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-muted">
                Prochaine récompense · <span className="text-ink-deep">{next.title}</span>
              </span>
              <span className="tabular font-medium text-ink">
                {next.missing} pt{next.missing > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-soft">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted">Toutes les récompenses sont à votre portée.</p>
        )}
        {affordable && (
          <p className="mt-2 text-[13px] text-ink">
            Déjà accessible : {affordable.title} · {affordable.cost} pts
          </p>
        )}
      </section>

      {/* --- QR + second facteur ---------------------------------------- */}
      <section className="mt-8 rounded-[28px] border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(15,23,41,0.04),0_12px_32px_-12px_rgba(15,23,41,0.12)]">
        <div className="mx-auto aspect-square w-full max-w-[228px]">
          <QrCode value={account.account_token} />
        </div>

        <div className="mt-6 flex items-end justify-between border-t border-line pt-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
              Code pour dépenser
            </p>
            <p className="tabular mt-1 font-display text-[28px] leading-none tracking-[0.18em] text-ink-deep">
              {account.pin}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Sans scanner</p>
            <p className="tabular mt-1 text-[15px] font-medium text-ink-deep">
              {account.short_code}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Le code à 4 chiffres n&apos;est demandé que pour dépenser vos points. Un dépôt ne
          nécessite que le QR.
        </p>
      </section>

      {/* --- impact personnel -------------------------------------------- */}
      <section className="mt-7 rounded-2xl bg-ink-soft px-5 py-4">
        {credited > 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-deep">
            Vous avez rapporté{" "}
            <span className="tabular font-medium">
              {grams >= 1000 ? `${(grams / 1000).toFixed(1).replace(".", ",")} kg` : `${nf.format(grams)} g`}
            </span>{" "}
            d&apos;emballages, soit environ{" "}
            <span className="tabular font-medium">{nf.format(packagings)}</span> pièces détournées
            du tout-venant.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-deep">
            Votre premier dépôt vous attend. Apportez votre boîte chez un opticien du réseau —
            même une poignée de blisters compte.
          </p>
        )}
      </section>

      {/* --- historique --------------------------------------------------- */}
      {ledger.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted">Activité</h2>
          <ul className="mt-3 divide-y divide-line">
            {ledger.map((row, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-[14px]">
                <span className="text-ink-deep">
                  {row.reason === "deposit" ? "Dépôt" : "Récompense"}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="text-[12px] text-muted">
                    {new Date(row.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span
                    className={`tabular w-14 text-right font-medium ${
                      row.amount > 0 ? "text-ink" : "text-muted"
                    }`}
                  >
                    {row.amount > 0 ? "+" : "−"}
                    {Math.abs(row.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-muted">
        Vos points ne sont ni convertibles en euros ni transférables.
      </p>
    </main>
    </PassThemeShell>
  );
}
