"use client";
import React, { useEffect, useState } from "react";
import { useGame } from "@/lib/game/state";
import { useI18n } from "@/lib/i18n";
import { audio } from "@/lib/audio/tracks";
import { MonSprite, PokeballIcon } from "@/components/shared";

/** End-of-game credits roll, shown after entering the Hall of Fame. */
export default function CreditsModal() {
  const credits = useGame((s) => s.credits);
  const save = useGame((s) => s.save);
  const { t } = useI18n();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!credits) return;
    setDone(false);
    audio.playMusic("credits");
    const timer = setTimeout(() => setDone(true), 26000);
    return () => clearTimeout(timer);
  }, [credits]);

  if (!credits) return null;

  const close = () => {
    if (!done) return;
    audio.stopMusic();
    useGame.setState({ credits: false });
  };

  const team = save?.hallOfFame?.team ?? [];

  return (
    <div className="absolute inset-0 z-[80] overflow-hidden bg-[#06070d]" onClick={close}>
      <div className="credits-roll mx-auto flex max-w-md flex-col items-center gap-10 px-6 text-center">
        <div className="h-[55vh]" />
        <PokeballIcon size={48} className="animate-spinslow" />
        <h1 className="font-pixel text-2xl text-amber-300">PokéVerse</h1>
        <h2 className="text-xl font-black text-white">{t("credits.congrats")}</h2>

        <div>
          <div className="mb-3 text-sm font-bold tracking-widest text-sky-300">HALL OF FAME</div>
          <div className="flex flex-wrap justify-center gap-3">
            {team.map((m, i) => (
              <div key={i} className="flex flex-col items-center">
                <MonSprite id={m.speciesId} size={64} animateGen5 />
                <span className="text-[11px] font-bold text-slate-400">Lv.{m.level}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm font-bold text-amber-200">{save?.playerName}</div>
        </div>

        {[
          ["GAME DESIGN", "PokéVerse Project"],
          ["ENGINE & BATTLE SYSTEM", "Canvas 2D · TypeScript"],
          ["PIXEL ART", "Procedural GBA-style tiles & sprites"],
          ["MUSIC & SOUND", "Original chiptune · Web Audio"],
          ["POKÉMON DATA", "PokeAPI · jsDelivr CDN"],
          ["LOCALIZATION", "简体中文 · 繁體中文 · English · 日本語 · 한국어"],
          ["SPECIAL THANKS", t("credits.thanks")],
        ].map(([title, body], i) => (
          <div key={i}>
            <div className="text-xs font-bold tracking-[0.3em] text-slate-500">{title}</div>
            <div className="mt-1 text-base font-bold text-slate-200">{body}</div>
          </div>
        ))}

        <div className="text-sm text-slate-400">{t("credits.disclaimer")}</div>
        <div className="font-pixel text-sm text-amber-300">THE END</div>
        <div className="h-[40vh]" />
      </div>
      {done && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-blink font-pixel text-[10px] text-slate-300">
          {t("intro.press")}
        </div>
      )}
    </div>
  );
}
