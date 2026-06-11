"use client";
import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { spriteFront } from "@/lib/data/dex";

const W = 480;
const H = 270;
const TOTAL = 6400;

/**
 * Skippable ~6s pixel opening cinematic: tall-grass text → Poké Ball arcs in,
 * bounces, bursts open → starters appear → title slam. Pure canvas, no assets.
 */
export default function IntroCinematic({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { t } = useI18n();
  const [closing, setClosing] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;

    const starters = [1, 4, 7].map((id) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = spriteFront(id);
      return img;
    });

    const line1 = t("intro.line1");
    const line2 = t("intro.line2");
    let raf = 0;
    const t0 = performance.now();

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setClosing(true);
      setTimeout(onDone, 450);
    };

    const px = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const drawBall = (x: number, y: number, r: number, rot: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fillStyle = "#e3350d"; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fillStyle = "#f8f8f8"; ctx.fill();
      ctx.fillStyle = "#16181f"; ctx.fillRect(-r, -r * 0.14, r * 2, r * 0.28);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = "#f8f8f8"; ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * 0.1);
      ctx.strokeStyle = "#16181f";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    const typeText = (text: string, progress: number, y: number, size = 14, color = "#e8eaf2") => {
      const n = Math.floor(text.length * Math.min(1, progress));
      ctx.font = `bold ${size}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(text.slice(0, n), W / 2, y);
    };

    const loop = (now: number) => {
      const e = now - t0;
      if (doneRef.current) return;
      if (e >= TOTAL) { finish(); return; }

      // shake during landing
      let shx = 0, shy = 0;
      if (e > 2680 && e < 2980) {
        shx = (Math.random() - 0.5) * 8;
        shy = (Math.random() - 0.5) * 8;
      }
      ctx.setTransform(1, 0, 0, 1, shx, shy);
      px(-10, -10, W + 20, H + 20, "#0a0c16");

      // twinkling star field
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137) % W;
        const sy = (i * 89) % H;
        const tw = Math.sin(e / 300 + i) > 0.6 ? 0.8 : 0.3;
        px(sx, sy, 2, 2, `rgba(255,255,255,${tw * 0.35})`);
      }

      // phase 1: text lines
      if (e < 1000) typeText(line1, e / 700, H / 2, 12, "#9fb7d8");
      else if (e < 1900) {
        const blink = Math.floor(e / 160) % 2 === 0;
        typeText(line2, 1, H / 2, 14, blink ? "#ffcb05" : "#ffe680");
      }

      // phase 2: ball flight (1900-2680) arc from left
      if (e >= 1900 && e < 2680) {
        const p = (e - 1900) / 780;
        const x = -30 + p * (W / 2 + 30);
        const y = H * 0.62 - Math.sin(p * Math.PI) * 120;
        // trail
        for (let i = 1; i <= 4; i++) {
          const tp = Math.max(0, p - i * 0.05);
          const txp = -30 + tp * (W / 2 + 30);
          const typ = H * 0.62 - Math.sin(tp * Math.PI) * 120;
          ctx.globalAlpha = 0.18 / i;
          drawBall(txp, typ, 14, tp * 14);
          ctx.globalAlpha = 1;
        }
        drawBall(x, y, 14, p * 14);
      }
      // bounce (2680-3050)
      if (e >= 2680 && e < 3050) {
        const p = (e - 2680) / 370;
        const y = H * 0.62 - Math.abs(Math.sin(p * Math.PI * 1.5)) * 26 * (1 - p);
        const squash = p < 0.15 ? 0.7 : 1;
        ctx.save();
        ctx.translate(W / 2, y);
        ctx.scale(1 / squash, squash);
        drawBall(0, 0, 14, 0);
        ctx.restore();
      }
      // open flash (3050-3500)
      if (e >= 3050 && e < 3600) {
        const p = (e - 3050) / 550;
        drawBall(W / 2, H * 0.62, 14 + p * 4, 0);
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.62, p * p * 520, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 2 - p * 2.2)})`;
        ctx.fill();
      }

      // phase 3: title + starters (3500+)
      if (e >= 3500) {
        const p = Math.min(1, (e - 3500) / 500);
        // starters row
        starters.forEach((img, i) => {
          if (!img.complete || img.naturalWidth === 0) return;
          const ix = W / 2 + (i - 1) * 92 - 36;
          const iy = H * 0.52;
          const reveal = Math.min(1, Math.max(0, (e - 3600 - i * 180) / 400));
          if (reveal <= 0) return;
          ctx.save();
          ctx.globalAlpha = reveal;
          ctx.filter = reveal < 1 ? "brightness(0)" : "none";
          ctx.drawImage(img, ix, iy - (1 - reveal) * 16, 72, 72);
          ctx.filter = "none";
          ctx.restore();
        });
        // title slam
        const slam = 1 - Math.min(1, (e - 3500) / 350);
        ctx.save();
        ctx.translate(W / 2, H * 0.3);
        ctx.scale(1 + slam * 2.2, 1 + slam * 2.2);
        ctx.globalAlpha = p;
        ctx.font = `bold 30px "Press Start 2P", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#16181f";
        for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [3, 3], [-3, 3]] as const) {
          ctx.fillText("PokeVerse", ox, oy);
        }
        ctx.fillStyle = "#ffcb05";
        ctx.fillText("PokeVerse", 0, 0);
        ctx.restore();
        if (e > 4200) {
          ctx.font = `bold 9px "Press Start 2P", monospace`;
          ctx.textAlign = "center";
          ctx.fillStyle = "#9fb7d8";
          ctx.fillText("PIXEL ODYSSEY", W / 2, H * 0.3 + 34);
        }
        if (e > 4800 && Math.floor(e / 450) % 2 === 0) {
          ctx.font = `bold 8px "Press Start 2P", monospace`;
          ctx.fillStyle = "#e8eaf2";
          ctx.fillText(t("intro.press").toUpperCase(), W / 2, H * 0.88);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // rAF is throttled in background tabs — make sure the intro always ends
    const failsafe = setTimeout(finish, TOTAL + 1200);

    const skip = () => { if (performance.now() - t0 > 600) finish(); };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0c16] transition-opacity duration-500 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <canvas ref={ref} className="pixelated h-full w-full object-contain" />
      <button
        className="absolute right-4 top-4 rounded bg-white/10 px-3 py-1.5 font-pixel text-[9px] text-white/70 hover:bg-white/20"
        onClick={() => { doneRef.current = true; setClosing(true); setTimeout(onDone, 300); }}
      >
        {t("intro.skip")}
      </button>
    </div>
  );
}
