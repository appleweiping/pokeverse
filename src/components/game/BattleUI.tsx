"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/game/state";
import { useI18n } from "@/lib/i18n";
import type { BattleAction, BattleEvent, BattlerPublicView, Side } from "@/lib/game/battle";
import { getDexMap, getMoveMap, localName, type Locale } from "@/lib/data/dex";
import { abilityName } from "@/lib/data/abilities";
import type { DexEntry, MoveData, TypeName, Weather } from "@/lib/types";
import { TYPE_COLORS } from "@/lib/data/typechart";
import { ITEMS, BALL_ORDER } from "@/lib/game/items";
import { audio } from "@/lib/audio/tracks";
import { HPBar, MonSprite, StatusBadge, PokeballIcon, TypeBadge } from "@/components/shared";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Mode = "intro" | "anim" | "menu" | "moves" | "party" | "bag" | "forced";

export default function BattleUI() {
  const session = useGame((s) => s.battleSession);
  const trainer = useGame((s) => s.battleTrainer);
  const endBattle = useGame((s) => s.endBattle);
  const { t, locale } = useI18n();

  const [mode, setMode] = useState<Mode>("intro");
  const [msg, setMsg] = useState("");
  const [pv, setPv] = useState<BattlerPublicView | null>(null);
  const [ev, setEv] = useState<BattlerPublicView | null>(null);
  const [animP, setAnimP] = useState("");
  const [animE, setAnimE] = useState("");
  const [enemyHidden, setEnemyHidden] = useState(false);
  const [ballAnim, setBallAnim] = useState<"none" | "fly" | "wobble">("none");
  const [swirl, setSwirl] = useState(true);
  const [weather, setWeather] = useState<Weather>("none");
  const [abilityFlash, setAbilityFlash] = useState<{ side: Side; name: string } | null>(null);
  const [particles, setParticles] = useState<{ side: Side; type: TypeName; key: number } | null>(null);
  const particleKey = useRef(0);
  const dexRef = useRef<Map<number, DexEntry> | null>(null);
  const movesRef = useRef<Map<number, MoveData> | null>(null);
  const busyRef = useRef(false);

  const resolveText = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const out: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(params ?? {})) {
        if (typeof v === "string") {
          out[k] = v.replace(/%(SPECIES|MOVE|ITEM|STAT|TR|ABILITY)_([\w.-]+)%/g, (_, kind, id) => {
            if (kind === "SPECIES") return localName(dexRef.current?.get(Number(id))?.n, locale);
            if (kind === "MOVE") return localName(movesRef.current?.get(Number(id))?.n, locale);
            if (kind === "ITEM") return t(`items.${id}.n`);
            if (kind === "STAT") return t(`game.stats.${id}`);
            if (kind === "TR") return t(id);
            if (kind === "ABILITY") return abilityName(id, locale);
            return id;
          });
        } else out[k] = v;
      }
      return t(key, out);
    },
    [t, locale]
  );

  // ---- intro sequence
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const [dexMap, moveMap] = await Promise.all([getDexMap(), getMoveMap()]);
      if (cancelled) return;
      dexRef.current = dexMap;
      movesRef.current = moveMap;
      setPv(session.playerView());
      setEv(session.enemyView());
      setTimeout(() => setSwirl(false), 700);
      const enemyName = localName(dexMap.get(session.enemyView().speciesId)?.n, locale);
      if (session.kind === "wild") {
        setMsg(t("game.battle.wild_appear", { name: enemyName }));
      } else {
        setMsg(t("game.battle.trainer_appear", { name: t(trainer?.nameKey ?? "") }));
      }
      await sleep(1400);
      if (cancelled) return;
      const meName = localName(dexMap.get(session.playerView().speciesId)?.n, locale);
      setMsg(t("game.battle.go", { name: session.playerView().nickname ?? meName }));
      await sleep(900);
      if (cancelled) return;
      // switch-in abilities (weather setters, Intimidate)
      const introEvents = session.introAbilities();
      if (introEvents.length) await playEvents(introEvents);
      if (cancelled) return;
      setMode("menu");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const playEvents = useCallback(async (events: BattleEvent[]) => {
    for (const e of events) {
      switch (e.t) {
        case "msg": {
          const text = resolveText(e.key, e.params);
          setMsg(text);
          await sleep(Math.min(2400, Math.max(850, text.length * 30)));
          break;
        }
        case "hp": {
          if (e.side === "player") setPv((v) => (v ? { ...v, hp: e.hp, maxHp: e.maxHp } : v));
          else setEv((v) => (v ? { ...v, hp: e.hp, maxHp: e.maxHp } : v));
          await sleep(500);
          break;
        }
        case "status": {
          if (e.side === "player") setPv((v) => (v ? { ...v, status: e.status } : v));
          else setEv((v) => (v ? { ...v, status: e.status } : v));
          await sleep(200);
          break;
        }
        case "switch": {
          if (e.side === "player") { setPv(e.view); setAnimP("animate-pop"); }
          else { setEv(e.view); setAnimE("animate-pop"); setEnemyHidden(false); }
          await sleep(550);
          setAnimP(""); setAnimE("");
          break;
        }
        case "level": {
          audio.sfx("levelup");
          await sleep(250);
          break;
        }
        case "weather": {
          setWeather(e.weather);
          await sleep(150);
          break;
        }
        case "ability": {
          setAbilityFlash({ side: e.side, name: abilityName(e.ability, locale) });
          audio.sfx("stat_up");
          await sleep(550);
          setAbilityFlash(null);
          break;
        }
        case "anim": {
          await playAnim(e.kind, e.side, e.mt);
          break;
        }
        case "end":
          break;
      }
    }
  }, [resolveText]);

  const playAnim = async (kind: string, side: Side, mt?: TypeName) => {
    const setA = side === "player" ? setAnimP : setAnimE;
    const burst = () => {
      if (mt) setParticles({ side, type: mt, key: ++particleKey.current });
    };
    switch (kind) {
      case "attack":
        setA(side === "player" ? "anim-lunge" : "anim-lunge-enemy");
        await sleep(380);
        setA("");
        break;
      case "hit": audio.sfx("hit"); burst(); setA("anim-shake anim-flash"); await sleep(460); setA(""); break;
      case "hit_super": audio.sfx("hit_super"); burst(); setA("anim-shake anim-flash"); await sleep(520); setA(""); break;
      case "hit_weak": audio.sfx("hit_weak"); burst(); setA("anim-shake"); await sleep(400); setA(""); break;
      case "faint": audio.sfx("faint"); setA("anim-faint"); await sleep(750); break;
      case "ball_throw":
        audio.sfx("ball_throw");
        setBallAnim("fly");
        await sleep(550);
        audio.sfx("ball_open");
        setEnemyHidden(true);
        setBallAnim("wobble");
        await sleep(350);
        break;
      case "ball_shake": audio.sfx("ball_shake"); setBallAnim("wobble"); await sleep(820); break;
      case "ball_open":
        audio.sfx("ball_open");
        setBallAnim("none");
        setEnemyHidden(false);
        setAnimE("animate-pop");
        await sleep(450);
        setAnimE("");
        break;
      case "catch": audio.sfx("catch"); await sleep(700); setBallAnim("none"); break;
      case "heal": audio.sfx("heal"); await sleep(350); break;
      case "stat_up": audio.sfx("stat_up"); await sleep(300); break;
      case "stat_down": audio.sfx("stat_down"); await sleep(300); break;
    }
  };

  const submit = useCallback(async (action: BattleAction) => {
    if (!session || busyRef.current || session.over) return;
    busyRef.current = true;
    setMode("anim");
    const events = await session.turn(action);
    await playEvents(events);
    // refresh views (stats may change after level up)
    setPv(session.playerView());
    if (!session.over) setEv(session.enemyView());
    if (session.over) {
      const result = session.result!;
      if (result === "win" || result === "caught") {
        audio.playMusic("victory");
        await sleep(2200);
      }
      busyRef.current = false;
      await endBattle(result);
      return;
    }
    if (session.playerView().hp <= 0) {
      setMode("forced");
    } else {
      setMode("menu");
    }
    busyRef.current = false;
  }, [session, playEvents, endBattle]);

  const forcedPick = useCallback(async (idx: number) => {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setMode("anim");
    const events = await session.replaceFainted(idx);
    await playEvents(events);
    setPv(session.playerView());
    setMode("menu");
    busyRef.current = false;
  }, [session, playEvents]);

  if (!session || !pv || !ev) {
    return <div className="absolute inset-0 z-40 bg-[#0a0c16]" />;
  }

  const save = useGame.getState().save;
  const activeIdx = session.party.findIndex((m) => m.uid === session.player.mon.uid);
  const pName = pv.nickname ?? localName(dexRef.current?.get(pv.speciesId)?.n, locale);
  const eName = ev.nickname ?? localName(dexRef.current?.get(ev.speciesId)?.n, locale);

  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-hidden bg-gradient-to-b from-[#86c4e8] via-[#b8e0c8] to-[#7ec850] text-ink">
      {swirl && <div className="absolute inset-0 z-50 bg-[#0a0c16]" style={{ animation: "battleSwirl .7s ease-out forwards" }} />}

      {/* weather overlay */}
      {weather !== "none" && <WeatherOverlay weather={weather} />}

      {/* ability flash banner */}
      {abilityFlash && (
        <div
          className={`pointer-events-none absolute z-30 ${abilityFlash.side === "enemy" ? "left-3 top-20" : "bottom-24 right-3"}`}
        >
          <div className="animate-pop rounded-lg border-2 border-amber-300 bg-ink/90 px-3 py-1.5 text-xs font-black text-amber-300 shadow-lg">
            {abilityFlash.name}
          </div>
        </div>
      )}

      {/* arena */}
      <div className="relative flex-1">
        {/* enemy info */}
        <div className="absolute left-3 top-3 z-10 w-60 max-w-[58vw] rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-black">{eName}</span>
            <span className="text-xs font-bold text-slate-600">Lv.{ev.level}</span>
          </div>
          <HPBar hp={ev.hp} max={ev.maxHp} />
          <div className="mt-1 flex gap-1"><StatusBadge status={ev.status} /></div>
        </div>

        {/* enemy sprite */}
        <div className="absolute right-[8%] top-[12%] sm:right-[14%]">
          <div className="mx-auto h-3 w-32 translate-y-[88px] rounded-full bg-black/15 blur-[2px]" />
          {!enemyHidden && (
            <div className={`relative ${animE}`}>
              <MonSprite id={ev.speciesId} shiny={ev.shiny} size={120} animateGen5 />
              {particles?.side === "enemy" && <HitParticles key={particles.key} type={particles.type} />}
            </div>
          )}
          {ballAnim !== "none" && (
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 ${ballAnim === "wobble" ? "anim-wobble" : "animate-pop"}`}>
              <PokeballIcon size={34} />
            </div>
          )}
        </div>

        {/* player sprite */}
        <div className="absolute bottom-[2%] left-[6%] sm:left-[14%]">
          <div className="mx-auto h-4 w-40 translate-y-[110px] rounded-full bg-black/15 blur-[2px]" />
          <div className={`relative ${animP}`}>
            {pv.hp > 0 && <MonSprite id={pv.speciesId} shiny={pv.shiny} back size={150} />}
            {particles?.side === "player" && <HitParticles key={particles.key} type={particles.type} />}
          </div>
        </div>

        {/* player info */}
        <div className="absolute bottom-3 right-3 z-10 w-64 max-w-[60vw] rounded-xl border-2 border-ink/70 bg-white/90 px-3 py-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-black">{pName}</span>
            <span className="text-xs font-bold text-slate-600">Lv.{pv.level}</span>
          </div>
          <HPBar hp={pv.hp} max={pv.maxHp} showText />
          <div className="flex gap-1"><StatusBadge status={pv.status} /></div>
        </div>
      </div>

      {/* bottom console */}
      <div className="relative z-20 grid min-h-[150px] grid-cols-1 gap-2 border-t-4 border-ink/80 bg-[#16181f] p-3 sm:grid-cols-2">
        {/* message窗 */}
        <div className="pixel-panel flex items-center px-4 py-3 text-[15px] leading-relaxed">
          {mode === "menu" ? t("game.battle.what_do", { name: pName }) : msg || "…"}
        </div>

        {/* action area */}
        <div className="relative">
          {mode === "menu" && (
            <div className="grid h-full grid-cols-2 gap-2">
              <BattleBtn color="#e3350d" label={t("game.battle.fight")} onClick={() => { audio.sfx("select"); setMode("moves"); }} />
              <BattleBtn color="#f7a531" label={t("game.battle.bag")} onClick={() => { audio.sfx("select"); setMode("bag"); }} />
              <BattleBtn color="#56b856" label={t("game.battle.pokemon")} onClick={() => { audio.sfx("select"); setMode("party"); }} />
              <BattleBtn color="#3a7fd0" label={t("game.battle.run")} onClick={() => { audio.sfx("cancel"); void submit({ kind: "run" }); }} />
            </div>
          )}

          {mode === "moves" && (
            <div className="grid h-full grid-cols-2 gap-2">
              {session.player.mon.moves.map((m, i) => {
                const md = movesRef.current?.get(m.id);
                if (!md) return null;
                return (
                  <button
                    key={i}
                    disabled={m.pp <= 0}
                    onClick={() => { audio.sfx("select"); void submit({ kind: "move", index: i }); }}
                    className="pixel-btn flex flex-col items-start justify-center gap-0.5 px-3 py-1.5 text-left disabled:opacity-40"
                    style={{ backgroundColor: TYPE_COLORS[md.t] + "e8", color: "#fff" }}
                  >
                    <span className="w-full truncate text-[13px] font-black drop-shadow">{localName(md.n, locale)}</span>
                    <span className="text-[10px] font-bold opacity-90">
                      {t(`types.${md.t}`)} · PP {m.pp}/{m.maxPp}{md.p ? ` · ${md.p}` : ""}
                    </span>
                  </button>
                );
              })}
              <BackBtn onClick={() => setMode("menu")} label={t("common.back")} />
            </div>
          )}

          {(mode === "party" || mode === "forced") && (
            <div className="flex h-full flex-col gap-1 overflow-y-auto">
              {session.party.map((m, i) => {
                const sp = dexRef.current?.get(m.speciesId);
                const disabled = m.curHP <= 0 || i === activeIdx;
                return (
                  <button
                    key={m.uid}
                    disabled={disabled}
                    onClick={() => {
                      audio.sfx("select");
                      if (mode === "forced") void forcedPick(i);
                      else void submit({ kind: "switch", partyIdx: i });
                    }}
                    className="pixel-btn flex items-center gap-2 bg-white px-2 py-1 text-left disabled:opacity-40"
                  >
                    <MonSprite id={m.speciesId} size={34} />
                    <span className="flex-1 truncate text-[13px] font-bold">
                      {m.nickname ?? localName(sp?.n, locale)} <span className="text-slate-500">Lv.{m.level}</span>
                    </span>
                    <span className={`text-[12px] font-black tabular-nums ${m.curHP <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {m.curHP <= 0 ? t("game.party.fainted") : `${m.curHP}`}
                    </span>
                  </button>
                );
              })}
              {mode === "party" && <BackBtn onClick={() => setMode("menu")} label={t("common.back")} />}
            </div>
          )}

          {mode === "bag" && (
            <div className="flex h-full flex-col gap-1 overflow-y-auto">
              {Object.entries(save?.bag ?? {})
                .filter(([id, n]) => n > 0 && ITEMS[id] && !["key", "tm", "hold", "battle"].includes(ITEMS[id].category))
                .sort(([a], [b]) => (BALL_ORDER.includes(a) ? -1 : 0) - (BALL_ORDER.includes(b) ? -1 : 0))
                .map(([id, n]) => {
                  const def = ITEMS[id];
                  const isBall = def.category === "ball";
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (!save) return;
                        audio.sfx("select");
                        save.bag[id]--;
                        if (save.bag[id] <= 0) delete save.bag[id];
                        useGame.getState().bump();
                        if (isBall) void submit({ kind: "ball", itemId: id });
                        else void submit({ kind: "item", itemId: id, partyIdx: activeIdx });
                      }}
                      className="pixel-btn flex items-center gap-2 bg-white px-3 py-1.5 text-left"
                    >
                      {isBall && <PokeballIcon size={18} />}
                      <span className="flex-1 truncate text-[13px] font-bold">{t(`items.${id}.n`)}</span>
                      <span className="text-[12px] font-black text-slate-500">×{n}</span>
                    </button>
                  );
                })}
              {Object.keys(save?.bag ?? {}).filter((id) => ITEMS[id]?.category !== "key").length === 0 && (
                <div className="px-3 py-2 text-sm text-white/70">{t("game.bag.empty")}</div>
              )}
              <BackBtn onClick={() => setMode("menu")} label={t("common.back")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BattleBtn({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pixel-btn flex items-center justify-center text-base font-black text-white hover:brightness-110"
      style={{ backgroundColor: color }}
    >
      {label}
    </button>
  );
}

function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={() => { audio.sfx("cancel"); onClick(); }}
      className="pixel-btn bg-slate-600 px-3 py-1.5 text-[13px] font-bold text-white"
    >
      ← {label}
    </button>
  );
}

/** Type-colored pixel burst shown where a move connects. */
function HitParticles({ type }: { type: TypeName }) {
  const color = TYPE_COLORS[type];
  const bits = Array.from({ length: 10 }, (_, i) => {
    const ang = (i / 10) * Math.PI * 2 + (i % 2) * 0.3;
    const dist = 34 + (i % 3) * 16;
    return {
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist,
      size: i % 3 === 0 ? 7 : 5,
      delay: (i % 4) * 28,
    };
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            width: b.size,
            height: b.size,
            backgroundColor: i % 4 === 0 ? "#ffffff" : color,
            // @ts-expect-error CSS custom props
            "--dx": `${b.dx}px`,
            "--dy": `${b.dy}px`,
            animation: `particleFly .5s ease-out ${b.delay}ms forwards`,
            imageRendering: "pixelated",
          }}
        />
      ))}
    </div>
  );
}

/** CSS-only weather effect layer drawn over the battle arena. */
function WeatherOverlay({ weather }: { weather: Weather }) {
  const tint: Record<string, string> = {
    sun: "rgba(255,200,80,0.16)",
    rain: "rgba(60,90,160,0.20)",
    sand: "rgba(200,170,90,0.22)",
    hail: "rgba(180,210,235,0.20)",
  };
  // particle streaks for rain/hail/sand via repeating gradients
  const particles =
    weather === "rain"
      ? { background: "repeating-linear-gradient(105deg, rgba(180,210,255,.35) 0 1px, transparent 1px 7px)", anim: "weatherRain .5s linear infinite" }
      : weather === "hail"
      ? { background: "radial-gradient(rgba(220,240,255,.6) 1.4px, transparent 1.6px)", size: "16px 16px", anim: "weatherHail .8s linear infinite" }
      : weather === "sand"
      ? { background: "repeating-linear-gradient(100deg, rgba(210,180,110,.3) 0 2px, transparent 2px 9px)", anim: "weatherRain .7s linear infinite" }
      : null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div className="absolute inset-0" style={{ background: tint[weather] }} />
      {particles && (
        <div
          className="absolute inset-[-20%]"
          style={{ background: particles.background, backgroundSize: particles.size, animation: particles.anim }}
        />
      )}
    </div>
  );
}
