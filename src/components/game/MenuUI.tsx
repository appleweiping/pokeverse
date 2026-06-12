"use client";
import React, { useEffect, useState } from "react";
import { useGame, type SubMenu } from "@/lib/game/state";
import { useI18n, LOCALES } from "@/lib/i18n";
import { getDexMap, getMoveMap, localName, MAX_DEX_ID } from "@/lib/data/dex";
import type { DexEntry, Mon, MoveData } from "@/lib/types";
import { NATURES, expForLevel } from "@/lib/data/formulas";
import { abilityName } from "@/lib/data/abilities";
import { ACHIEVEMENTS } from "@/lib/game/achievements";
import { maxHPOf, statsOf } from "@/lib/game/factory";
import { ITEMS, MART_STOCK } from "@/lib/game/items";
import type { ItemDef } from "@/lib/types";
import { audio } from "@/lib/audio/tracks";
import { HPBar, MonSprite, StatusBadge, TypeBadge, PokeballIcon, EggSprite } from "@/components/shared";

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function MenuUI() {
  const g = useGame();
  const { t, locale, setLocale } = useI18n();
  const [dexMap, setDexMap] = useState<Map<number, DexEntry> | null>(null);
  const [moveMap, setMoveMap] = useState<Map<number, MoveData> | null>(null);
  const [detail, setDetail] = useState<number | null>(null); // party index
  const [pickTarget, setPickTarget] = useState<string | null>(null); // itemId waiting for target
  const [giveHeld, setGiveHeld] = useState<number | null>(null); // party index waiting for held item
  const [importText, setImportText] = useState("");

  useEffect(() => {
    void getDexMap().then(setDexMap);
    void getMoveMap().then(setMoveMap);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "x") {
        if (g.submenu) { g.setSubmenu(null); setDetail(null); setPickTarget(null); }
        else if (g.menuOpen) g.setMenu(false);
      }
    };
    if (g.menuOpen || g.submenu) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [g.menuOpen, g.submenu, g]);

  const save = g.save;
  if (!save || (!g.menuOpen && !g.submenu)) return null;

  const close = (s: SubMenu = null) => { audio.sfx("cancel"); g.setSubmenu(s); setDetail(null); setPickTarget(null); };

  const monName = (m: Mon) => m.nickname ?? localName(dexMap?.get(m.speciesId)?.n, locale);
  const itemName = (id: string) => {
    const def = ITEMS[id];
    if (def?.tmMove) return "TM·" + localName(moveMap?.get(def.tmMove)?.n, locale);
    return t(`items.${id}.n`);
  };
  const itemDesc = (id: string) => {
    const def = ITEMS[id];
    if (def?.tmMove) return t("items.tm_desc", { move: localName(moveMap?.get(def.tmMove)?.n, locale) });
    return t(`items.${id}.d`);
  };

  // ====================================================================== sub menus
  const renderSub = () => {
    switch (g.submenu) {
      // ---------------------------------------------------------------- party
      case "party": {
        if (detail !== null && save.party[detail]?.egg) {
          const mon = save.party[detail];
          return (
            <Panel title={t("game.party.egg")} onBack={() => setDetail(null)}>
              <div className="flex flex-col items-center gap-3 py-6">
                <EggSprite size={120} />
                <p className="text-sm text-slate-300">
                  {mon.egg!.steps > 640 ? t("game.party.egg_far") : mon.egg!.steps > 192 ? t("game.party.egg_mid") : t("game.party.egg_near")}
                </p>
              </div>
            </Panel>
          );
        }
        if (detail !== null && save.party[detail] && dexMap) {
          const mon = save.party[detail];
          const sp = dexMap.get(mon.speciesId)!;
          const stats = statsOf(mon, sp);
          const next = mon.level < 100 ? expForLevel(sp.gr, mon.level + 1) - mon.exp : 0;
          const labels = [t("dex.statNames.hp"), t("dex.statNames.atk"), t("dex.statNames.def"), t("dex.statNames.spa"), t("dex.statNames.spd"), t("dex.statNames.spe")];
          return (
            <Panel title={monName(mon)} onBack={() => setDetail(null)}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col items-center gap-1">
                  <MonSprite id={mon.speciesId} shiny={mon.shiny} size={120} animateGen5 />
                  <div className="flex gap-1">{sp.t.map((tp) => <TypeBadge key={tp} type={tp} small />)}</div>
                  <div className="flex items-center gap-2 text-xs">
                    {mon.gender === "m" && <span className="font-bold text-sky-400">♂</span>}
                    {mon.gender === "f" && <span className="font-bold text-pink-400">♀</span>}
                    {mon.shiny && <span className="font-bold text-amber-400">★</span>}
                  </div>
                </div>
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <b>Lv.{mon.level}</b>
                    <StatusBadge status={mon.status} />
                  </div>
                  <HPBar hp={mon.curHP} max={stats[0]} showText />
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                    {labels.map((lb, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-700/60 py-0.5">
                        <span className="text-slate-400">{lb}</span>
                        <b className="tabular-nums">
                          {stats[i]}
                          {(mon.evs?.[i] ?? 0) > 0 && (
                            <span className="ml-1 text-[10px] font-bold text-amber-400/90">EV{mon.evs![i]}</span>
                          )}
                        </b>
                      </div>
                    ))}
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">{t("game.party.nature")}</span>
                      <b>{NATURES[mon.nature]?.n[locale === "zh-CN" ? "hans" : locale === "zh-TW" ? "hant" : locale === "ja" ? "ja" : locale === "ko" ? "ko" : "en"] ?? "?"}</b>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">{t("game.party.next_lv")}</span>
                      <b className="tabular-nums">{next}</b>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">{t("game.party.ability")}</span>
                      <b>{abilityName(mon.ability, locale) || "—"}</b>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">{t("game.party.held")}</span>
                      <b>{mon.item ? t(`items.${mon.item}.n`) : "—"}</b>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 text-xs font-bold text-slate-400">{t("game.party.moves")}</div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {mon.moves.map((mv, i) => {
                        const md = moveMap?.get(mv.id);
                        return (
                          <div key={i} className="flex items-center justify-between rounded bg-slate-800/80 px-2 py-1.5 text-[12px]">
                            <span className="font-bold">{localName(md?.n, locale)}</span>
                            <span className="text-slate-400">{md && t(`types.${md.t}`)} {mv.pp}/{mv.maxPp}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail > 0 && (
                      <button
                        className="pixel-btn bg-sky-600 px-3 py-1.5 text-[13px] font-bold text-white"
                        onClick={() => {
                          audio.sfx("select");
                          const arr = save.party;
                          [arr[0], arr[detail]] = [arr[detail], arr[0]];
                          g.bump(); setDetail(0);
                        }}
                      >
                        ↑ {t("game.party.switch")} #1
                      </button>
                    )}
                    {mon.item ? (
                      <button
                        className="pixel-btn bg-amber-600 px-3 py-1.5 text-[13px] font-bold text-white"
                        onClick={() => {
                          audio.sfx("select");
                          g.giveItem(mon.item!, 1);
                          g.showToast(t("game.party.held_taken", { name: monName(mon), item: t(`items.${mon.item}.n`) }));
                          mon.item = null; g.bump();
                        }}
                      >
                        {t("game.party.take")}
                      </button>
                    ) : (
                      <button
                        className="pixel-btn bg-emerald-700 px-3 py-1.5 text-[13px] font-bold text-white"
                        onClick={() => { audio.sfx("select"); setGiveHeld(detail); }}
                      >
                        {t("game.party.give")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {giveHeld === detail && (
                <div className="mt-3 rounded-lg bg-slate-900/70 p-3">
                  <div className="mb-2 text-xs font-bold text-slate-400">{t("game.party.give")}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(save.bag)
                      .filter(([id, n]) => n > 0 && (ITEMS[id]?.category === "berry" || ITEMS[id]?.category === "hold"))
                      .map(([id]) => (
                        <button
                          key={id}
                          className="pixel-btn bg-slate-700 px-2.5 py-1.5 text-[12px] font-bold text-white"
                          onClick={() => {
                            audio.sfx("select");
                            if (mon.item) g.giveItem(mon.item, 1);
                            mon.item = id;
                            save.bag[id]--; if (save.bag[id] <= 0) delete save.bag[id];
                            g.showToast(t("game.party.held_given", { name: monName(mon), item: t(`items.${id}.n`) }));
                            setGiveHeld(null); g.bump();
                          }}
                        >
                          {t(`items.${id}.n`)} ×{save.bag[id]}
                        </button>
                      ))}
                    {Object.entries(save.bag).filter(([id, n]) => n > 0 && (ITEMS[id]?.category === "berry" || ITEMS[id]?.category === "hold")).length === 0 && (
                      <span className="text-xs text-slate-500">{t("game.bag.empty")}</span>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          );
        }
        return (
          <Panel title={t("game.party.title")} onBack={() => close(null)}>
            {save.party.length === 0 && <p className="text-slate-400">{t("game.party.empty")}</p>}
            <div className="flex flex-col gap-1.5">
              {save.party.map((m, i) => {
                if (m.egg) {
                  return (
                    <button
                      key={m.uid}
                      onClick={() => { audio.sfx("select"); setDetail(i); }}
                      className="flex items-center gap-3 rounded-lg bg-slate-800/80 px-3 py-2 text-left hover:bg-slate-700"
                    >
                      <EggSprite size={44} />
                      <div className="min-w-0 flex-1">
                        <b className="text-sm">{t("game.party.egg")}</b>
                        <p className="text-[11px] text-slate-400">
                          {m.egg.steps > 640 ? t("game.party.egg_far") : m.egg.steps > 192 ? t("game.party.egg_mid") : t("game.party.egg_near")}
                        </p>
                      </div>
                    </button>
                  );
                }
                const sp = dexMap?.get(m.speciesId);
                const max = sp ? maxHPOf(m, sp) : m.curHP;
                return (
                  <button
                    key={m.uid}
                    onClick={() => { audio.sfx("select"); setDetail(i); }}
                    className="flex items-center gap-3 rounded-lg bg-slate-800/80 px-3 py-2 text-left hover:bg-slate-700"
                  >
                    <MonSprite id={m.speciesId} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <b className="truncate">{monName(m)}</b>
                        <span className="text-slate-400">Lv.{m.level}</span>
                        <StatusBadge status={m.status} />
                      </div>
                      <HPBar hp={m.curHP} max={max} />
                    </div>
                    <span className="text-[11px] tabular-nums text-slate-400">{m.curHP}/{max}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        );
      }
      // ---------------------------------------------------------------- bag
      case "bag": {
        const cats: [ItemDef["category"], string][] = [
          ["ball", t("game.bag.balls")], ["medicine", t("game.bag.medicine")], ["berry", t("game.bag.berries")],
          ["tm", t("game.bag.tms")], ["battle", t("game.bag.medicine")], ["hold", t("game.bag.berries")],
          ["key", t("game.bag.key")],
        ];
        const entries = Object.entries(save.bag).filter(([, n]) => n > 0);
        if (pickTarget) {
          return (
            <Panel title={t("game.party.choose")} onBack={() => setPickTarget(null)}>
              <div className="flex flex-col gap-1.5">
                {save.party.map((m, i) => m.egg ? null : (
                  <button
                    key={m.uid}
                    onClick={async () => {
                      const ok = await g.useItemOutside(pickTarget, i);
                      if (ok) setPickTarget(null);
                    }}
                    className="flex items-center gap-3 rounded-lg bg-slate-800/80 px-3 py-2 text-left hover:bg-slate-700"
                  >
                    <MonSprite id={m.speciesId} size={40} />
                    <b className="flex-1 text-sm">{monName(m)}</b>
                    <span className="text-xs text-slate-400">Lv.{m.level} · {m.curHP > 0 ? m.curHP : t("game.party.fainted")}</span>
                  </button>
                ))}
              </div>
            </Panel>
          );
        }
        return (
          <Panel title={t("game.bag.title")} onBack={() => close(null)}>
            {entries.length === 0 && <p className="text-slate-400">{t("game.bag.empty")}</p>}
            <div className="flex flex-col gap-3">
              {cats.map(([cat, label]) => {
                const items = entries.filter(([id]) => ITEMS[id]?.category === cat);
                if (!items.length) return null;
                return (
                  <div key={cat}>
                    <div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400">{label}</div>
                    <div className="flex flex-col gap-1">
                      {items.map(([id, n]) => (
                        <div key={id} className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-2">
                          {ITEMS[id].category === "ball" && <PokeballIcon size={18} />}
                          <div className="min-w-0 flex-1">
                            <b className="text-sm">{itemName(id)}</b>
                            <p className="truncate text-[11px] text-slate-400">{itemDesc(id)}</p>
                          </div>
                          <span className="text-xs font-bold tabular-nums text-slate-300">×{n}</span>
                          {(ITEMS[id].heal || ITEMS[id].cure || ITEMS[id].revive || ITEMS[id].evoItem || ITEMS[id].tmMove) && (
                            <button
                              onClick={() => { audio.sfx("select"); setPickTarget(id); }}
                              className="pixel-btn bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"
                            >
                              {t("game.bag.use")}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      }
      // ---------------------------------------------------------------- trainer card
      case "trainer": {
        const objectiveKey = (() => {
          if (!save.flags.starter) return "obj.starter";
          const b = save.badges.length;
          if (b < 8) return `obj.gym${b + 1}`;
          if (!save.flags.champion_done) return "obj.league";
          if (!save.flags.legend_done) return "obj.legend";
          return "obj.complete";
        })();
        return (
          <Panel title={t("game.menu.trainer")} onBack={() => close(null)}>
            <div className="rounded-xl bg-gradient-to-br from-pokeblue to-[#1c2c54] p-5 text-white shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-70">ID No. {save.trainerId}</div>
                  <div className="text-2xl font-black tracking-wider">{save.playerName}</div>
                </div>
                <PokeballIcon size={42} />
              </div>
              <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-[13px]">
                <span className="mr-1">🎯</span>
                <span className="opacity-80">{t("game.menu.objective")}:</span>{" "}
                <b>{t(objectiveKey)}</b>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Info label={t("game.menu.money")} value={`₽ ${save.money.toLocaleString()}`} />
                <Info label={t("game.menu.time")} value={fmtTime(save.playSeconds)} />
                <Info label={t("game.menu.seen")} value={`${save.dexSeen.length} / ${MAX_DEX_ID}`} />
                <Info label={t("game.menu.caught")} value={`${save.dexCaught.length} / ${MAX_DEX_ID}`} />
                <Info label="BP" value={`${save.stats?.bp ?? 0}`} />
                <Info label={t("game.menu.tower_best")} value={`${save.stats?.towerBest ?? 0} / 7`} />
              </div>
              <div className="mt-4">
                <div className="mb-1 text-xs opacity-70">{t("game.menu.badges")}</div>
                <div className="flex gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-base font-black ${
                        i < save.badges.length ? "border-amber-300 bg-amber-400 text-ink animate-glowpulse" : "border-white/25 bg-white/10 text-white/30"
                      }`}
                    >
                      {i < save.badges.length ? "★" : "·"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        );
      }
      // ---------------------------------------------------------------- save
      case "save":
        return (
          <Panel title={t("game.menu.save")} onBack={() => close(null)}>
            <div className="flex flex-col gap-3">
              <button
                className="pixel-btn bg-emerald-600 px-4 py-3 font-black text-white"
                onClick={() => { g.persist(); audio.sfx("save"); g.showToast(t("game.menu.saved")); }}
              >
                💾 {t("game.menu.save")}
              </button>
              <button
                className="pixel-btn bg-sky-600 px-4 py-3 font-black text-white"
                onClick={async () => {
                  const code = g.exportSave();
                  if (code) {
                    try { await navigator.clipboard.writeText(code); g.showToast(t("game.menu.export_done")); audio.sfx("save"); }
                    catch { g.showToast(code.slice(0, 40) + "…"); }
                  }
                }}
              >
                ⬆ {t("game.menu.export_save")}
              </button>
              <div className="rounded-lg bg-slate-800/80 p-3">
                <div className="mb-2 text-xs font-bold text-slate-400">{t("game.menu.import_save")}</div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={t("game.menu.import_ph")}
                  className="h-20 w-full rounded border border-slate-600 bg-slate-900 p-2 text-xs text-white outline-none focus:border-amber-400"
                />
                <button
                  className="pixel-btn mt-2 bg-amber-500 px-3 py-1.5 text-sm font-bold text-ink"
                  onClick={() => {
                    if (g.importSave(importText)) {
                      g.showToast(t("game.menu.import_done"));
                      audio.sfx("save");
                      g.continueGame();
                      g.setMenu(false); g.setSubmenu(null);
                    } else {
                      g.showToast(t("game.menu.import_bad"));
                      audio.sfx("cancel");
                    }
                  }}
                >
                  {t("common.confirm")}
                </button>
              </div>
            </div>
          </Panel>
        );
      // ---------------------------------------------------------------- settings
      case "settings": {
        const s = g.settings;
        return (
          <Panel title={t("game.settings.title")} onBack={() => close(null)}>
            <div className="flex flex-col gap-4">
              <Row label={t("game.settings.music")}>
                <Toggle on={s.musicOn} onChange={(v) => g.setSettings({ musicOn: v })} t={t} />
              </Row>
              <Row label={t("game.settings.sfx")}>
                <Toggle on={s.sfxOn} onChange={(v) => g.setSettings({ sfxOn: v })} t={t} />
              </Row>
              <Row label={t("game.settings.volume")}>
                <input
                  type="range" min={0} max={1} step={0.05} value={s.volume}
                  onChange={(e) => g.setSettings({ volume: Number(e.target.value) })}
                  className="w-40 accent-amber-400"
                />
              </Row>
              <Row label={t("game.settings.speed")}>
                <div className="flex gap-1">
                  {[["40", t("game.settings.speed_slow")], ["22", t("game.settings.speed_mid")], ["10", t("game.settings.speed_fast")]].map(([v, lb]) => (
                    <button
                      key={v}
                      onClick={() => g.setSettings({ textSpeed: Number(v) })}
                      className={`rounded px-2.5 py-1 text-xs font-bold ${s.textSpeed === Number(v) ? "bg-amber-400 text-ink" : "bg-slate-700 text-slate-200"}`}
                    >
                      {lb}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label={t("game.settings.lang")}>
                <div className="flex flex-wrap justify-end gap-1">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLocale(l.code)}
                      className={`rounded px-2 py-1 text-xs font-bold ${locale === l.code ? "bg-amber-400 text-ink" : "bg-slate-700 text-slate-200"}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </Row>
            </div>
          </Panel>
        );
      }
      // ---------------------------------------------------------------- box
      case "box":
        return (
          <Panel title={t("game.field.pc_box")} onBack={() => close(null)}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-bold text-amber-400">{t("game.party.title")} ({save.party.length}/6)</div>
                <div className="flex flex-col gap-1">
                  {save.party.map((m) => (
                    <button
                      key={m.uid}
                      onClick={() => {
                        // the party must keep at least one battle-able (non-egg) Pokémon
                        const rest = save.party.filter((x) => x.uid !== m.uid);
                        if (rest.length === 0 || rest.every((x) => x.egg)) { g.showToast(t("game.field.party_last")); audio.sfx("cancel"); return; }
                        save.party = rest;
                        save.box.push(m);
                        audio.sfx("select"); g.bump();
                      }}
                      className="flex items-center gap-2 rounded bg-slate-800/80 px-2 py-1.5 text-left text-sm hover:bg-slate-700"
                    >
                      {m.egg ? <EggSprite size={32} /> : <MonSprite id={m.speciesId} size={32} />}
                      <b className="flex-1 truncate">{m.egg ? t("game.party.egg") : monName(m)}</b>
                      <span className="text-xs text-slate-400">{m.egg ? "↓" : `Lv.${m.level} ↓`}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-sky-400">BOX ({save.box.length})</div>
                <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto">
                  {save.box.map((m) => (
                    <button
                      key={m.uid}
                      onClick={() => {
                        if (save.party.length >= 6) { g.showToast(t("game.field.party_full")); audio.sfx("cancel"); return; }
                        save.box = save.box.filter((x) => x.uid !== m.uid);
                        save.party.push(m);
                        audio.sfx("select"); g.bump();
                      }}
                      className="flex items-center gap-2 rounded bg-slate-800/80 px-2 py-1.5 text-left text-sm hover:bg-slate-700"
                    >
                      {m.egg ? <EggSprite size={32} /> : <MonSprite id={m.speciesId} size={32} />}
                      <b className="flex-1 truncate">{m.egg ? t("game.party.egg") : monName(m)}</b>
                      <span className="text-xs text-slate-400">{m.egg ? "↑" : `Lv.${m.level} ↑`}</span>
                    </button>
                  ))}
                  {save.box.length === 0 && <p className="text-xs text-slate-500">—</p>}
                </div>
              </div>
            </div>
          </Panel>
        );
      // ---------------------------------------------------------------- achievements
      case "achv": {
        const unlocked = new Set(save.achievements ?? []);
        return (
          <Panel title={t("achv.title")} onBack={() => close(null)}>
            <div className="mb-3 text-center text-sm font-bold text-amber-300">
              {unlocked.size} / {ACHIEVEMENTS.length}
            </div>
            <div className="grid max-h-[60vh] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {ACHIEVEMENTS.map((a) => {
                const on = unlocked.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                      on ? "bg-amber-400/15 ring-1 ring-amber-400/40" : "bg-slate-800/70 opacity-60"
                    }`}
                  >
                    <span className={`text-xl ${on ? "" : "grayscale"}`}>{a.icon}</span>
                    <div className="min-w-0">
                      <b className={`block truncate text-[13px] ${on ? "text-amber-200" : "text-slate-300"}`}>
                        {t(`achv.${a.id}.n`)}
                      </b>
                      <span className="block truncate text-[11px] text-slate-400">{t(`achv.${a.id}.d`)}</span>
                    </div>
                    {on && <span className="ml-auto text-amber-300">✓</span>}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      }
      // ---------------------------------------------------------------- shop
      case "shop":
        return (
          <Panel title={t("game.field.mart_welcome")} onBack={() => close(null)}>
            <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2 text-sm">
              <span className="text-slate-400">{t("game.menu.money")}</span>
              <b className="text-amber-300">₽ {save.money.toLocaleString()}</b>
            </div>
            <div className="flex flex-col gap-1.5">
              {MART_STOCK.map((id) => (
                <div key={id} className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-2">
                  {ITEMS[id].category === "ball" && <PokeballIcon size={18} />}
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">{itemName(id)}</b>
                    <p className="truncate text-[11px] text-slate-400">{itemDesc(id)}</p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-amber-300">₽{ITEMS[id].price}</span>
                  <button
                    onClick={() => g.buyItem(id)}
                    className="pixel-btn bg-pokered px-2.5 py-1 text-xs font-bold text-white"
                  >
                    {t("game.field.buy")}
                  </button>
                  <span className="w-8 text-right text-xs text-slate-400">×{save.bag[id] ?? 0}</span>
                </div>
              ))}
            </div>
          </Panel>
        );
      default:
        return null;
    }
  };

  if (g.submenu) {
    return <div className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-6">{renderSub()}</div>;
  }

  // main pause menu
  const items: [string, () => void][] = [
    [t("game.menu.party"), () => g.setSubmenu("party")],
    [t("game.menu.bag"), () => g.setSubmenu("bag")],
    [t("game.menu.trainer"), () => g.setSubmenu("trainer")],
    [t("achv.title"), () => g.setSubmenu("achv")],
    [t("game.menu.dex"), () => window.open("/pokedex", "_blank")],
    [t("game.menu.save"), () => g.setSubmenu("save")],
    [t("game.menu.settings"), () => g.setSubmenu("settings")],
    [t("game.menu.resume"), () => g.setMenu(false)],
    [t("game.menu.exit"), () => g.toTitle()],
  ];
  return (
    <div className="absolute inset-0 z-50 flex justify-end bg-black/40" onClick={() => g.setMenu(false)}>
      <div className="pixel-panel-dark m-3 flex h-fit min-w-[200px] flex-col gap-1 p-2" onClick={(e) => e.stopPropagation()}>
        {items.map(([label, fn], i) => (
          <button
            key={i}
            onClick={() => { audio.sfx("select"); fn(); }}
            className="rounded px-4 py-2.5 text-left text-[15px] font-bold text-slate-100 hover:bg-slate-700/80"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, children, onBack }: { title: string; children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="pixel-panel-dark w-full max-w-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black text-amber-300">{title}</h2>
        <button onClick={onBack} className="pixel-btn bg-slate-600 px-3 py-1 text-sm font-bold text-white">✕</button>
      </div>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white/10 px-3 py-2">
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
      <span className="text-sm font-bold text-slate-200">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, t }: { on: boolean; onChange: (v: boolean) => void; t: (k: string) => string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`rounded-full px-4 py-1.5 text-xs font-black ${on ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}
    >
      {on ? t("common.on") : t("common.off")}
    </button>
  );
}
