"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Remet le jeu de démonstration à zéro, pour enchaîner deux présentations. */
export function DemoReset() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "working" | "done">("idle");

  async function run() {
    setState("working");
    await fetch("/api/demo/reset", { method: "POST" });
    router.refresh();
    setState("done");
    setTimeout(() => setState("idle"), 4000);
  }

  if (state === "done")
    return <span className="text-[13px] text-ink">Jeu de démonstration régénéré.</span>;

  if (state === "confirm")
    return (
      <span className="flex items-center gap-3 text-[13px]">
        <span className="text-muted">Effacer et régénérer toutes les données ?</span>
        <button onClick={run} className="font-medium text-danger underline underline-offset-4">
          Oui, réinitialiser
        </button>
        <button onClick={() => setState("idle")} className="text-muted underline underline-offset-4">
          Annuler
        </button>
      </span>
    );

  return (
    <button
      onClick={() => setState("confirm")}
      disabled={state === "working"}
      className="text-[13px] text-muted underline underline-offset-4 hover:text-ink"
    >
      {state === "working" ? "Régénération…" : "Réinitialiser la démonstration"}
    </button>
  );
}
