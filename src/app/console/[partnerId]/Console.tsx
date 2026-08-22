"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scanner } from "@/components/Scanner";
import type { Reward } from "@/lib/data";

type Client = { shortCode: string; balance: number };
type Result = { kind: "deposit" | "redeem"; amount: number; balance: number; replayed: boolean };

const WEIGHTS = [50, 100, 200, 500];
const CATEGORIES = ["blister", "opercule", "étui", "flacon de solution"];

export function Console({ partnerId, rewards }: { partnerId: string; rewards: Reward[] }) {
  const [tab, setTab] = useState<"deposit" | "redeem">("deposit");
  const [client, setClient] = useState<Client | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accountRef, setAccountRef] = useState<string | null>(null);

  const [grams, setGrams] = useState<number>(100);
  const [freeGrams, setFreeGrams] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [rewardId, setRewardId] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  /**
   * La clé d'idempotence est fabriquée UNE FOIS par intention — à l'instant
   * où le client est reconnu — et non à chaque clic. C'est tout l'intérêt :
   * deux clics sur « Valider » portent la même clé, donc le serveur ne
   * crédite qu'une fois.
   */
  const [idemKey, setIdemKey] = useState<string>(() => crypto.randomUUID());

  const reset = useCallback(() => {
    setClient(null);
    setAccountRef(null);
    setResult(null);
    setError(null);
    setPin("");
    setRewardId(null);
    setFreeGrams("");
    setGrams(100);
    setIdemKey(crypto.randomUUID());
  }, []);

  const onFound = useCallback(async (ref: string) => {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/account?ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Client non reconnu.");
        return;
      }
      setAccountRef(ref);
      setClient(data);
      setIdemKey(crypto.randomUUID());
    } catch {
      setError("Réseau indisponible. Réessayez.");
    } finally {
      setPending(false);
    }
  }, []);

  const effectiveGrams = useMemo(() => {
    const free = parseInt(freeGrams, 10);
    return Number.isFinite(free) && free > 0 ? free : grams;
  }, [freeGrams, grams]);

  async function submitDeposit() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({
          accountRef,
          partnerId,
          weightGrams: effectiveGrams,
          wasteCategory: category,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Échec du dépôt.");
      else setResult({ kind: "deposit", amount: data.credited, balance: data.balance, replayed: data.replayed });
    } catch {
      setError("Réseau indisponible. Réessayez — le double envoi est sans risque.");
    } finally {
      setPending(false);
    }
  }

  async function submitRedeem() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({ accountRef, pin, rewardId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "Échec de la dépense.");
      else setResult({ kind: "redeem", amount: data.debited, balance: data.balance, replayed: data.replayed });
    } catch {
      setError("Réseau indisponible. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  // Retour automatique au scanner : le comptoir enchaîne les clients.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(reset, 9000);
    return () => clearTimeout(t);
  }, [result, reset]);

  // ------------------------------------------------------------------
  if (result) return <Success result={result} onNext={reset} />;

  return (
    <div className="mt-8">
      <div role="tablist" className="flex gap-1 rounded-full bg-ink-soft p-1">
        {(["deposit", "redeem"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`flex-1 rounded-full py-2.5 text-[15px] font-medium transition-colors ${
              tab === t ? "bg-paper text-ink-deep shadow-sm" : "text-muted hover:text-ink-deep"
            }`}
          >
            {t === "deposit" ? "Dépôt" : "Dépenser"}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="animate-rise mt-5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {error}
        </p>
      )}

      {!client ? (
        <div className="mt-6">
          <Scanner onFound={onFound} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Client</p>
              <p className="tabular text-[17px] font-medium">{client.shortCode}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Solde</p>
              <p className="tabular text-[17px] font-medium text-ink">{client.balance} pts</p>
            </div>
            <button onClick={reset} className="ml-2 text-[13px] text-muted hover:text-ink">
              Changer
            </button>
          </div>

          {tab === "deposit" ? (
            <>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Poids déposé</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {WEIGHTS.map((w) => (
                    <button
                      key={w}
                      onClick={() => {
                        setGrams(w);
                        setFreeGrams("");
                      }}
                      className={`tabular rounded-xl py-4 text-[18px] font-medium transition-colors ${
                        effectiveGrams === w
                          ? "bg-ink text-paper"
                          : "bg-ink-soft text-ink-deep hover:bg-ink-tint"
                      }`}
                    >
                      {w} g
                    </button>
                  ))}
                </div>
                <input
                  value={freeGrams}
                  onChange={(e) => setFreeGrams(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  inputMode="numeric"
                  placeholder="Autre poids en grammes"
                  className="tabular mt-2 w-full rounded-xl border border-line px-4 py-3 text-[16px] outline-none placeholder:text-muted/70 focus:border-ink"
                />
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Type d&apos;emballage</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
                        category === c
                          ? "bg-ink text-paper"
                          : "bg-ink-soft text-ink-deep hover:bg-ink-tint"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {/* Rappel destiné au lecteur du code autant qu'à l'opticien. */}
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Le type d&apos;emballage sert au suivi du gisement. Il n&apos;est jamais rattaché
                  au compte du client : les points sont calculés sur le seul poids.
                </p>
              </div>

              {/* Le bouton reste actif pendant l'envoi : un double-clic part
                  réellement au serveur, et la clé d'idempotence l'absorbe. */}
              <button
                onClick={submitDeposit}
                className="w-full rounded-2xl bg-ink py-5 text-[18px] font-medium text-paper transition-colors hover:bg-ink-hover"
              >
                {pending ? "Validation…" : `Créditer ${Math.max(1, Math.floor(effectiveGrams / 10))} points`}
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Récompense</p>
                <ul className="mt-3 space-y-2">
                  {rewards.map((r) => {
                    const affordable = client.balance >= r.cost_points;
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => setRewardId(r.id)}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                            rewardId === r.id
                              ? "border-ink bg-ink-soft"
                              : "border-line hover:border-ink-tint"
                          } ${affordable ? "" : "opacity-45"}`}
                        >
                          <span>
                            <span className="block text-[15px] font-medium">{r.title}</span>
                            <span className="block text-[13px] text-muted">{r.description}</span>
                          </span>
                          <span className="tabular shrink-0 pl-3 text-[15px] font-medium text-ink">
                            {r.cost_points} pts
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <label
                  htmlFor="pin"
                  className="block text-[11px] uppercase tracking-[0.12em] text-muted"
                >
                  Code à 4 chiffres du client
                </label>
                <input
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="····"
                  className="tabular mt-3 w-full rounded-xl border border-line px-4 py-4 text-center text-[28px] tracking-[0.5em] outline-none placeholder:text-line focus:border-ink"
                />
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Demandé pour toute dépense. Sans lui, une capture d&apos;écran du QR suffirait à
                  dépenser les points du client.
                </p>
              </div>

              <button
                onClick={submitRedeem}
                disabled={!rewardId || pin.length !== 4}
                className="w-full rounded-2xl bg-ink py-5 text-[18px] font-medium text-paper transition-colors hover:bg-ink-hover disabled:bg-line disabled:text-muted"
              >
                {pending ? "Validation…" : "Valider la dépense"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Success({ result, onNext }: { result: Result; onNext: () => void }) {
  const credit = result.kind === "deposit";
  return (
    <div className="mt-10 flex flex-col items-center py-10 text-center">
      <div className="relative">
        <span
          aria-hidden
          className="animate-halo absolute left-1/2 top-1/2 -z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-tint"
        />
        <p className="animate-count-pop tabular font-display text-[76px] leading-none tracking-[-0.02em] text-ink">
          {credit ? "+" : "−"}
          {result.amount}
        </p>
      </div>
      <p className="animate-rise mt-3 text-[17px] text-ink-deep">
        {credit ? "points crédités" : "points dépensés"}
      </p>
      <p className="animate-rise mt-1 text-[15px] text-muted">
        Nouveau solde : <span className="tabular font-medium text-ink-deep">{result.balance} pts</span>
      </p>

      {result.replayed && (
        <p className="animate-rise mt-5 max-w-xs rounded-xl bg-ink-soft px-4 py-3 text-[13px] leading-relaxed text-muted">
          Cette validation avait déjà été enregistrée. Le compte n&apos;a été crédité
          qu&apos;une seule fois.
        </p>
      )}

      <button
        onClick={onNext}
        className="mt-9 rounded-full border border-line px-6 py-3 text-[15px] font-medium text-ink-deep transition-colors hover:bg-ink-soft"
      >
        Client suivant
      </button>
    </div>
  );
}
