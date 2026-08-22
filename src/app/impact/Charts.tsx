"use client";

import { useId, useMemo, useState } from "react";

export type MonthPoint = { month: string; deposits: number; grams: number; cumulative: number };
export type CategoryRow = { category: string; grams: number; deposits: number };

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MONTHS_FR[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

const kg = (g: number) =>
  `${(g / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;

// Géométrie du tracé, hors composant : constante d'un rendu à l'autre.
const W = 900;
const H = 320;
const P = { top: 24, right: 24, bottom: 40, left: 60 };

/**
 * Courbe cumulée du poids collecté.
 *
 * Série unique : pas de légende (le titre nomme la mesure), une seule
 * teinte, un axe. On trace le CUMUL et non le mensuel parce que le mois
 * en cours est incomplet par nature — une courbe mensuelle finirait sur
 * un creux le jour de la démonstration.
 */
export function CumulativeChart({ data }: { data: MonthPoint[] }) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const { pts, linePath, areaPath, ticks } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.cumulative), 1);
    const niceMax = Math.ceil(max / 20000) * 20000 || max;
    const x = (i: number) =>
      P.left + (i * (W - P.left - P.right)) / Math.max(1, data.length - 1);
    const y = (v: number) => H - P.bottom - (v / niceMax) * (H - P.top - P.bottom);

    const pts = data.map((d, i) => ({ ...d, x: x(i), y: y(d.cumulative) }));
    const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath =
      `${linePath} L${pts.at(-1)!.x.toFixed(1)},${H - P.bottom} L${pts[0].x.toFixed(1)},${H - P.bottom} Z`;
    const ticks = [0, 0.5, 1].map((t) => ({ v: niceMax * t, y: y(niceMax * t) }));
    return { pts, max: niceMax, linePath, areaPath, ticks };
  }, [data]);

  const active = hover !== null ? pts[hover] : null;

  return (
    <figure className="relative">
      <figcaption className="mb-1 text-[13px] uppercase tracking-[0.12em] text-muted">
        Poids collecté, cumulé
      </figcaption>
      <p className="mb-5 text-[15px] text-muted">Huit mois d&apos;exploitation sur le réseau lyonnais.</p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`Courbe du poids cumulé collecté, de ${monthLabel(data[0].month)} à ${monthLabel(data.at(-1)!.month)}, atteignant ${kg(data.at(-1)!.cumulative)}.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          pts.forEach((p, i) => {
            if (Math.abs(p.x - rel) < Math.abs(pts[best].x - rel)) best = i;
          });
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b3a6b" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1b3a6b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grille discrète : elle situe, elle ne décore pas. */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.left} x2={W - P.right} y1={t.y} y2={t.y} stroke="#e3e8ef" strokeWidth="1" />
            <text
              x={P.left - 12}
              y={t.y + 4}
              textAnchor="end"
              className="fill-[#6b7a90] text-[13px]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(t.v / 1000)} kg
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="#1b3a6b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw"
          style={{ ["--dash" as string]: "2400" }}
        />

        {/* Extrémité marquée : c'est le chiffre d'aujourd'hui. */}
        <circle cx={pts.at(-1)!.x} cy={pts.at(-1)!.y} r="5" fill="#1b3a6b" stroke="#fff" strokeWidth="2" />

        {active && (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={P.top}
              y2={H - P.bottom}
              stroke="#1b3a6b"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.45"
            />
            <circle cx={active.x} cy={active.y} r="5.5" fill="#1b3a6b" stroke="#fff" strokeWidth="2" />
          </g>
        )}

        {pts.map((p, i) => (
          <text
            key={p.month}
            x={p.x}
            y={H - P.bottom + 24}
            textAnchor="middle"
            className={i === hover ? "fill-[#0f1729] text-[13px]" : "fill-[#6b7a90] text-[13px]"}
          >
            {monthLabel(p.month)}
          </text>
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute -top-2 rounded-xl border border-line bg-paper px-4 py-3 shadow-[0_8px_28px_-10px_rgba(15,23,41,0.28)]"
          style={{ left: `${(active.x / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="text-[12px] text-muted">{monthLabel(active.month)}</p>
          <p className="tabular text-[18px] font-medium text-ink-deep">{kg(active.cumulative)}</p>
          <p className="tabular text-[12px] text-muted">
            {active.deposits} dépôts ce mois-là · {kg(active.grams)}
          </p>
        </div>
      )}
    </figure>
  );
}

/**
 * Répartition du gisement par type d'emballage.
 *
 * Barres d'une seule teinte : la mesure est une ampleur, pas une identité.
 * L'identité est portée par l'étiquette, jamais par la couleur — ce qui
 * évite d'inventer une palette catégorielle pour quatre lignes.
 */
export function CategoryChart({ data }: { data: CategoryRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.grams), 1);
  const total = data.reduce((s, d) => s + d.grams, 0);

  return (
    <figure>
      <figcaption className="mb-1 text-[13px] uppercase tracking-[0.12em] text-muted">
        Nature du gisement
      </figcaption>
      <p className="mb-6 text-[15px] text-muted">
        Ce que rapportent réellement les porteurs, en poids.
      </p>

      <ul className="space-y-5">
        {data.map((d) => (
          <li
            key={d.category}
            onMouseEnter={() => setHover(d.category)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] text-ink-deep first-letter:uppercase">{d.category}</span>
              <span className="tabular text-[15px] font-medium text-ink-deep">
                {kg(d.grams)}
                <span className="ml-2 text-[13px] font-normal text-muted">
                  {Math.round((d.grams / total) * 100)} %
                </span>
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ink-soft">
              <div
                className="h-full rounded-full bg-ink transition-[width,opacity] duration-700 ease-out"
                style={{
                  width: `${(d.grams / max) * 100}%`,
                  opacity: hover && hover !== d.category ? 0.45 : 1,
                }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-muted">{d.deposits} dépôts</p>
          </li>
        ))}
      </ul>
    </figure>
  );
}
