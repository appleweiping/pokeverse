"use client";
import React, { useEffect, useRef } from "react";
import { Overworld } from "@/lib/game/engine";
import { useGame } from "@/lib/game/state";

/** Hosts the canvas + overworld engine; rebuilds when a save becomes active. */
export default function GameCanvas({ engineRef }: { engineRef: React.MutableRefObject<Overworld | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const phase = useGame((s) => s.phase);
  const inWorld = phase === "overworld" || phase === "battle";

  useEffect(() => {
    if (!inWorld || !canvasRef.current || !wrapRef.current) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.floor(r.width);
      canvas.height = Math.floor(r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const engine = new Overworld(canvas);
    engineRef.current = engine;
    (window as unknown as { __pvEngine: Overworld }).__pvEngine = engine;

    // play-time ticker + autosave safety net
    const tick = setInterval(() => {
      const s = useGame.getState().save;
      if (s && useGame.getState().phase === "overworld") s.playSeconds += 1;
    }, 1000);
    const onUnload = () => useGame.getState().persist();
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(tick);
      window.removeEventListener("beforeunload", onUnload);
      ro.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inWorld]);

  if (!inWorld) return null;
  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="game-canvas h-full w-full" />
    </div>
  );
}
