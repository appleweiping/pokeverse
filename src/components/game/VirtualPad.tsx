"use client";
import React, { useEffect, useState } from "react";
import type { Dir } from "@/lib/types";
import type { Overworld } from "@/lib/game/engine";
import { useGame } from "@/lib/game/state";
import { audio } from "@/lib/audio/tracks";

/** Touch controls: D-pad + A/B + menu. Rendered only on coarse pointers. */
export default function VirtualPad({ engineRef }: { engineRef: React.MutableRefObject<Overworld | null> }) {
  const [touch, setTouch] = useState(false);
  const phase = useGame((s) => s.phase);
  const setMenu = useGame((s) => s.setMenu);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    setTouch(coarse);
  }, []);

  if (!touch || phase !== "overworld") return null;

  const press = (d: Dir) => () => engineRef.current?.setVirtualDir(d);
  const release = () => engineRef.current?.setVirtualDir(null);

  const dirBtn = (d: Dir, label: string, cls: string) => (
    <button
      className={`vpad-btn absolute h-12 w-12 rounded-lg bg-slate-800/80 text-lg font-black text-slate-200 active:bg-slate-600 ${cls}`}
      onPointerDown={press(d)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* D-pad */}
      <div className="pointer-events-auto absolute bottom-6 left-4 z-40 h-[150px] w-[150px] select-none opacity-90">
        {dirBtn("up", "▲", "left-[51px] top-0")}
        {dirBtn("down", "▼", "left-[51px] bottom-0")}
        {dirBtn("left", "◀", "left-0 top-[51px]")}
        {dirBtn("right", "▶", "right-0 top-[51px]")}
        <div className="absolute left-[51px] top-[51px] h-12 w-12 rounded-lg bg-slate-800/60" />
      </div>
      {/* A / B */}
      <div className="pointer-events-auto absolute bottom-8 right-4 z-40 flex select-none items-end gap-3 opacity-90">
        <button
          className="vpad-btn h-12 w-12 rounded-full bg-slate-700/85 text-sm font-black text-white active:bg-slate-500"
          onPointerDown={() => engineRef.current?.setRunning(true)}
          onPointerUp={() => engineRef.current?.setRunning(false)}
          onPointerLeave={() => engineRef.current?.setRunning(false)}
        >
          B
        </button>
        <button
          className="vpad-btn h-16 w-16 rounded-full bg-pokered/90 text-lg font-black text-white active:brightness-75"
          onPointerDown={() => engineRef.current?.virtualA()}
        >
          A
        </button>
      </div>
      {/* menu */}
      <button
        className="vpad-btn pointer-events-auto absolute right-4 top-4 z-40 rounded-lg bg-slate-800/85 px-4 py-2 text-sm font-black text-amber-300"
        onPointerDown={() => { audio.sfx("select"); setMenu(true); }}
      >
        ☰ MENU
      </button>
    </>
  );
}
