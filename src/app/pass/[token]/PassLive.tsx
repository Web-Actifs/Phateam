"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LAST_PASS_KEY } from "../PassRecovery";

/**
 * Le solde, en très gros — l'information principale du pass.
 *
 * Il s'interroge toutes les 2,5 s pour que le client voie ses points
 * arriver pendant que le partenaire valide le dépôt sur SON appareil, sans
 * rien toucher. C'est le moment de récompense de la démonstration : il
 * mérite le compteur qui grimpe et le halo.
 */
export function PassLive({
  token,
  shortCode,
  initialBalance,
}: {
  token: string;
  shortCode: string;
  initialBalance: number;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [display, setDisplay] = useState(initialBalance);
  const [delta, setDelta] = useState<number | null>(null);
  const previous = useRef(initialBalance);

  // Mémorise le pass de cet appareil : /pass sans jeton pourra le rouvrir.
  // On stocke le code à 6 chiffres et non le jeton, parce qu'il survit à une
  // réinitialisation du jeu de démonstration.
  useEffect(() => {
    try {
      localStorage.setItem(LAST_PASS_KEY, shortCode);
    } catch {
      /* navigation privée : tant pis, le code reste affiché sur le pass */
    }
  }, [shortCode]);

  // --- scrutation du solde ------------------------------------------
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/balance?token=${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const { balance: fresh } = await res.json();
        if (alive && typeof fresh === "number") setBalance(fresh);
      } catch {
        /* hors ligne : on retentera au prochain tour */
      }
    };
    const id = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  // --- compteur animé -----------------------------------------------
  useEffect(() => {
    const from = previous.current;
    if (balance === from) return;

    const diff = balance - from;
    setDelta(diff);
    previous.current = balance;

    // Le chiffre défile jusqu'à sa valeur plutôt que de sauter :
    // c'est ce qui rend le crédit satisfaisant à regarder.
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + diff * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // Rafraîchit le reste de la page (progression, historique, impact).
    const refresh = setTimeout(() => router.refresh(), 1100);
    const clear = setTimeout(() => setDelta(null), 2600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(refresh);
      clearTimeout(clear);
    };
  }, [balance, router]);

  return (
    <section className="relative mt-10" data-halo>
      {delta !== null && delta > 0 && (
        <>
          <span
            aria-hidden
            className="animate-halo absolute left-1/2 top-8 -z-10 h-40 w-40 -translate-x-1/2 rounded-full bg-ink-tint"
          />
          <span
            key={delta}
            className="animate-rise absolute -top-1 left-0 text-[15px] font-medium text-ink"
          >
            +{delta} points
          </span>
        </>
      )}

      <p className="text-[13px] text-muted">Votre solde</p>
      <p
        key={`b-${balance}`}
        className={`tabular font-display text-[86px] leading-[0.95] tracking-[-0.02em] text-ink-deep ${
          delta ? "animate-count-pop" : ""
        }`}
      >
        {display}
      </p>
      <p className="-mt-1 text-[15px] text-muted">points</p>
    </section>
  );
}
