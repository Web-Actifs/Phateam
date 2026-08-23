"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "regardplus-pass-theme";

const THEMES = [
  { id: "encre", label: "Encre", swatch: "#1b3a6b" },
  {
    id: "spectre",
    label: "Spectre",
    swatch: "conic-gradient(from 200deg, #7c6fd1, #5a8fd6, #4fb3a6, #e8b25c, #e07d6f)",
  },
  { id: "verre", label: "Verre", swatch: "linear-gradient(160deg, #cfe0f7, #ffffff)" },
  { id: "ambre", label: "Ambre", swatch: "linear-gradient(135deg, #f8cf94, #d9695f)" },
  { id: "nuit", label: "Nuit", swatch: "radial-gradient(circle at 30% 30%, #e8c877, #16171c 70%)" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

/**
 * Habillage du pass — switch discret, jamais posé sur <html> : la portée
 * reste ce sous-arbre, /console et /impact ne voient jamais l'attribut.
 * Encre reste la valeur par défaut tant que rien n'est mémorisé.
 */
export function PassThemeShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>("encre");
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && THEMES.some((t) => t.id === saved)) setTheme(saved as ThemeId);
    } catch {
      /* navigation privée : le thème reste Encre pour cette visite */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const choose = (id: ThemeId) => {
    setTheme(id);
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* tant pis, le choix ne survivra pas à cette visite */
    }
  };

  return (
    <div
      data-theme={theme === "encre" ? undefined : theme}
      className="relative min-h-dvh bg-paper text-ink-deep transition-colors"
    >
      {children}

      <div ref={popoverRef} className="fixed bottom-5 right-5 z-50">
        {open && (
          <div className="mb-2 flex flex-col gap-0.5 rounded-2xl border border-line bg-paper p-1.5 shadow-[0_8px_28px_-10px_rgba(15,23,41,0.35)]">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id)}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-ink-soft ${
                  theme === t.id ? "text-ink-deep font-medium" : "text-muted"
                }`}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 rounded-full border border-line"
                  style={{ background: t.swatch }}
                />
                {t.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-label="Apparence du pass"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-[15px] text-muted shadow-[0_1px_2px_rgba(15,23,41,0.06),0_8px_20px_-10px_rgba(15,23,41,0.25)] transition-colors hover:text-ink"
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
