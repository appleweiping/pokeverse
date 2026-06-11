"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { NavBar, Footer } from "@/components/landing/Sections";
import { HPBar, MonSprite, PokeballIcon, StatusBadge } from "@/components/shared";
import type { Mon, SaveData } from "@/lib/types";
import { NetRoom, type NetMsg } from "@/lib/net/peer";
import { BattleSession, type BattleEvent, type BattlerPublicView, type Side } from "@/lib/game/battle";
import { getDexMap, getMoveMap, localName } from "@/lib/data/dex";
import type { DexEntry, MoveData } from "@/lib/types";
import { mulberry32 } from "@/lib/data/formulas";
import { audio } from "@/lib/audio/tracks";

type Stage = "menu" | "hosting" | "joining" | "lobby" | "pick" | "battle" | "trade" | "done";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sanitizeMon(m: Mon): Mon | null {
  if (!m || typeof m.speciesId !== "number" || m.speciesId < 1 || m.speciesId > 1025) return null;
  if (typeof m.level !== "number" || m.level < 1 || m.level > 100) return null;
  if (!Array.isArray(m.moves) || m.moves.length === 0) return null;
  return m;
}

export default function OnlineBattlePage() {
  const { t, locale } = useI18n();
  const [stage, setStage] = useState<Stage>("menu");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("");
  const [save, setSave] = useState<SaveData | null>(null);
  const [mode, setMode] = useState<"battle" | "trade">("battle");
  const [myPick, setMyPick] = useState<Mon | null>(null);
  const [theirPick, setTheirPick] = useState<Mon | null>(null);
  const [tradeConfirmed, setTradeConfirmed] = useState({ me: false, them: false });
  const [copied, setCopied] = useState(false);

  // battle state
  const [pv, setPv] = useState<BattlerPublicView | null>(null); // my view
  const [ev, setEv] = useState<BattlerPublicView | null>(null); // opponent view
  const [log, setLog] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [animMine, setAnimMine] = useState("");
  const [animTheirs, setAnimTheirs] = useState("");

  const roomRef = useRef<NetRoom | null>(null);
  const sessionRef = useRef<BattleSession | null>(null);
  const dexRef = useRef<Map<number, DexEntry> | null>(null);
  const movesRef = useRef<Map<number, MoveData> | null>(null);
  const isHostRef = useRef(false);
  const turnRef = useRef(0);
  const myActionRef = useRef<number | null>(null);
  const theirActionRef = useRef<number | null>(null);
  const seedRef = useRef<number | null>(null);
  const picksRef = useRef<{ mine: Mon | null; theirs: Mon | null }>({ mine: null, theirs: null });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pv.save.v1");
      if (raw) setSave(JSON.parse(raw));
    } catch {}
    void getDexMap().then((m) => (dexRef.current = m));
    void getMoveMap().then((m) => (movesRef.current = m));
    return () => roomRef.current?.close();
  }, []);

  const flipKey = (key: string): string => {
    const map: Record<string, string> = {
      "game.battle.used": "game.battle.enemy_used",
      "game.battle.enemy_used": "game.battle.used",
      "game.battle.fainted": "game.battle.enemy_fainted",
      "game.battle.enemy_fainted": "game.battle.fainted",
    };
    return map[key] ?? key;
  };

  const resolveText = useCallback((key: string, params?: Record<string, string | number>) => {
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params ?? {})) {
      out[k] = typeof v === "string"
        ? v.replace(/%(SPECIES|MOVE|STAT)_([\w.-]+)%/g, (_, kind, id) => {
            if (kind === "SPECIES") return localName(dexRef.current?.get(Number(id))?.n, locale);
            if (kind === "MOVE") return localName(movesRef.current?.get(Number(id))?.n, locale);
            return t(`game.stats.${id}`);
          })
        : v;
    }
    return t(key, out);
  }, [t, locale]);

  // ---------------------------------------------------------------- net
  const makeRoom = () =>
    new NetRoom((s, err) => {
      if (s === "connected") { setStage("lobby"); setStatus(t("online.connected")); audio.sfx("select"); }
      if (s === "closed") { setStatus(t("online.disconnected")); }
      if (s === "error") { setStatus(t("online.error") + (err ? ` (${err})` : "")); }
    });

  const onMsg = useCallback(async (msg: NetMsg) => {
    const room = roomRef.current;
    if (!room) return;
    switch (msg.type) {
      case "mode":
        setMode(msg.mode);
        setStage("pick");
        setMyPick(null); setTheirPick(null);
        picksRef.current = { mine: null, theirs: null };
        setTradeConfirmed({ me: false, them: false });
        break;
      case "pick": {
        const m = sanitizeMon(msg.mon);
        if (!m) return;
        picksRef.current.theirs = m;
        setTheirPick(m);
        void maybeStartBattle();
        break;
      }
      case "seed":
        seedRef.current = msg.seed;
        void maybeStartBattle();
        break;
      case "action":
        theirActionRef.current = msg.moveIdx;
        void maybeRunTurn();
        break;
      case "trade-offer": {
        const m = sanitizeMon(msg.mon);
        if (!m) return;
        picksRef.current.theirs = m;
        setTheirPick(m);
        break;
      }
      case "trade-confirm":
        setTradeConfirmed((c) => {
          const next = { ...c, them: true };
          if (next.me) void executeTrade();
          return next;
        });
        break;
      case "surrender":
        setResult("win");
        setStage("done");
        audio.playMusic("victory");
        break;
      case "bye":
        setStatus(t("online.disconnected"));
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const host = async () => {
    setStage("hosting");
    setStatus(t("online.connecting"));
    const room = makeRoom();
    roomRef.current = room;
    room.on((m) => void onMsg(m));
    isHostRef.current = true;
    try {
      const c = await room.host();
      setCode(c);
      setStatus(t("online.waiting"));
    } catch { /* status set by cb */ }
  };

  const join = async () => {
    if (!joinCode.trim()) return;
    setStage("joining");
    setStatus(t("online.connecting"));
    const room = makeRoom();
    roomRef.current = room;
    room.on((m) => void onMsg(m));
    isHostRef.current = false;
    try {
      await room.join(joinCode);
    } catch { /* cb */ }
  };

  const chooseMode = (m: "battle" | "trade") => {
    setMode(m);
    roomRef.current?.send({ type: "mode", mode: m });
    setStage("pick");
    setMyPick(null); setTheirPick(null);
    picksRef.current = { mine: null, theirs: null };
    setTradeConfirmed({ me: false, them: false });
  };

  const pickMon = (m: Mon) => {
    audio.sfx("select");
    const copy: Mon = JSON.parse(JSON.stringify(m));
    picksRef.current.mine = copy;
    setMyPick(copy);
    if (mode === "battle") {
      roomRef.current?.send({ type: "pick", mon: copy });
      if (isHostRef.current) {
        seedRef.current = Math.floor(Math.random() * 2 ** 31);
        roomRef.current?.send({ type: "seed", seed: seedRef.current });
      }
      void maybeStartBattle();
    } else {
      roomRef.current?.send({ type: "trade-offer", mon: copy });
    }
  };

  // ---------------------------------------------------------------- battle flow
  const maybeStartBattle = useCallback(async () => {
    const { mine, theirs } = picksRef.current;
    if (!mine || !theirs || seedRef.current == null || sessionRef.current) return;
    // canonical session: host's mon is "player" on BOTH peers (deterministic)
    const hostMon = isHostRef.current ? mine : theirs;
    const guestMon = isHostRef.current ? theirs : mine;
    const session = await BattleSession.create("trainer", [hostMon], [guestMon], {
      rng: mulberry32(seedRef.current),
    });
    sessionRef.current = session;
    turnRef.current = 0;
    const mySide: Side = isHostRef.current ? "player" : "enemy";
    setPv(mySide === "player" ? session.playerView() : session.enemyView());
    setEv(mySide === "player" ? session.enemyView() : session.playerView());
    setLog([]);
    setResult(null);
    setStage("battle");
    audio.playMusic("battle_trainer");
  }, []);

  const playEvents = useCallback(async (events: BattleEvent[]) => {
    const mySide: Side = isHostRef.current ? "player" : "enemy";
    for (const e of events) {
      if (e.t === "msg") {
        const key = isHostRef.current ? e.key : flipKey(e.key);
        const text = resolveText(key, e.params);
        setLog((l) => [...l.slice(-7), text]);
        await sleep(Math.min(1600, Math.max(550, text.length * 22)));
      } else if (e.t === "hp") {
        const mine = e.side === mySide;
        if (mine) setPv((v) => (v ? { ...v, hp: e.hp, maxHp: e.maxHp } : v));
        else setEv((v) => (v ? { ...v, hp: e.hp, maxHp: e.maxHp } : v));
        await sleep(420);
      } else if (e.t === "status") {
        const mine = e.side === mySide;
        if (mine) setPv((v) => (v ? { ...v, status: e.status } : v));
        else setEv((v) => (v ? { ...v, status: e.status } : v));
      } else if (e.t === "anim") {
        const mine = e.side === mySide;
        const setA = mine ? setAnimMine : setAnimTheirs;
        if (e.kind === "attack") { setA(mine ? "anim-lunge" : "anim-lunge-enemy"); await sleep(320); setA(""); }
        else if (e.kind.startsWith("hit")) {
          audio.sfx(e.kind as "hit" | "hit_super" | "hit_weak");
          setA("anim-shake anim-flash"); await sleep(420); setA("");
        } else if (e.kind === "faint") { audio.sfx("faint"); setA("anim-faint"); await sleep(650); }
      } else if (e.t === "end") {
        const iWon = (e.result === "win") === isHostRef.current;
        setResult(iWon ? "win" : "lose");
        audio.playMusic(iWon ? "victory" : "town");
        setStage("done");
      }
    }
  }, [resolveText]);

  const maybeRunTurn = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || session.over) return;
    if (myActionRef.current == null || theirActionRef.current == null) return;
    const myIdx = myActionRef.current;
    const theirIdx = theirActionRef.current;
    myActionRef.current = null;
    theirActionRef.current = null;
    setWaiting(false);
    const hostIdx = isHostRef.current ? myIdx : theirIdx;
    const guestIdx = isHostRef.current ? theirIdx : myIdx;
    const events = await session.pvpTurn(hostIdx, guestIdx);
    turnRef.current++;
    await playEvents(events);
  }, [playEvents]);

  const submitMove = (idx: number) => {
    if (waiting || !sessionRef.current || sessionRef.current.over) return;
    audio.sfx("select");
    myActionRef.current = idx;
    roomRef.current?.send({ type: "action", turn: turnRef.current, moveIdx: idx });
    setWaiting(true);
    void maybeRunTurn();
  };

  const surrender = () => {
    roomRef.current?.send({ type: "surrender" });
    setResult("lose");
    setStage("done");
  };

  // ---------------------------------------------------------------- trade flow
  const confirmTrade = () => {
    audio.sfx("select");
    roomRef.current?.send({ type: "trade-confirm" });
    setTradeConfirmed((c) => {
      const next = { ...c, me: true };
      if (next.them) void executeTrade();
      return next;
    });
  };

  const executeTrade = async () => {
    const { mine, theirs } = picksRef.current;
    if (!mine || !theirs || !save) return;
    const idx = save.party.findIndex((m) => m.uid === mine.uid);
    if (idx >= 0) {
      theirs.uid = theirs.uid + "_t" + Date.now().toString(36).slice(-3);
      save.party[idx] = theirs;
      if (!save.dexSeen.includes(theirs.speciesId)) save.dexSeen.push(theirs.speciesId);
      if (!save.dexCaught.includes(theirs.speciesId)) save.dexCaught.push(theirs.speciesId);
      try { localStorage.setItem("pv.save.v1", JSON.stringify(save)); } catch {}
      setSave({ ...save });
    }
    audio.sfx("evolve");
    setStatus(t("online.trade_done"));
    setStage("lobby");
    picksRef.current = { mine: null, theirs: null };
    setMyPick(null); setTheirPick(null);
    setTradeConfirmed({ me: false, them: false });
  };

  // ---------------------------------------------------------------- render
  const monName = (m: Mon) => m.nickname ?? localName(dexRef.current?.get(m.speciesId)?.n, locale);
  const party = save?.party ?? [];

  const myMoves = (() => {
    const s = sessionRef.current;
    if (!s) return [];
    const b = isHostRef.current ? s.player : s.enemy;
    return b.mon.moves.map((mv, i) => ({
      idx: i,
      data: movesRef.current?.get(mv.id),
      pp: isHostRef.current ? mv.pp : b.pp[i],
    }));
  })();

  return (
    <div className="min-h-screen bg-ink">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24">
        <h1 className="text-center text-3xl font-black text-violet-300">{t("online.title")}</h1>
        <p className="mt-1 text-center text-sm text-slate-400">{t("online.sub")}</p>
        {status && <p className="mt-3 text-center text-sm font-bold text-amber-300">{status}</p>}

        {/* ---------- menu ---------- */}
        {stage === "menu" && (
          <div className="mx-auto mt-10 flex max-w-md flex-col gap-4">
            {party.length === 0 && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-center text-sm text-amber-200">
                {t("online.need_save")} → <a className="font-bold underline" href="/play">{t("site.nav.play")}</a>
              </div>
            )}
            <button
              disabled={party.length === 0}
              onClick={host}
              className="pixel-btn bg-violet-600 px-6 py-4 text-lg font-black text-white disabled:opacity-40"
            >
              ⊕ {t("online.create")}
            </button>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t("online.code_ph")}
                maxLength={6}
                className="flex-1 rounded-xl border border-white/15 bg-panel px-4 py-3 text-center text-lg font-black tracking-[0.3em] text-white outline-none focus:border-violet-400"
              />
              <button
                disabled={party.length === 0 || joinCode.length < 6}
                onClick={join}
                className="pixel-btn bg-sky-600 px-6 py-3 font-black text-white disabled:opacity-40"
              >
                {t("online.join")}
              </button>
            </div>
            <p className="text-center text-xs text-slate-500">{t("online.p2p_note")}</p>
          </div>
        )}

        {/* ---------- hosting: show code ---------- */}
        {stage === "hosting" && code && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-panel p-6 text-center">
            <div className="text-sm text-slate-400">{t("online.your_code")}</div>
            <div className="my-3 font-pixel text-3xl tracking-[0.35em] text-amber-300">{code}</div>
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
              }}
              className="pixel-btn bg-slate-600 px-4 py-2 text-sm font-bold text-white"
            >
              {copied ? t("online.copied") : t("online.copy")}
            </button>
            <p className="mt-4 animate-blink text-sm text-slate-400">{t("online.waiting")}</p>
          </div>
        )}

        {/* ---------- lobby ---------- */}
        {stage === "lobby" && (
          <div className="mx-auto mt-10 flex max-w-md flex-col gap-4">
            <button onClick={() => chooseMode("battle")} className="pixel-btn bg-pokered px-6 py-4 text-lg font-black text-white">
              ⚔ {t("online.battle")}
            </button>
            <button onClick={() => chooseMode("trade")} className="pixel-btn bg-emerald-600 px-6 py-4 text-lg font-black text-white">
              ⇄ {t("online.trade")}
            </button>
          </div>
        )}

        {/* ---------- pick ---------- */}
        {stage === "pick" && (
          <div className="mt-8">
            <h2 className="mb-3 text-center font-bold text-slate-200">
              {mode === "battle" ? t("online.select_mon") : t("online.select_trade")}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {party.map((m) => (
                <button
                  key={m.uid}
                  disabled={!!myPick || m.curHP <= 0}
                  onClick={() => pickMon(m)}
                  className={`flex flex-col items-center rounded-xl border p-3 transition-colors ${
                    myPick?.uid === m.uid ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-panel hover:bg-white/5"
                  } disabled:opacity-50`}
                >
                  <MonSprite id={m.speciesId} size={64} />
                  <b className="mt-1 text-sm">{monName(m)}</b>
                  <span className="text-xs text-slate-400">Lv.{m.level}</span>
                </button>
              ))}
            </div>

            {/* trade confirm box */}
            {mode === "trade" && (myPick || theirPick) && (
              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-panel p-4">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-xs text-slate-400">{t("online.you")}</div>
                    {myPick ? <MonSprite id={myPick.speciesId} size={72} /> : <div className="h-[72px] w-[72px]" />}
                    <b className="text-sm">{myPick ? monName(myPick) : "…"}</b>
                  </div>
                  <span className="text-2xl text-emerald-400">⇄</span>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">{t("online.opponent")}</div>
                    {theirPick ? <MonSprite id={theirPick.speciesId} size={72} /> : <div className="h-[72px] w-[72px]" />}
                    <b className="text-sm">{theirPick ? monName(theirPick) : "…"}</b>
                  </div>
                </div>
                <button
                  disabled={!myPick || !theirPick || tradeConfirmed.me}
                  onClick={confirmTrade}
                  className="pixel-btn mt-4 w-full bg-emerald-600 py-2.5 font-black text-white disabled:opacity-40"
                >
                  {tradeConfirmed.me ? t("online.waiting_move") : t("online.confirm_trade")}
                </button>
              </div>
            )}
            {mode === "battle" && myPick && (
              <p className="mt-4 animate-blink text-center text-sm text-slate-400">{t("online.waiting")}</p>
            )}
          </div>
        )}

        {/* ---------- battle ---------- */}
        {(stage === "battle" || stage === "done") && pv && ev && (
          <div className="mt-8">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#86c4e8] via-[#b8e0c8] to-[#7ec850] p-4 text-ink">
              {/* opponent */}
              <div className="flex items-start justify-between">
                <div className="w-56 max-w-[55%] rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2">
                  <div className="flex justify-between text-sm font-black">
                    <span className="truncate">{localName(dexRef.current?.get(ev.speciesId)?.n, locale)}</span>
                    <span className="text-slate-500">Lv.{ev.level}</span>
                  </div>
                  <HPBar hp={ev.hp} max={ev.maxHp} />
                  <StatusBadge status={ev.status} />
                </div>
                <div className={animTheirs}>
                  <MonSprite id={ev.speciesId} shiny={ev.shiny} size={104} animateGen5 />
                </div>
              </div>
              {/* me */}
              <div className="mt-4 flex items-end justify-between">
                <div className={animMine}>
                  <MonSprite id={pv.speciesId} shiny={pv.shiny} back size={120} />
                </div>
                <div className="w-56 max-w-[55%] rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2">
                  <div className="flex justify-between text-sm font-black">
                    <span className="truncate">{localName(dexRef.current?.get(pv.speciesId)?.n, locale)}</span>
                    <span className="text-slate-500">Lv.{pv.level}</span>
                  </div>
                  <HPBar hp={pv.hp} max={pv.maxHp} showText />
                  <StatusBadge status={pv.status} />
                </div>
              </div>
            </div>

            {/* log */}
            <div className="mt-3 h-32 overflow-y-auto rounded-xl border border-white/10 bg-panel p-3 text-sm leading-relaxed text-slate-200">
              {log.map((l, i) => <div key={i}>· {l}</div>)}
              {stage === "done" && result && (
                <div className={`mt-1 text-lg font-black ${result === "win" ? "text-amber-300" : "text-slate-400"}`}>
                  {result === "win" ? "🏆 WIN!" : "LOSE…"}
                </div>
              )}
            </div>

            {/* moves */}
            {stage === "battle" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {myMoves.map(({ idx, data, pp }) => (
                  <button
                    key={idx}
                    disabled={waiting || pp <= 0}
                    onClick={() => submitMove(idx)}
                    className="pixel-btn bg-white px-3 py-2.5 text-left disabled:opacity-40"
                  >
                    <b className="text-sm text-ink">{localName(data?.n, locale)}</b>
                    <span className="ml-2 text-xs text-slate-500">PP {pp}{data?.p ? ` · ${data.p}` : ""}</span>
                  </button>
                ))}
                <button onClick={surrender} className="pixel-btn col-span-2 bg-slate-600 py-2 text-sm font-bold text-white">
                  🏳 {t("common.cancel")}
                </button>
                {waiting && <p className="col-span-2 animate-blink text-center text-xs text-slate-400">{t("online.waiting_move")}</p>}
              </div>
            )}
            {stage === "done" && (
              <button
                onClick={() => {
                  sessionRef.current = null;
                  seedRef.current = null;
                  setStage("lobby");
                  setPv(null); setEv(null); setLog([]);
                  picksRef.current = { mine: null, theirs: null };
                  setMyPick(null); setTheirPick(null);
                }}
                className="pixel-btn mt-3 w-full bg-violet-600 py-3 font-black text-white"
              >
                ← {t("online.title")}
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
