"use client";
import React, { useEffect, useState } from "react";
import { useGame } from "@/lib/game/state";
import { useI18n, LOCALES } from "@/lib/i18n";
import { audio } from "@/lib/audio/tracks";
import { MonSprite, PokeballIcon } from "@/components/shared";

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function TitleScreen() {
  const { t, locale, setLocale } = useI18n();
  const g = useGame();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const existing = g.hasSave();

  // music needs one user gesture
  useEffect(() => {
    const unlock = () => {
      if (!unlocked) {
        audio.ensure();
        audio.playMusic("title");
        setUnlocked(true);
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [unlocked]);

  const startNew = () => {
    if (existing && !confirmDelete) { setConfirmDelete(true); return; }
    setNaming(true);
    setConfirmDelete(false);
  };

  const go = () => {
    audio.sfx("select");
    g.startNew(name.trim() || "RED");
  };

  if (naming) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ink p-6">
        <div className="pixel-panel-dark w-full max-w-md p-6">
          <h2 className="mb-4 text-center text-lg font-black text-amber-300">{t("game.title.name_prompt")}</h2>
          <input
            autoFocus
            value={name}
            maxLength={10}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder={t("game.title.name_ph")}
            className="w-full rounded border-2 border-slate-600 bg-slate-900 px-4 py-3 text-center text-lg font-bold tracking-widest text-white outline-none focus:border-amber-400"
          />
          <button
            onClick={go}
            className="pixel-btn mt-5 w-full bg-pokered px-4 py-3 text-base font-black text-white hover:brightness-110"
          >
            {t("game.title.start")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#0c1024] via-[#16204a] to-[#0c1024] py-10">
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
      {/* floating sprites */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[25, 1, 4, 7, 133, 39].map((id, i) => (
          <div
            key={id}
            className="absolute animate-float opacity-40"
            style={{
              left: `${8 + i * 15}%`,
              top: `${12 + (i % 3) * 24}%`,
              animationDelay: `${i * 0.7}s`,
            }}
          >
            <MonSprite id={id} size={64} />
          </div>
        ))}
      </div>

      <div className="z-10 mt-10 flex flex-col items-center gap-3 px-4 text-center">
        <div className="flex items-center gap-3">
          <PokeballIcon size={34} className="animate-spinslow" />
          <span className="font-pixel text-[10px] tracking-widest text-sky-300">AURORA REGION</span>
          <PokeballIcon size={34} className="animate-spinslow" />
        </div>
        <h1 className="text-glow font-pixel text-3xl leading-snug text-glow sm:text-5xl" style={{ color: "#ffcb05" }}>
          PokéVerse
        </h1>
        <h2 className="text-2xl font-black tracking-[0.3em] text-white sm:text-3xl">{t("site.brandShort")}</h2>
        <p className="mt-1 max-w-md text-sm text-slate-300">{t("game.title.hint")}</p>
      </div>

      <div className="z-10 flex w-full max-w-sm flex-col gap-3 px-6">
        {existing && (
          <button
            onClick={() => { audio.sfx("select"); g.continueGame(); }}
            className="pixel-btn bg-amber-400 px-4 py-3.5 text-base font-black text-ink hover:brightness-110"
          >
            ▶ {t("game.title.continue")}
            <div className="mt-0.5 text-[11px] font-bold opacity-70">
              {t("game.title.has_save", {
                name: existing.playerName,
                badges: existing.badges.length,
                time: fmtTime(existing.playSeconds),
              })}
            </div>
          </button>
        )}
        <button
          onClick={startNew}
          className="pixel-btn bg-pokered px-4 py-3.5 text-base font-black text-white hover:brightness-110"
        >
          {confirmDelete ? t("game.title.delete_confirm") : t("game.title.new")}
        </button>
        {confirmDelete && (
          <button
            onClick={() => setConfirmDelete(false)}
            className="pixel-btn bg-slate-600 px-4 py-2 text-sm font-bold text-white"
          >
            {t("common.cancel")}
          </button>
        )}

        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-xs text-slate-400">{t("game.title.lang")}:</span>
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={`rounded px-2 py-1 text-xs font-bold ${
                locale === l.code ? "bg-amber-400 text-ink" : "bg-slate-700/70 text-slate-200 hover:bg-slate-600"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <a href="/" className="text-center text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">
          ← {t("site.nav.home")}
        </a>
        {!unlocked && (
          <p className="animate-blink text-center font-pixel text-[9px] text-amber-300">{t("intro.press")}</p>
        )}
      </div>
    </div>
  );
}
