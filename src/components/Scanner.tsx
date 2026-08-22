"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Scanner de QR pour la console partenaire.
 *
 * MODE DÉGRADÉ NON OPTIONNEL : la saisie manuelle du code à 6 chiffres est
 * toujours visible, à côté du scanner et non cachée derrière un lien. Un
 * scanner qui plante devant un client tue l'adoption — le comptoir doit
 * pouvoir continuer sans réfléchir.
 */
export function Scanner({ onFound }: { onFound: (ref: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch {
      setCamError(
        "Caméra indisponible. Utilisez le code à 6 chiffres affiché sur le pass du client.",
      );
    }
  }, []);

  useEffect(() => stop, [stop]);

  // Décodage image par image. jsQR est volontairement modeste : quelques
  // dizaines de kilo-octets, aucune dépendance native.
  useEffect(() => {
    if (!scanning) return;
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = (canvas.width = video.videoWidth);
        const h = (canvas.height = video.videoHeight);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx && w && h) {
          ctx.drawImage(video, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
            inversionAttempts: "dontInvert",
          });
          if (code?.data) {
            stop();
            onFound(code.data.trim());
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scanning, onFound, stop]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const v = manual.trim();
    if (v.length >= 6) {
      stop();
      onFound(v);
      setManual("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-ink-soft">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${scanning ? "" : "invisible"}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {scanning && (
          <>
            {/* Cadre de visée */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[62%] aspect-square rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,41,0.35)]">
                <span className="animate-sweep absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/70 to-transparent" />
              </div>
            </div>
            <button
              onClick={stop}
              className="absolute bottom-3 right-3 rounded-full bg-paper/90 px-3 py-1.5 text-[13px] font-medium text-ink-deep"
            >
              Arrêter
            </button>
          </>
        )}

        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-[14px] text-muted">
              {camError ?? "Scannez le QR affiché sur le pass du client."}
            </p>
            <button
              onClick={start}
              className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-paper transition-colors hover:bg-ink-hover"
            >
              {camError ? "Réessayer la caméra" : "Activer la caméra"}
            </button>
          </div>
        )}
      </div>

      {/* Mode dégradé — toujours présent, jamais replié. */}
      <form onSubmit={submitManual} className="space-y-2">
        <label
          htmlFor="shortcode"
          className="block text-[11px] uppercase tracking-[0.12em] text-muted"
        >
          Ou code à 6 chiffres
        </label>
        <div className="flex gap-2">
          <input
            id="shortcode"
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="100002"
            className="tabular w-full rounded-xl border border-line px-4 py-3 text-[20px] tracking-[0.24em] outline-none placeholder:text-line focus:border-ink"
          />
          <button
            type="submit"
            disabled={manual.length < 6}
            className="shrink-0 rounded-xl bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-ink-hover disabled:bg-line disabled:text-muted"
          >
            Valider
          </button>
        </div>
      </form>
    </div>
  );
}
