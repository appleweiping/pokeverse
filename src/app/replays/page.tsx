"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { NavBar, Footer } from "@/components/landing/Sections";
import { HPBar, MonSprite, StatusBadge } from "@/components/shared";
import { listReplays, deleteReplay, type Replay } from "@/lib/game/replays";
import type { BattlerPublicView, Side } from "@/lib/game/battle";
import { getDexMap, getMoveMap, localName } from "@/lib/data/dex";
import type { DexEntry, MoveData } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ReplaysPage() {
  const { t, locale } = useI18n();
  const [replays, setReplays] = useState<Replay[]>([]);
  const [playing, setPlaying] = useState<Replay | null>(null);
  const [pv, setPv] = useState<BattlerPublicView | null>(null);
  const [ev, setEv] = useState<BattlerPublicView | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const dexRef = useRef<Map<number, DexEntry> | null>(null);
  const movesRef = useRef<Map<number, MoveData> | null>(null);
  const stopRef = useRef(false);
  const speedRef = useRef(1);

  useEffect(() => {
    setReplays(listReplays());
    void getDexMap().then((m) => (dexRef.current = m));
    void getMoveMap().then((m) => (movesRef.current = m));
  }, []);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const resolveText = useCallback((key: string, params?: Record<string, string | number>) => {
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params ?? {})) {
      out[k] = typeof v === "string"
        ? v.replace(/%(SPECIES|MOVE|ITEM|STAT|TR|ABILITY)_([\w.\-]+)%/g, (_, kind, id) => {
            if (kind === "SPECIES") return localName(dexRef.current?.get(Number(id))?.n, locale);
            if (kind === "MOVE") return localName(movesRef.current?.get(Number(id))?.n, locale);
            if (kind === "ITEM") return t(`items.${id}.n`);
            if (kind === "STAT") return t(`game.stats.${id}`);
            if (kind === "TR") return t(id);
            return id;
          })
        : v;
    }
    return t(key, out);
  }, [t, locale]);

  const play = useCallback(async (r: Replay) => {
    stopRef.current = false;
    setPlaying(r);
    setRunning(true);
    setLog([]);
    // initial views from team data
    const p0 = r.playerTeam[0];
    const e0 = r.enemyTeam[0];
    setPv({ speciesId: p0.speciesId, level: p0.level, hp: 1, maxHp: 1, status: null, shiny: false });
    setEv({ speciesId: e0.speciesId, level: e0.level, hp: 1, maxHp: 1, status: null, shiny: false });
    for (const e of r.events) {
      if (stopRef.current) break;
      const factor = 1 / speedRef.current;
      if (e.t === "msg") {
        const text = resolveText(e.key, e.params);
        setLog((l) => [...l.slice(-9), text]);
        await sleep(Math.min(1400, Math.max(420, text.length * 18)) * factor);
      } else if (e.t === "hp") {
        const set = e.side === "player" ? setPv : setEv;
        set((v) => (v ? { ...v, hp: e.hp, maxHp: e.maxHp } : v));
        await sleep(320 * factor);
      } else if (e.t === "status") {
        const set = e.side === "player" ? setPv : setEv;
        set((v) => (v ? { ...v, status: e.status } : v));
      } else if (e.t === "switch") {
        const set = e.side === "player" ? setPv : setEv;
        set(e.view);
        await sleep(380 * factor);
      } else if (e.t === "end") {
        setLog((l) => [...l, e.result === "win" ? "🏆" : "—"]);
      }
    }
    setRunning(false);
  }, [resolveText]);

  const stop = () => { stopRef.current = true; setRunning(false); };

  return (
    <div className="min-h-screen bg-ink">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24">
        <h1 className="text-center text-3xl font-black text-sky-300">▶ {t("replay.title")}</h1>
        <p className="mt-1 text-center text-sm text-slate-400">{t("replay.sub")}</p>

        {!playing && (
          <div className="mx-auto mt-8 flex max-w-xl flex-col gap-2">
            {replays.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-panel p-6 text-center text-sm text-slate-400">
                {t("replay.empty")}
              </p>
            )}
            {replays.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-panel px-4 py-3">
                <div className="flex -space-x-2">
                  {r.playerTeam.slice(0, 3).map((m, i) => (
                    <MonSprite key={i} id={m.speciesId} size={36} />
                  ))}
                </div>
                <span className="text-lg text-slate-500">vs</span>
                <div className="flex -space-x-2">
                  {r.enemyTeam.slice(0, 3).map((m, i) => (
                    <MonSprite key={i} id={m.speciesId} size={36} />
                  ))}
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[11px] font-bold text-slate-400">
                    {t(`replay.kind_${r.kind}`)} · {new Date(r.date).toLocaleString()}
                  </div>
                  <div className="mt-1 flex justify-end gap-2">
                    <button onClick={() => void play(r)} className="pixel-btn bg-sky-600 px-3 py-1 text-xs font-bold text-white">
                      ▶ {t("replay.play")}
                    </button>
                    <button
                      onClick={() => { deleteReplay(r.id); setReplays(listReplays()); }}
                      className="pixel-btn bg-slate-600 px-2.5 py-1 text-xs font-bold text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {playing && pv && ev && (
          <div className="mt-8">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#86c4e8] via-[#b8e0c8] to-[#7ec850] p-4 text-ink">
              <div className="flex items-start justify-between">
                <div className="w-52 rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2">
                  <div className="flex justify-between text-sm font-black">
                    <span className="truncate">{localName(dexRef.current?.get(ev.speciesId)?.n, locale)}</span>
                    <span className="text-slate-500">Lv.{ev.level}</span>
                  </div>
                  <HPBar hp={ev.hp} max={ev.maxHp} />
                  <StatusBadge status={ev.status} />
                </div>
                <MonSprite id={ev.speciesId} size={96} animateGen5 />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <MonSprite id={pv.speciesId} back size={112} />
                <div className="w-52 rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2">
                  <div className="flex justify-between text-sm font-black">
                    <span className="truncate">{localName(dexRef.current?.get(pv.speciesId)?.n, locale)}</span>
                    <span className="text-slate-500">Lv.{pv.level}</span>
                  </div>
                  <HPBar hp={pv.hp} max={pv.maxHp} />
                  <StatusBadge status={pv.status} />
                </div>
              </div>
            </div>

            <div className="mt-3 h-40 overflow-y-auto rounded-xl border border-white/10 bg-panel p-3 text-sm leading-relaxed text-slate-200">
              {log.map((l, i) => <div key={i}>· {l}</div>)}
            </div>

            <div className="mt-3 flex items-center gap-2">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded px-3 py-1.5 text-sm font-bold ${speed === s ? "bg-amber-400 text-ink" : "bg-slate-700 text-slate-200"}`}
                >
                  {s}×
                </button>
              ))}
              <button
                onClick={() => { stop(); setPlaying(null); }}
                className="pixel-btn ml-auto bg-slate-600 px-4 py-2 text-sm font-bold text-white"
              >
                ← {t("common.back")}
              </button>
              {!running && (
                <button onClick={() => void play(playing)} className="pixel-btn bg-sky-600 px-4 py-2 text-sm font-bold text-white">
                  ↻ {t("replay.play")}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
