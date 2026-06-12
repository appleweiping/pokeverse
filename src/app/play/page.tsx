"use client";
import React, { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useGame } from "@/lib/game/state";
import { loadDex, loadMoves, loadLearnsets } from "@/lib/data/dex";
import type { Overworld } from "@/lib/game/engine";
import GameCanvas from "@/components/game/GameCanvas";
import DialogueUI from "@/components/game/DialogueUI";
import TitleScreen from "@/components/game/TitleScreen";
import MenuUI from "@/components/game/MenuUI";
import EvolutionModal from "@/components/game/EvolutionModal";
import CreditsModal from "@/components/game/CreditsModal";
import VirtualPad from "@/components/game/VirtualPad";

const BattleUI = dynamic(() => import("@/components/game/BattleUI"), { ssr: false });

export default function PlayPage() {
  const phase = useGame((s) => s.phase);
  const menuOpen = useGame((s) => s.menuOpen);
  const submenu = useGame((s) => s.submenu);
  const evolution = useGame((s) => s.evolution);
  const battleSession = useGame((s) => s.battleSession);
  const loadSettings = useGame((s) => s.loadSettings);
  const engineRef = useRef<Overworld | null>(null);

  useEffect(() => {
    loadSettings();
    // warm the data caches so battles start instantly
    void loadDex();
    void loadMoves();
    void loadLearnsets();
    // debug / e2e hook
    (window as unknown as { __pv: typeof useGame }).__pv = useGame;
  }, [loadSettings]);

  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-ink">
      <GameCanvas engineRef={engineRef} />
      {phase === "title" && <TitleScreen />}
      {phase === "battle" && battleSession && <BattleUI />}
      {(menuOpen || submenu) && <MenuUI />}
      <DialogueUI />
      {evolution && <EvolutionModal />}
      <CreditsModal />
      <VirtualPad engineRef={engineRef} />

      {/* desktop menu hint */}
      {phase === "overworld" && !menuOpen && !submenu && (
        <div className="pointer-events-none absolute bottom-2 right-3 z-30 hidden text-[11px] font-bold text-white/50 sm:block">
          Z/Space=A · X=B · Enter=Menu
        </div>
      )}
    </main>
  );
}
