"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  getDexMap, getMoveMap, loadFlavor, loadLearnsets, localName, dexNo,
  spriteArtwork, spriteAnimated, cryUrl, genOf, MAX_DEX_ID, LOCALE_TO_NAMELANG,
} from "@/lib/data/dex";
import type { DexEntry, FlavorMap, Learnsets, MoveData } from "@/lib/types";
import { TYPE_COLORS, effectiveness } from "@/lib/data/typechart";
import { ALL_TYPES } from "@/lib/types";
import { NavBar, Footer } from "@/components/landing/Sections";
import { TypeBadge } from "@/components/shared";
import { audio } from "@/lib/audio/tracks";

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

export default function DexDetail() {
  const params = useParams<{ id: string }>();
  const id = Math.max(1, Math.min(MAX_DEX_ID, Number(params.id) || 1));
  const { t, locale } = useI18n();
  const [dexMap, setDexMap] = useState<Map<number, DexEntry> | null>(null);
  const [moveMap, setMoveMap] = useState<Map<number, MoveData> | null>(null);
  const [learnsets, setLearnsets] = useState<Learnsets | null>(null);
  const [flavor, setFlavor] = useState<FlavorMap | null>(null);
  const [artErr, setArtErr] = useState(false);

  useEffect(() => {
    void getDexMap().then(setDexMap);
    void getMoveMap().then(setMoveMap);
    void loadLearnsets().then(setLearnsets);
    void loadFlavor().then(setFlavor);
  }, []);
  useEffect(() => setArtErr(false), [id]);

  const e = dexMap?.get(id);
  const fl = flavor?.[String(id)];
  const ls = learnsets?.[String(id)] ?? [];

  // evolution chain (walk back to root, then forward)
  const evoChain = useMemo(() => {
    if (!dexMap || !e) return [];
    const parentOf = new Map<number, number>();
    for (const [, entry] of dexMap) {
      for (const edge of entry.evo ?? []) parentOf.set(edge.to, entry.id);
    }
    let root = id;
    while (parentOf.has(root)) root = parentOf.get(root)!;
    const stages: number[][] = [[root]];
    while (true) {
      const last = stages[stages.length - 1];
      const next: number[] = [];
      for (const sid of last) {
        for (const edge of dexMap.get(sid)?.evo ?? []) next.push(edge.to);
      }
      if (!next.length) break;
      stages.push(next);
    }
    return stages;
  }, [dexMap, e, id]);

  // weaknesses
  const weaknesses = useMemo(() => {
    if (!e) return [];
    return ALL_TYPES
      .map((atk) => ({ atk, m: effectiveness(atk, e.t) }))
      .filter(({ m }) => m !== 1)
      .sort((a, b) => b.m - a.m);
  }, [e]);

  if (!e) {
    return (
      <div className="min-h-screen bg-ink">
        <NavBar />
        <p className="pt-40 text-center text-slate-400">{t("dex.loading")}</p>
      </div>
    );
  }

  const name = localName(e.n, locale);
  const genus = localName(e.g, locale);
  const flText = fl ? fl[LOCALE_TO_NAMELANG[locale]] ?? fl.en ?? Object.values(fl)[0] : "";
  const total = e.s.reduce((a, b) => a + b, 0);
  const accent = TYPE_COLORS[e.t[0]];

  return (
    <div className="min-h-screen bg-ink">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-24">
        {/* header nav */}
        <div className="flex items-center justify-between text-sm font-bold">
          <Link className="text-slate-400 hover:text-amber-300" href="/pokedex">← {t("dex.back")}</Link>
          <div className="flex gap-2">
            {id > 1 && <Link className="rounded-lg bg-panel px-3 py-1.5 hover:bg-white/10" href={`/pokedex/${id - 1}`}>← {dexNo(id - 1)}</Link>}
            {id < MAX_DEX_ID && <Link className="rounded-lg bg-panel px-3 py-1.5 hover:bg-white/10" href={`/pokedex/${id + 1}`}>{dexNo(id + 1)} →</Link>}
          </div>
        </div>

        {/* hero card */}
        <div
          className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl sm:p-8"
          style={{ background: `linear-gradient(135deg, ${accent}33, #181d2c 60%)` }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: accent }}
          />
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artErr ? spriteAnimated(id) : spriteArtwork(id)}
                onError={() => setArtErr(true)}
                alt={name}
                className="h-52 w-52 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,.5)] sm:h-64 sm:w-64"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-sm font-bold text-slate-400">{dexNo(id)} · {t("dex.gen", { n: genOf(id) })}</div>
              <h1 className="mt-1 text-4xl font-black text-white">{name}</h1>
              <div className="mt-1 text-sm font-bold" style={{ color: accent }}>{genus}</div>
              <div className="mt-3 flex justify-center gap-2 sm:justify-start">
                {e.t.map((tp) => <TypeBadge key={tp} type={tp} />)}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm sm:justify-start">
                <span className="rounded-lg bg-white/10 px-3 py-1.5"><b>{t("dex.height")}</b> {(e.h / 10).toFixed(1)} m</span>
                <span className="rounded-lg bg-white/10 px-3 py-1.5"><b>{t("dex.weight")}</b> {(e.w / 10).toFixed(1)} kg</span>
                <button
                  onClick={() => audio.cry(cryUrl(id))}
                  className="rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-ink hover:brightness-110"
                >
                  🔊 {t("dex.cry")}
                </button>
              </div>
              {flText && <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">{flText}</p>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* stats */}
          <section className="rounded-2xl border border-white/10 bg-panel/80 p-5">
            <h2 className="mb-4 font-black text-amber-300">{t("dex.stats")}</h2>
            {STAT_KEYS.map((k, i) => (
              <div key={k} className="mb-2 flex items-center gap-3">
                <span className="w-14 text-right text-xs font-bold text-slate-400">{t(`dex.statNames.${k}`)}</span>
                <span className="w-9 text-right text-sm font-black tabular-nums text-white">{e.s[i]}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (e.s[i] / 200) * 100)}%`,
                      backgroundColor: e.s[i] >= 110 ? "#58d858" : e.s[i] >= 75 ? "#f8c810" : "#e87050",
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-3 border-t border-white/10 pt-2 text-right text-sm">
              <span className="text-slate-400">{t("dex.total")} </span>
              <b className="text-lg text-amber-300">{total}</b>
            </div>
            {/* weaknesses */}
            {weaknesses.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-bold text-slate-400">⚔ {t("site.typechart.title")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {weaknesses.map(({ atk, m }) => (
                    <span
                      key={atk}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold text-white"
                      style={{ backgroundColor: TYPE_COLORS[atk] + (m > 1 ? "ff" : "70") }}
                    >
                      {t(`types.${atk}`)} ×{m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* evolution */}
          <section className="rounded-2xl border border-white/10 bg-panel/80 p-5">
            <h2 className="mb-4 font-black text-amber-300">{t("dex.evolution")}</h2>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {evoChain.map((stage, si) => (
                <React.Fragment key={si}>
                  {si > 0 && <span className="text-xl text-slate-500">→</span>}
                  <div className="flex flex-col gap-2">
                    {stage.map((sid) => (
                      <Link
                        key={sid}
                        href={`/pokedex/${sid}`}
                        className={`flex flex-col items-center rounded-xl p-2 transition-colors hover:bg-white/10 ${sid === id ? "ring-2 ring-amber-300" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={spriteAnimated(sid)} alt={`#${sid}`} className="sprite pixelated h-16 w-16 object-contain" loading="lazy" />
                        <span className="mt-1 text-xs font-bold text-slate-300">{localName(dexMap?.get(sid)?.n, locale)}</span>
                      </Link>
                    ))}
                  </div>
                </React.Fragment>
              ))}
              {evoChain.length === 1 && <span className="text-sm text-slate-500">—</span>}
            </div>
          </section>
        </div>

        {/* learnset */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-panel/80 p-5">
          <h2 className="mb-4 font-black text-amber-300">{t("dex.moves")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/15 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3">{t("dex.level")}</th>
                  <th className="py-2 pr-3">{t("dex.moves")}</th>
                  <th className="py-2 pr-3">{t("dex.class")}</th>
                  <th className="py-2 pr-3 text-right">{t("dex.power")}</th>
                  <th className="py-2 pr-3 text-right">{t("dex.acc")}</th>
                  <th className="py-2 text-right">PP</th>
                </tr>
              </thead>
              <tbody>
                {ls.map(([lv, mid], i) => {
                  const m = moveMap?.get(mid);
                  if (!m) return null;
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-3 font-bold tabular-nums text-slate-300">{lv || "—"}</td>
                      <td className="py-2 pr-3">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[m.t] }} />
                        <b className="text-white">{localName(m.n, locale)}</b>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-400">
                        {m.c === 0 ? t("dex.physical") : m.c === 1 ? t("dex.special") : t("dex.status")}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{m.p || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{m.a ? `${m.a}%` : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{m.pp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ls.length === 0 && <p className="py-4 text-center text-sm text-slate-500">—</p>}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
