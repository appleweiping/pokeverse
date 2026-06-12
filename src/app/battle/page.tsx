"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { NavBar, Footer } from "@/components/landing/Sections";
import { HPBar, MonSprite, StatusBadge } from "@/components/shared";
import type { Mon, SaveData } from "@/lib/types";
import { NetRoom, type NetMsg } from "@/lib/net/peer";
import { BattleSession, type BattleAction, type BattleEvent, type BattlerPublicView, type Side } from "@/lib/game/battle";
import { getDexMap, getMoveMap, localName } from "@/lib/data/dex";
import type { DexEntry, MoveData } from "@/lib/types";
import { mulberry32 } from "@/lib/data/formulas";
import { audio } from "@/lib/audio/tracks";
import { saveReplay } from "@/lib/game/replays";

type Stage = "menu" | "hosting" | "joining" | "lobby" | "pick" | "battle" | "trade" | "done";
const TEAM_SIZE = 3;

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
  const [myPicks, setMyPicks] = useState<Mon[]>([]);
  const [picksSent, setPicksSent] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [tradePick, setTradePick] = useState<Mon | null>(null);
  const [theirTrade, setTheirTrade] = useState<Mon | null>(null);
  const [tradeConfirmed, setTradeConfirmed] = useState({ me: false, them: false });
  const [copied, setCopied] = useState(false);

  // battle state
  const [pv, setPv] = useState<BattlerPublicView | null>(null);
  const [ev, setEv] = useState<BattlerPublicView | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [needReplace, setNeedReplace] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [animMine, setAnimMine] = useState("");
  const [animTheirs, setAnimTheirs] = useState("");
  const [, force] = useState(0);

  const roomRef = useRef<NetRoom | null>(null);
  const sessionRef = useRef<BattleSession | null>(null);
  const dexRef = useRef<Map<number, DexEntry> | null>(null);
  const movesRef = useRef<Map<number, MoveData> | null>(null);
  const isHostRef = useRef(false);
  const turnRef = useRef(0);
  const myActionRef = useRef<BattleAction | null>(null);
  const theirActionRef = useRef<BattleAction | null>(null);
  const seedRef = useRef<number | null>(null);
  const picksRef = useRef<{ mine: Mon[]; theirs: Mon[] }>({ mine: [], theirs: [] });
  const tradeRef = useRef<{ mine: Mon | null; theirs: Mon | null }>({ mine: null, theirs: null });
  const busyRef = useRef(false);

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
        ? v.replace(/%(SPECIES|MOVE|STAT|TR)_([\w.\-]+)%/g, (_, kind, id) => {
            if (kind === "SPECIES") return localName(dexRef.current?.get(Number(id))?.n, locale);
            if (kind === "MOVE") return localName(movesRef.current?.get(Number(id))?.n, locale);
            if (kind === "TR") return t(id);
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
      if (s === "closed") setStatus(t("online.disconnected"));
      if (s === "error") setStatus(t("online.error") + (err ? ` (${err})` : ""));
    });

  const mySide = (): Side => (isHostRef.current ? "player" : "enemy");

  const refreshViews = () => {
    const s = sessionRef.current;
    if (!s) return;
    setPv(mySide() === "player" ? s.playerView() : s.enemyView());
    setEv(mySide() === "player" ? s.enemyView() : s.playerView());
  };

  const onMsg = useCallback(async (msg: NetMsg) => {
    switch (msg.type) {
      case "mode":
        setMode(msg.mode);
        setStage("pick");
        resetPicks();
        break;
      case "team": {
        const team = msg.mons.map(sanitizeMon).filter(Boolean) as Mon[];
        if (team.length !== TEAM_SIZE) return;
        picksRef.current.theirs = team;
        setTheirReady(true);
        void maybeStartBattle();
        break;
      }
      case "seed":
        seedRef.current = msg.seed;
        void maybeStartBattle();
        break;
      case "action":
        theirActionRef.current = msg.act;
        void maybeRunTurn();
        break;
      case "replace": {
        const s = sessionRef.current;
        if (!s) return;
        const evs = msg.side === "host" ? await s.replaceFainted(msg.idx) : await s.replaceFaintedEnemy(msg.idx);
        await playEvents(evs);
        refreshViews();
        break;
      }
      case "trade-offer": {
        const m = sanitizeMon(msg.mon);
        if (!m) return;
        tradeRef.current.theirs = m;
        setTheirTrade(m);
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
        finishBattle("win");
        break;
      case "bye":
        setStatus(t("online.disconnected"));
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const resetPicks = () => {
    setMyPicks([]); setPicksSent(false); setTheirReady(false);
    picksRef.current = { mine: [], theirs: [] };
    tradeRef.current = { mine: null, theirs: null };
    setTradePick(null); setTheirTrade(null);
    setTradeConfirmed({ me: false, them: false });
  };

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
    } catch {}
  };

  const join = async () => {
    if (!joinCode.trim()) return;
    setStage("joining");
    setStatus(t("online.connecting"));
    const room = makeRoom();
    roomRef.current = room;
    room.on((m) => void onMsg(m));
    isHostRef.current = false;
    try { await room.join(joinCode); } catch {}
  };

  const chooseMode = (m: "battle" | "trade") => {
    setMode(m);
    roomRef.current?.send({ type: "mode", mode: m });
    setStage("pick");
    resetPicks();
  };

  // ---------------------------------------------------------------- pick
  const togglePick = (m: Mon) => {
    if (picksSent) return;
    audio.sfx("move");
    setMyPicks((cur) => {
      if (cur.some((x) => x.uid === m.uid)) return cur.filter((x) => x.uid !== m.uid);
      if (cur.length >= TEAM_SIZE) return cur;
      return [...cur, m];
    });
  };

  const confirmTeam = () => {
    if (myPicks.length !== TEAM_SIZE) return;
    audio.sfx("select");
    const copies: Mon[] = JSON.parse(JSON.stringify(myPicks));
    picksRef.current.mine = copies;
    setPicksSent(true);
    roomRef.current?.send({ type: "team", mons: copies });
    if (isHostRef.current) {
      seedRef.current = Math.floor(Math.random() * 2 ** 31);
      roomRef.current?.send({ type: "seed", seed: seedRef.current });
    }
    void maybeStartBattle();
  };

  const pickTrade = (m: Mon) => {
    audio.sfx("select");
    const copy: Mon = JSON.parse(JSON.stringify(m));
    tradeRef.current.mine = copy;
    setTradePick(copy);
    roomRef.current?.send({ type: "trade-offer", mon: copy });
  };

  // ---------------------------------------------------------------- battle flow
  const maybeStartBattle = useCallback(async () => {
    const { mine, theirs } = picksRef.current;
    if (mine.length !== TEAM_SIZE || theirs.length !== TEAM_SIZE || seedRef.current == null || sessionRef.current) return;
    const hostTeam = isHostRef.current ? mine : theirs;
    const guestTeam = isHostRef.current ? theirs : mine;
    const session = await BattleSession.create("trainer", hostTeam, guestTeam, {
      rng: mulberry32(seedRef.current),
    });
    sessionRef.current = session;
    turnRef.current = 0;
    refreshViews();
    setLog([]);
    setResult(null);
    setStage("battle");
    audio.playMusic("battle_trainer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishBattle = (r: "win" | "lose") => {
    setResult(r);
    setStage("done");
    audio.playMusic(r === "win" ? "victory" : "town");
    if (r === "win") {
      try {
        const raw = localStorage.getItem("pv.save.v1");
        if (raw) {
          const s = JSON.parse(raw) as SaveData & { stats?: Record<string, number> };
          s.stats = s.stats ?? {};
          s.stats.onlineWins = (s.stats.onlineWins ?? 0) + 1;
          localStorage.setItem("pv.save.v1", JSON.stringify(s));
        }
      } catch {}
    }
    const session = sessionRef.current;
    if (session) {
      saveReplay({
        kind: "online",
        playerTeam: (isHostRef.current ? picksRef.current.mine : picksRef.current.theirs).map((m) => ({ speciesId: m.speciesId, level: m.level })),
        enemyTeam: (isHostRef.current ? picksRef.current.theirs : picksRef.current.mine).map((m) => ({ speciesId: m.speciesId, level: m.level })),
        events: session.allEvents,
        hostPerspective: isHostRef.current,
      });
    }
  };

  const playEvents = useCallback(async (events: BattleEvent[]) => {
    const me: Side = mySide();
    for (const e of events) {
      if (e.t === "msg") {
        const key = isHostRef.current ? e.key : flipKey(e.key);
        const text = resolveText(key, e.params);
        setLog((l) => [...l.slice(-7), text]);
        await sleep(Math.min(1500, Math.max(500, text.length * 20)));
      } else if (e.t === "hp") {
        const mine = e.side === me;
        if (mine) setPv((v) => (v ? { ...v, hp: e.hp, maxHp: e.maxHp } : v));
        else setEv((v) => (v ? { ...v, hp: e.hp, maxHp: e.maxHp } : v));
        force((n) => n + 1);
        await sleep(400);
      } else if (e.t === "status") {
        const mine = e.side === me;
        if (mine) setPv((v) => (v ? { ...v, status: e.status } : v));
        else setEv((v) => (v ? { ...v, status: e.status } : v));
      } else if (e.t === "switch") {
        const mine = e.side === me;
        if (mine) setPv(e.view); else setEv(e.view);
        await sleep(450);
      } else if (e.t === "anim") {
        const mine = e.side === me;
        const setA = mine ? setAnimMine : setAnimTheirs;
        if (e.kind === "attack") { setA(mine ? "anim-lunge" : "anim-lunge-enemy"); await sleep(300); setA(""); }
        else if (e.kind.startsWith("hit")) { audio.sfx(e.kind as "hit"); setA("anim-shake anim-flash"); await sleep(380); setA(""); }
        else if (e.kind === "faint") { audio.sfx("faint"); setA("anim-faint"); await sleep(600); setA(""); }
      } else if (e.t === "end") {
        const iWon = (e.result === "win") === isHostRef.current;
        finishBattle(iWon ? "win" : "lose");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveText]);

  const maybeRunTurn = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || session.over || busyRef.current) return;
    if (!myActionRef.current || !theirActionRef.current) return;
    busyRef.current = true;
    const myAct = myActionRef.current;
    const theirAct = theirActionRef.current;
    myActionRef.current = null;
    theirActionRef.current = null;
    setWaiting(false);
    const hostAct = isHostRef.current ? myAct : theirAct;
    const guestAct = isHostRef.current ? theirAct : myAct;
    const events = await session.pvpTurn(hostAct, guestAct);
    turnRef.current++;
    await playEvents(events);
    refreshViews();
    // forced replacement?
    if (!session.over) {
      const myBattler = isHostRef.current ? session.player : session.enemy;
      const myTeam = isHostRef.current ? session.party : session.enemyParty;
      if (myBattler.mon.curHP <= 0 && myTeam.some((m) => m.curHP > 0)) {
        setNeedReplace(true);
      }
    }
    busyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playEvents]);

  const submitAction = (act: BattleAction) => {
    if (waiting || needReplace || !sessionRef.current || sessionRef.current.over) return;
    audio.sfx("select");
    setShowSwitch(false);
    myActionRef.current = act;
    roomRef.current?.send({ type: "action", turn: turnRef.current, act });
    setWaiting(true);
    void maybeRunTurn();
  };

  const submitReplace = async (idx: number) => {
    const session = sessionRef.current;
    if (!session) return;
    audio.sfx("select");
    setNeedReplace(false);
    const side = isHostRef.current ? "host" : "guest";
    roomRef.current?.send({ type: "replace", side, idx });
    const evs = side === "host" ? await session.replaceFainted(idx) : await session.replaceFaintedEnemy(idx);
    await playEvents(evs);
    refreshViews();
  };

  const surrender = () => {
    roomRef.current?.send({ type: "surrender" });
    finishBattle("lose");
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
    const { mine, theirs } = tradeRef.current;
    if (!mine || !theirs || !save) return;
    const idx = save.party.findIndex((m) => m.uid === mine.uid);
    if (idx >= 0) {
      theirs.uid = theirs.uid + "_t" + Date.now().toString(36).slice(-3);
      save.party[idx] = theirs;
      if (!save.dexSeen.includes(theirs.speciesId)) save.dexSeen.push(theirs.speciesId);
      if (!save.dexCaught.includes(theirs.speciesId)) save.dexCaught.push(theirs.speciesId);
      const s = save as SaveData & { stats?: Record<string, number> };
      s.stats = s.stats ?? {};
      s.stats.trades = (s.stats.trades ?? 0) + 1;
      try { localStorage.setItem("pv.save.v1", JSON.stringify(save)); } catch {}
      setSave({ ...save });
    }
    audio.sfx("evolve");
    setStatus(t("online.trade_done"));
    setStage("lobby");
    resetPicks();
  };

  // ---------------------------------------------------------------- render
  const monName = (m: { speciesId: number; nickname?: string }) =>
    m.nickname ?? localName(dexRef.current?.get(m.speciesId)?.n, locale);
  const party = save?.party ?? [];
  const session = sessionRef.current;

  const myTeam = session ? (isHostRef.current ? session.party : session.enemyParty) : [];
  const activeUid = session ? (isHostRef.current ? session.player.mon.uid : session.enemy.mon.uid) : null;

  const myMoves = (() => {
    if (!session) return [];
    const b = isHostRef.current ? session.player : session.enemy;
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
        <p className="mt-1 text-center text-sm text-slate-400">{t("online.sub")} · 3v3</p>
        {status && <p className="mt-3 text-center text-sm font-bold text-amber-300">{status}</p>}

        {stage === "menu" && (
          <div className="mx-auto mt-10 flex max-w-md flex-col gap-4">
            {party.length < TEAM_SIZE && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-center text-sm text-amber-200">
                {t("online.need_save")} → <a className="font-bold underline" href="/play">{t("site.nav.play")}</a>
              </div>
            )}
            <button
              disabled={party.length < TEAM_SIZE}
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
                disabled={party.length < TEAM_SIZE || joinCode.length < 6}
                onClick={join}
                className="pixel-btn bg-sky-600 px-6 py-3 font-black text-white disabled:opacity-40"
              >
                {t("online.join")}
              </button>
            </div>
            <p className="text-center text-xs text-slate-500">{t("online.p2p_note")}</p>
            <a href="/replays" className="text-center text-xs font-bold text-sky-400 underline-offset-2 hover:underline">
              ▶ {t("replay.title")}
            </a>
          </div>
        )}

        {stage === "hosting" && code && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-panel p-6 text-center">
            <div className="text-sm text-slate-400">{t("online.your_code")}</div>
            <div className="my-3 font-pixel text-3xl tracking-[0.35em] text-amber-300">{code}</div>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
              className="pixel-btn bg-slate-600 px-4 py-2 text-sm font-bold text-white"
            >
              {copied ? t("online.copied") : t("online.copy")}
            </button>
            <p className="mt-4 animate-blink text-sm text-slate-400">{t("online.waiting")}</p>
          </div>
        )}

        {stage === "lobby" && (
          <div className="mx-auto mt-10 flex max-w-md flex-col gap-4">
            <button onClick={() => chooseMode("battle")} className="pixel-btn bg-pokered px-6 py-4 text-lg font-black text-white">
              ⚔ {t("online.battle")} 3v3
            </button>
            <button onClick={() => chooseMode("trade")} className="pixel-btn bg-emerald-600 px-6 py-4 text-lg font-black text-white">
              ⇄ {t("online.trade")}
            </button>
          </div>
        )}

        {stage === "pick" && mode === "battle" && (
          <div className="mt-8">
            <h2 className="mb-3 text-center font-bold text-slate-200">
              {t("online.pick_n", { n: myPicks.length, total: TEAM_SIZE })}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {party.map((m) => {
                const sel = myPicks.findIndex((x) => x.uid === m.uid);
                return (
                  <button
                    key={m.uid}
                    disabled={picksSent || m.curHP <= 0}
                    onClick={() => togglePick(m)}
                    className={`relative flex flex-col items-center rounded-xl border p-3 transition-colors ${
                      sel >= 0 ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-panel hover:bg-white/5"
                    } disabled:opacity-50`}
                  >
                    {sel >= 0 && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-ink">
                        {sel + 1}
                      </span>
                    )}
                    <MonSprite id={m.speciesId} size={64} />
                    <b className="mt-1 text-sm">{monName(m)}</b>
                    <span className="text-xs text-slate-400">Lv.{m.level}</span>
                  </button>
                );
              })}
            </div>
            <button
              disabled={myPicks.length !== TEAM_SIZE || picksSent}
              onClick={confirmTeam}
              className="pixel-btn mx-auto mt-5 block bg-pokered px-8 py-3 font-black text-white disabled:opacity-40"
            >
              {picksSent ? t("online.waiting") : t("online.confirm_team")}
            </button>
            {picksSent && !theirReady && (
              <p className="mt-3 animate-blink text-center text-sm text-slate-400">{t("online.waiting")}</p>
            )}
          </div>
        )}

        {stage === "pick" && mode === "trade" && (
          <div className="mt-8">
            <h2 className="mb-3 text-center font-bold text-slate-200">{t("online.select_trade")}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {party.map((m) => (
                <button
                  key={m.uid}
                  disabled={!!tradePick}
                  onClick={() => pickTrade(m)}
                  className={`flex flex-col items-center rounded-xl border p-3 ${
                    tradePick?.uid === m.uid ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-panel hover:bg-white/5"
                  } disabled:opacity-50`}
                >
                  <MonSprite id={m.speciesId} size={64} />
                  <b className="mt-1 text-sm">{monName(m)}</b>
                  <span className="text-xs text-slate-400">Lv.{m.level}</span>
                </button>
              ))}
            </div>
            {(tradePick || theirTrade) && (
              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-panel p-4">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-xs text-slate-400">{t("online.you")}</div>
                    {tradePick ? <MonSprite id={tradePick.speciesId} size={72} /> : <div className="h-[72px] w-[72px]" />}
                    <b className="text-sm">{tradePick ? monName(tradePick) : "…"}</b>
                  </div>
                  <span className="text-2xl text-emerald-400">⇄</span>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">{t("online.opponent")}</div>
                    {theirTrade ? <MonSprite id={theirTrade.speciesId} size={72} /> : <div className="h-[72px] w-[72px]" />}
                    <b className="text-sm">{theirTrade ? monName(theirTrade) : "…"}</b>
                  </div>
                </div>
                <button
                  disabled={!tradePick || !theirTrade || tradeConfirmed.me}
                  onClick={confirmTrade}
                  className="pixel-btn mt-4 w-full bg-emerald-600 py-2.5 font-black text-white disabled:opacity-40"
                >
                  {tradeConfirmed.me ? t("online.waiting_move") : t("online.confirm_trade")}
                </button>
              </div>
            )}
          </div>
        )}

        {(stage === "battle" || stage === "done") && pv && ev && (
          <div className="mt-8">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#86c4e8] via-[#b8e0c8] to-[#7ec850] p-4 text-ink">
              <div className="flex items-start justify-between">
                <div className="w-56 max-w-[55%] rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2">
                  <div className="flex justify-between text-sm font-black">
                    <span className="truncate">{monName(ev)}</span>
                    <span className="text-slate-500">Lv.{ev.level}</span>
                  </div>
                  <HPBar hp={ev.hp} max={ev.maxHp} />
                  <StatusBadge status={ev.status} />
                </div>
                <div className={animTheirs}>
                  <MonSprite id={ev.speciesId} shiny={ev.shiny} size={104} animateGen5 />
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className={animMine}>
                  {pv.hp > 0 && <MonSprite id={pv.speciesId} shiny={pv.shiny} back size={120} />}
                </div>
                <div className="w-56 max-w-[55%] rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2">
                  <div className="flex justify-between text-sm font-black">
                    <span className="truncate">{monName(pv)}</span>
                    <span className="text-slate-500">Lv.{pv.level}</span>
                  </div>
                  <HPBar hp={pv.hp} max={pv.maxHp} showText />
                  <StatusBadge status={pv.status} />
                </div>
              </div>
              {/* team pips */}
              <div className="mt-2 flex justify-between text-[11px] font-bold text-ink/70">
                <span>{myTeam.filter((m) => m.curHP > 0).length}/{TEAM_SIZE}</span>
                <span>{(session ? (isHostRef.current ? session.enemyParty : session.party) : []).filter((m) => m.curHP > 0).length}/{TEAM_SIZE}</span>
              </div>
            </div>

            <div className="mt-3 h-32 overflow-y-auto rounded-xl border border-white/10 bg-panel p-3 text-sm leading-relaxed text-slate-200">
              {log.map((l, i) => <div key={i}>· {l}</div>)}
              {stage === "done" && result && (
                <div className={`mt-1 text-lg font-black ${result === "win" ? "text-amber-300" : "text-slate-400"}`}>
                  {result === "win" ? "🏆 WIN!" : "LOSE…"}
                </div>
              )}
            </div>

            {stage === "battle" && needReplace && (
              <div className="mt-3 rounded-xl border border-amber-300/50 bg-panel p-3">
                <div className="mb-2 text-sm font-bold text-amber-300">{t("online.replace_prompt")}</div>
                <div className="flex gap-2">
                  {myTeam.map((m, i) => (
                    <button
                      key={m.uid}
                      disabled={m.curHP <= 0}
                      onClick={() => void submitReplace(i)}
                      className="pixel-btn flex-1 bg-white px-2 py-2 text-center disabled:opacity-40"
                    >
                      <MonSprite id={m.speciesId} size={40} />
                      <div className="text-[11px] font-bold text-ink">{m.curHP > 0 ? m.curHP : "✕"}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stage === "battle" && !needReplace && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {!showSwitch && myMoves.map(({ idx, data, pp }) => (
                  <button
                    key={idx}
                    disabled={waiting || pp <= 0}
                    onClick={() => submitAction({ kind: "move", index: idx })}
                    className="pixel-btn bg-white px-3 py-2.5 text-left disabled:opacity-40"
                  >
                    <b className="text-sm text-ink">{localName(data?.n, locale)}</b>
                    <span className="ml-2 text-xs text-slate-500">PP {pp}{data?.p ? ` · ${data.p}` : ""}</span>
                  </button>
                ))}
                {showSwitch && myTeam.map((m, i) => (
                  <button
                    key={m.uid}
                    disabled={waiting || m.curHP <= 0 || m.uid === activeUid}
                    onClick={() => submitAction({ kind: "switch", partyIdx: i })}
                    className="pixel-btn flex items-center gap-2 bg-white px-3 py-2 text-left disabled:opacity-40"
                  >
                    <MonSprite id={m.speciesId} size={32} />
                    <b className="text-sm text-ink">{monName(m)}</b>
                    <span className="ml-auto text-xs text-slate-500">{m.curHP > 0 ? m.curHP : "✕"}</span>
                  </button>
                ))}
                <button
                  onClick={() => { audio.sfx("move"); setShowSwitch((s) => !s); }}
                  className="pixel-btn bg-emerald-600 py-2 text-sm font-bold text-white"
                >
                  {showSwitch ? t("game.battle.fight") : t("online.switch")}
                </button>
                <button onClick={surrender} className="pixel-btn bg-slate-600 py-2 text-sm font-bold text-white">
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
                  setNeedReplace(false); setShowSwitch(false);
                  resetPicks();
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
