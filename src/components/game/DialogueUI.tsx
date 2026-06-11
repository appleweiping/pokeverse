"use client";
import React, { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/game/state";
import { audio } from "@/lib/audio/tracks";

/** Typewriter dialogue box + choice menu + toast. */
export default function DialogueUI() {
  const dialogue = useGame((s) => s.dialogue);
  const choice = useGame((s) => s.choice);
  const toast = useGame((s) => s.toast);
  const textSpeed = useGame((s) => s.settings.textSpeed);
  const advance = useGame((s) => s.advanceDialogue);
  const pick = useGame((s) => s.pickChoice);

  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  const [sel, setSel] = useState(0);
  const lineRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const line = dialogue ? dialogue.lines[dialogue.idx] : null;

  useEffect(() => {
    if (line == null) return;
    lineRef.current = line;
    setShown("");
    setDone(false);
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++;
      setShown(line.slice(0, i));
      if (i >= line.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setDone(true);
      }
    }, Math.max(8, textSpeed));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [line, textSpeed]);

  useEffect(() => setSel(0), [choice]);

  // keyboard control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (choice) {
        if (k === "arrowup" || k === "w") { setSel((s) => Math.max(0, s - 1)); audio.sfx("move"); e.preventDefault(); }
        else if (k === "arrowdown" || k === "s") { setSel((s) => Math.min(choice.options.length - 1, s + 1)); audio.sfx("move"); e.preventDefault(); }
        else if (k === "z" || k === " " || k === "enter") { audio.sfx("select"); pick(choice.options[sel]?.value ?? null); e.preventDefault(); }
        else if (k === "x" || k === "escape") { audio.sfx("cancel"); pick(null); e.preventDefault(); }
        return;
      }
      if (dialogue) {
        if (k === "z" || k === " " || k === "enter") {
          e.preventDefault();
          handleAdvance();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogue, choice, sel, done]);

  const handleAdvance = () => {
    if (!dialogue) return;
    if (!done) {
      // fast-forward
      if (timerRef.current) clearInterval(timerRef.current);
      setShown(lineRef.current);
      setDone(true);
    } else {
      audio.sfx("select");
      advance();
    }
  };

  return (
    <>
      {dialogue && (
        <div
          className="absolute inset-x-0 bottom-0 z-40 p-3 sm:p-5"
          onClick={handleAdvance}
          onTouchEnd={(e) => { e.preventDefault(); handleAdvance(); }}
        >
          <div className="pixel-panel mx-auto min-h-[92px] max-w-3xl px-5 py-4 text-[15px] leading-relaxed sm:text-base">
            <span>{shown}</span>
            {done && <span className="adv-arrow text-pokered" />}
          </div>
        </div>
      )}

      {choice && (
        <div className="absolute inset-x-0 bottom-0 z-50 p-3 sm:p-5">
          <div className="mx-auto flex max-w-3xl flex-col items-end gap-2">
            <div className="pixel-panel w-full px-5 py-3 text-[15px] sm:text-base">{choice.prompt}</div>
            <div className="pixel-panel min-w-[200px] px-2 py-2">
              {choice.options.map((o, i) => (
                <button
                  key={o.value}
                  className={`block w-full rounded px-3 py-2 text-left text-[14px] font-bold sm:text-[15px] ${
                    i === sel ? "bg-amber-300/80" : "hover:bg-amber-200/50"
                  }`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => { audio.sfx("select"); pick(o.value); }}
                >
                  {i === sel ? "▶ " : "　"}{o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-6 z-[70] -translate-x-1/2 animate-pop">
          <div className="pixel-panel-dark px-4 py-2 text-sm font-bold text-amber-300">{toast}</div>
        </div>
      )}
    </>
  );
}
