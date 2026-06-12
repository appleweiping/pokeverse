"use client";
import React, { useState } from "react";
import type { TypeName, MajorStatus } from "@/lib/types";
import { TYPE_COLORS } from "@/lib/data/typechart";
import { spriteFront } from "@/lib/data/dex";
import { useI18n } from "@/lib/i18n";

export function TypeBadge({ type, small }: { type: TypeName; small?: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold text-white shadow-sm ${
        small ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{ backgroundColor: TYPE_COLORS[type], textShadow: "0 1px 2px rgba(0,0,0,.45)" }}
    >
      {t(`types.${type}`)}
    </span>
  );
}

export function HPBar({ hp, max, showText }: { hp: number; max: number; showText?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const color = pct > 50 ? "#58d858" : pct > 20 ? "#f8c810" : "#e85048";
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black tracking-wider text-amber-500">HP</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-slate-700 bg-slate-800">
          <div className="hp-fill h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      {showText && (
        <div className="mt-0.5 text-right text-[11px] font-bold tabular-nums text-slate-300">
          {Math.max(0, hp)} / {max}
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<MajorStatus, string> = {
  par: "#c8a818", brn: "#e07030", psn: "#a040a0", tox: "#803090", slp: "#9098a8", frz: "#58b8d0",
};

export function StatusBadge({ status }: { status: MajorStatus | null }) {
  const { t } = useI18n();
  if (!status) return null;
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[9px] font-black text-white"
      style={{ backgroundColor: STATUS_COLORS[status] }}
    >
      {t(`game.status.${status}`)}
    </span>
  );
}

/** Pokémon sprite with shiny support + graceful fallback. */
export function MonSprite({
  id, shiny, back, size = 96, className = "", animateGen5 = false,
}: {
  id: number; shiny?: boolean; back?: boolean; size?: number; className?: string; animateGen5?: boolean;
}) {
  const [err, setErr] = useState(false);
  let src: string;
  if (err) {
    src = spriteFront(id, false);
  } else if (animateGen5 && id <= 649 && !back) {
    src = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/versions/generation-v/black-white/animated/${shiny ? "shiny/" : ""}${id}.gif`;
  } else {
    src = back
      ? `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/back/${shiny ? "shiny/" : ""}${id}.png`
      : spriteFront(id, shiny);
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      onError={() => setErr(true)}
      alt={`#${id}`}
      width={size}
      height={size}
      className={`sprite pixelated ${className}`}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
      loading="lazy"
    />
  );
}

export function PokeballIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="10" fill="#e3350d" />
      <path d="M2 12h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#f8f8f8" />
      <rect x="2" y="11" width="20" height="2.4" fill="#16181f" />
      <circle cx="12" cy="12" r="3.4" fill="#f8f8f8" stroke="#16181f" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="#16181f" strokeWidth="2" />
    </svg>
  );
}

/** GBA-style Pokémon egg: cream shell, dark outline, green speckles. */
export function EggSprite({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={`pixelated ${className}`} shapeRendering="crispEdges">
      <path d="M6 1h4v1h2v2h1v2h1v4h-1v2h-1v1h-2v1H6v-1H4v-1H3v-2H2V6h1V4h1V2h2z" fill="#3a3328" />
      <path d="M6 2h4v1h1v1h1v2h1v4h-1v2h-1v1h-1v1H6v-1H5v-1H4v-2H3V6h1V4h1V3h1z" fill="#f5ead0" />
      <path d="M10 3h1v1h1v2h1v4h-1v2h-1v1h-1v1H8v-1h2v-1h1v-2h1V6h-1V4h-1z" fill="#dcc89c" />
      <rect x="6" y="5" width="2" height="2" fill="#7ab468" />
      <rect x="9" y="8" width="2" height="2" fill="#7ab468" />
      <rect x="5" y="10" width="1" height="1" fill="#7ab468" />
      <rect x="5" y="3" width="1" height="2" fill="#fffbe8" />
    </svg>
  );
}
