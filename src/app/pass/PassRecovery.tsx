"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export const LAST_PASS_KEY = "regardplus:last-pass";

// Lecture de localStorage sans état intermédiaire : au rendu serveur
// l'instantané vaut null, au rendu client il vaut le code mémorisé. Le
// formulaire ne clignote donc pas avant la redirection.
const subscribe = () => () => {};
const readStored = () => {
  try {
    return localStorage.getItem(LAST_PASS_KEY);
  } catch {
    return null; // navigation privée
  }
};

export function PassRecovery() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const stored = useSyncExternalStore(subscribe, readStored, () => null);

  useEffect(() => {
    if (stored) router.replace(`/pass/${stored}`);
  }, [stored, router]);

  if (stored) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-[14px] text-muted">Ouverture de votre pass…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6 py-12">
      <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted">Regard+</p>
      <h1 className="mt-6 font-display text-[34px] leading-[1.08] tracking-[-0.015em]">
        Retrouvons votre pass.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Saisissez le code à 6 chiffres qui figure sur votre pass, sous le QR.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) router.push(`/pass/${code}`);
        }}
        className="mt-8"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="100002"
          aria-label="Code à 6 chiffres"
          className="tabular w-full rounded-xl border border-line px-4 py-4 text-center text-[26px] tracking-[0.3em] outline-none placeholder:text-line focus:border-ink"
        />
        <button
          type="submit"
          disabled={code.length !== 6}
          className="mt-4 w-full rounded-2xl bg-ink py-4 text-[17px] font-medium text-paper transition-colors hover:bg-ink-hover disabled:bg-line disabled:text-muted"
        >
          Ouvrir mon pass
        </button>
      </form>

      <p className="mt-8 text-center text-[13px] text-muted">
        Pas encore de pass ?{" "}
        <Link href="/" className="text-ink underline underline-offset-4">
          En créer un
        </Link>
      </p>
    </main>
  );
}
