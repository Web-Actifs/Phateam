"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type P = { id: string; name: string; address: string };

const MOMENTS = [
  "à ma prochaine commande de lentilles",
  "samedi prochain",
  "sur le chemin du travail cette semaine",
  "à ma prochaine visite de contrôle",
];

/**
 * Deux écrans après l'inscription, pas un de plus.
 *
 * 1. Ajouter le pass à l'écran d'accueil — c'est ce qui lui donne
 *    l'allure d'une application.
 * 2. Formuler un plan : « SI je passe chez [partenaire] [moment],
 *    ALORS j'apporte ma boîte. » C'est une intention de mise en œuvre,
 *    mécanique documentée pour transformer une intention vague en geste
 *    effectif. Ce n'est pas du remplissage d'écran.
 */
export function Welcome({
  token,
  shortCode,
  partners,
}: {
  token: string;
  shortCode: string;
  partners: P[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [partnerId, setPartnerId] = useState<string>(partners[0]?.id ?? "");
  const [moment, setMoment] = useState<string>(MOMENTS[0]);

  const partner = partners.find((p) => p.id === partnerId);

  function confirmPlan() {
    // Le plan reste sur l'appareil. Le rattacher au compte reviendrait à
    // enregistrer « cette personne fréquente tel opticien », c'est-à-dire
    // à recréer côté serveur l'association que toute l'architecture
    // s'attache à éviter. Il n'apporte rien au dispositif et coûte cher
    // en surface réglementaire.
    try {
      localStorage.setItem(
        `phateam:plan:${token}`,
        JSON.stringify({ partner: partner?.name ?? "", moment }),
      );
    } catch {
      /* navigation privée : le plan est simplement oublié */
    }
    router.push(`/pass/${token}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        {[1, 2].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full transition-colors ${
              n <= step ? "bg-ink" : "bg-line"
            }`}
          />
        ))}
      </div>

      {step === 1 ? (
        <section className="animate-rise mt-12">
          <h1 className="font-display text-[38px] leading-[1.06] tracking-[-0.015em]">
            Gardez votre pass
            <br />à portée de pouce.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-muted">
            Ajoutez-le à votre écran d&apos;accueil : il s&apos;ouvrira en plein écran, comme une
            application, sans barre d&apos;adresse.
          </p>

          <ol className="mt-9 space-y-5">
            {[
              ["Appuyez sur Partager", "l'icône carrée avec une flèche, en bas de Safari"],
              ["Choisissez « Sur l'écran d'accueil »", "faites défiler la liste si besoin"],
              ["Confirmez", "le pass rejoint vos applications"],
            ].map(([title, detail], i) => (
              <li key={i} className="flex gap-4">
                <span className="tabular mt-0.5 text-[14px] text-ink">0{i + 1}</span>
                <span>
                  <span className="block text-[15px] font-medium text-ink-deep">{title}</span>
                  <span className="block text-[13px] text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-9 rounded-2xl bg-ink-soft px-5 py-4">
            <p className="text-[13px] leading-relaxed text-ink-deep">
              Votre code sans scanner :{" "}
              <span className="tabular font-medium">{shortCode}</span>. Il dépanne si la caméra de
              l&apos;opticien fait des siennes.
            </p>
          </div>

          <button
            onClick={() => setStep(2)}
            className="mt-9 w-full rounded-2xl bg-ink py-4 text-[17px] font-medium text-paper transition-colors hover:bg-ink-hover"
          >
            C&apos;est fait
          </button>
        </section>
      ) : (
        <section className="animate-rise mt-12">
          <h1 className="font-display text-[38px] leading-[1.06] tracking-[-0.015em]">
            Un plan tient mieux
            <br />
            qu&apos;une bonne intention.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-muted">
            Décidez maintenant du moment et du lieu. Les gens qui formulent cette phrase y vont
            nettement plus souvent que ceux qui se disent simplement qu&apos;ils iront.
          </p>

          <div className="mt-9 rounded-2xl border border-line p-5">
            <p className="font-display text-[22px] leading-[1.35] text-ink-deep">
              <span className="text-muted">Si</span> je passe chez{" "}
              <span className="text-ink">{partner?.name ?? "…"}</span>{" "}
              <span className="text-ink">{moment}</span>,{" "}
              <span className="text-muted">alors</span> j&apos;apporte ma boîte.
            </p>
          </div>

          <div className="mt-7">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Chez qui</p>
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {partners.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPartnerId(p.id)}
                  className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    partnerId === p.id ? "border-ink bg-ink-soft" : "border-line hover:border-ink-tint"
                  }`}
                >
                  <span className="block text-[15px] font-medium">{p.name}</span>
                  <span className="block text-[12px] text-muted">{p.address}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Quand</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MOMENTS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMoment(m)}
                  className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                    moment === m ? "bg-ink text-paper" : "bg-ink-soft text-ink-deep hover:bg-ink-tint"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={confirmPlan}
            className="mt-10 w-full rounded-2xl bg-ink py-4 text-[17px] font-medium text-paper transition-colors hover:bg-ink-hover"
          >
            Je m&apos;y engage
          </button>
        </section>
      )}
    </main>
  );
}
