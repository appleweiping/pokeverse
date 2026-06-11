"use client";
import React, { useEffect, useState } from "react";
import { useGame } from "@/lib/game/state";
import { useI18n } from "@/lib/i18n";
import { getSpecies, localName } from "@/lib/data/dex";
import { evolveMon } from "@/lib/game/factory";
import { audio } from "@/lib/audio/tracks";
import { MonSprite } from "@/components/shared";

/** Full-screen evolution cinematic. */
export default function EvolutionModal() {
  const evo = useGame((s) => s.evolution);
  const { t, locale } = useI18n();
  const [stage, setStage] = useState<"pulse" | "done">("pulse");
  const [names, setNames] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (!evo) return;
    setStage("pulse");
    setNames(null);
    audio.playMusic("evolution");
    let cancelled = false;
    (async () => {
      const [fromSp, toSp] = await Promise.all([getSpecies(evo.fromId), getSpecies(evo.toId)]);
      if (cancelled) return;
      setNames({ from: localName(fromSp.n, locale), to: localName(toSp.n, locale) });
    })();
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const save = useGame.getState().save;
      const mon = save?.party.find((m) => m.uid === evo.uid) ?? save?.box.find((m) => m.uid === evo.uid);
      if (mon) await evolveMon(mon, evo.toId);
      useGame.getState().markCaught(evo.toId);
      audio.stopMusic();
      audio.sfx("evolve");
      setStage("done");
    }, 3400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evo?.uid, evo?.toId]);

  if (!evo) return null;

  const close = () => {
    if (stage !== "done") return;
    const e = useGame.getState().evolution;
    useGame.setState({ evolution: null });
    useGame.getState().persist();
    e?.resolve?.();
  };

  return (
    <div
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-[#0a0c16]/95"
      onClick={close}
    >
      <div className="relative flex h-56 w-56 items-center justify-center">
        <div className="absolute inset-0 animate-glowpulse rounded-full" />
        {stage === "pulse" ? (
          <div className="anim-evolve">
            <MonSprite id={evo.fromId} size={180} />
          </div>
        ) : (
          <div className="animate-pop">
            <MonSprite id={evo.toId} size={180} />
          </div>
        )}
      </div>
      <div className="pixel-panel mx-4 max-w-xl px-6 py-4 text-center text-[15px]">
        {stage === "pulse"
          ? t("game.battle.evolve_start", { name: names?.from ?? "?" })
          : t("game.battle.evolved", { from: names?.from ?? "?", to: names?.to ?? "?" })}
        {stage === "done" && <span className="adv-arrow text-pokered" />}
      </div>
    </div>
  );
}
