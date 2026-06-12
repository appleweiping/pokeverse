"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, LOCALES } from "@/lib/i18n";
import { ALL_TYPES, type TypeName } from "@/lib/types";
import { matchup, TYPE_COLORS } from "@/lib/data/typechart";
import { spriteAnimated } from "@/lib/data/dex";
import { audio } from "@/lib/audio/tracks";
import { MonSprite, PokeballIcon, TypeBadge } from "@/components/shared";

// ---------------------------------------------------------------- utilities

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => e.isIntersecting && setVis(true), { threshold: 0.15 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return { ref, vis };
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const { ref, vis } = useReveal();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!vis) return;
    const t0 = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setN(Math.floor(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vis, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {n.toLocaleString()}{suffix}
    </span>
  );
}

// ---------------------------------------------------------------- nav

export function NavBar() {
  const { t, locale, setLocale } = useI18n();
  const [musicOn, setMusicOn] = useState(false);
  const [open, setOpen] = useState(false);

  const toggleMusic = () => {
    if (musicOn) { audio.stopMusic(); setMusicOn(false); }
    else { audio.ensure(); audio.playMusic("title"); setMusicOn(true); }
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-black">
          <PokeballIcon size={24} className="animate-spinslow" />
          <span className="hidden text-amber-300 sm:inline">{t("site.brand")}</span>
          <span className="text-amber-300 sm:hidden">PokéVerse</span>
        </Link>
        <div className="ml-auto hidden items-center gap-5 text-sm font-bold text-slate-300 md:flex">
          <Link className="hover:text-amber-300" href="/">{t("site.nav.home")}</Link>
          <Link className="hover:text-amber-300" href="/pokedex">{t("site.nav.dex")}</Link>
          <Link className="hover:text-amber-300" href="/battle">{t("site.nav.battle")}</Link>
          <Link className="rounded-lg bg-pokered px-3 py-1.5 text-white shadow hover:brightness-110" href="/play">
            ▶ {t("site.nav.play")}
          </Link>
        </div>
        <button
          onClick={toggleMusic}
          title="music"
          className={`rounded-lg border border-white/15 px-2.5 py-1.5 text-sm ${musicOn ? "bg-amber-400 text-ink" : "text-slate-300"}`}
        >
          {musicOn ? "♪" : "♪̸"}
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-white/15 px-2.5 py-1.5 text-sm font-bold text-slate-300"
          >
            {LOCALES.find((l) => l.code === locale)?.label ?? locale} ▾
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 overflow-hidden rounded-lg border border-white/15 bg-panel shadow-xl">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLocale(l.code); setOpen(false); }}
                  className={`block w-full px-4 py-2 text-left text-sm font-bold hover:bg-white/10 ${
                    l.code === locale ? "text-amber-300" : "text-slate-200"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link
          href="/play"
          className="rounded-lg bg-pokered px-3 py-1.5 text-sm font-bold text-white shadow md:hidden"
        >
          ▶
        </Link>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------- hero

const HERO_MONS = [25, 6, 9, 3, 150, 133, 143, 94];

export function Hero() {
  const { t } = useI18n();
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  return (
    <header
      className="scanlines relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0c1024] via-[#182454] to-[#0c1024] px-4 pt-20"
      onMouseMove={(e) => {
        const { innerWidth: w, innerHeight: h } = window;
        setParallax({ x: (e.clientX / w - 0.5) * 2, y: (e.clientY / h - 0.5) * 2 });
      }}
    >
      <div className="hero-grid absolute inset-0 opacity-50" />
      {/* parallax sprites */}
      <div className="pointer-events-none absolute inset-0">
        {HERO_MONS.map((id, i) => (
          <div
            key={id}
            className="absolute animate-float"
            style={{
              left: `${6 + (i % 4) * 25}%`,
              top: `${14 + Math.floor(i / 4) * 52}%`,
              opacity: 0.5,
              transform: `translate(${parallax.x * (10 + i * 4)}px, ${parallax.y * (8 + i * 3)}px)`,
              animationDelay: `${i * 0.6}s`,
              transition: "transform .3s ease-out",
            }}
          >
            <MonSprite id={id} size={i % 3 === 0 ? 96 : 72} animateGen5 />
          </div>
        ))}
      </div>

      <div className="relative z-10 flex max-w-4xl flex-col items-center gap-6 text-center">
        <span className="animate-risefade rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-xs font-bold tracking-wider text-amber-300">
          {t("site.hero.badge")}
        </span>
        <h1 className="animate-risefade text-4xl font-black leading-tight sm:text-6xl" style={{ animationDelay: ".1s" }}>
          {t("site.hero.title1")}
          <br />
          <span className="text-glow bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent">
            {t("site.hero.title2")}
          </span>
        </h1>
        <p className="max-w-xl animate-risefade text-base text-slate-300 sm:text-lg" style={{ animationDelay: ".2s" }}>
          {t("site.hero.subtitle")}
        </p>
        <div className="flex animate-risefade flex-wrap items-center justify-center gap-3" style={{ animationDelay: ".3s" }}>
          <Link
            href="/play"
            className="group relative overflow-hidden rounded-xl bg-pokered px-8 py-4 text-lg font-black text-white shadow-[0_6px_0_#8a1f06] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_#8a1f06]"
          >
            <span className="relative z-10">{t("site.hero.cta_play")}</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </Link>
          <Link href="/pokedex" className="rounded-xl border-2 border-sky-400/60 px-6 py-4 text-base font-bold text-sky-300 hover:bg-sky-400/10">
            {t("site.hero.cta_dex")}
          </Link>
          <Link href="/battle" className="rounded-xl border-2 border-violet-400/60 px-6 py-4 text-base font-bold text-violet-300 hover:bg-violet-400/10">
            {t("site.hero.cta_battle")}
          </Link>
        </div>
        <span className="font-pixel text-[9px] tracking-widest text-slate-500">{t("site.hero.version")}</span>
      </div>

      <div className="absolute bottom-6 z-10 animate-blink font-pixel text-[9px] text-slate-400">
        ▼ {t("site.hero.scroll")}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- stats

export function Stats() {
  const { t } = useI18n();
  const { ref, vis } = useReveal();
  const items: [number, string][] = [
    [1025, t("site.stats.species")],
    [937, t("site.stats.moves")],
    [18, t("site.stats.types")],
    [5, t("site.stats.langs")],
    [31, t("site.stats.maps")],
    [14, t("site.stats.tracks")],
  ];
  return (
    <section ref={ref} className={`mx-auto max-w-6xl px-4 py-16 ${vis ? "animate-risefade" : "opacity-0"}`}>
      <h2 className="mb-10 text-center text-2xl font-black text-white sm:text-3xl">{t("site.stats.title")}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(([n, label], i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-panel/80 p-5 text-center shadow-lg">
            <div className="text-3xl font-black text-amber-300">
              <Counter to={n} />
            </div>
            <div className="mt-1 text-xs font-bold text-slate-400">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- features

const FEATURES: { key: string; icon: string; color: string }[] = [
  { key: "world", icon: "🌍", color: "#56b856" },
  { key: "dex", icon: "📕", color: "#e3350d" },
  { key: "battle", icon: "⚔️", color: "#f7a531" },
  { key: "online", icon: "🌐", color: "#3a7fd0" },
  { key: "music", icon: "🎵", color: "#a85ab8" },
  { key: "i18n", icon: "🗺️", color: "#58b8d0" },
  { key: "save", icon: "💾", color: "#8a93a8" },
  { key: "mobile", icon: "📱", color: "#d685ad" },
];

export function Features() {
  const { t } = useI18n();
  const { ref, vis } = useReveal();
  return (
    <section className="bg-[#0c0f1a] py-16">
      <div ref={ref} className={`mx-auto max-w-6xl px-4 ${vis ? "" : "opacity-0"}`}>
        <h2 className="text-center text-2xl font-black sm:text-3xl">{t("site.features.title")}</h2>
        <p className="mt-2 text-center text-sm text-slate-400">{t("site.features.sub")}</p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.key}
              className={`group rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-lg transition-all hover:-translate-y-1.5 hover:shadow-2xl ${
                vis ? "animate-risefade" : ""
              }`}
              style={{ animationDelay: `${i * 0.07}s`, borderTopColor: f.color, borderTopWidth: 3 }}
            >
              <div className="text-3xl transition-transform group-hover:scale-125 group-hover:-rotate-6">{f.icon}</div>
              <h3 className="mt-3 font-black text-white">{t(`site.features.${f.key}.t`)}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{t(`site.features.${f.key}.d`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- dex preview marquee

const ROW_A = [25, 1, 4, 7, 150, 151, 133, 6, 9, 3, 94, 130, 143, 39, 52, 54];
const ROW_B = [149, 248, 282, 384, 445, 448, 471, 473, 493, 530, 571, 609, 635, 658, 700, 706];

export function DexPreview() {
  const { t } = useI18n();
  return (
    <section className="overflow-hidden py-16">
      <h2 className="text-center text-2xl font-black sm:text-3xl">{t("site.dexsec.title")}</h2>
      <p className="mt-2 text-center text-sm text-slate-400">{t("site.dexsec.sub")}</p>
      <div className="mt-10 flex flex-col gap-6">
        {[ROW_A, ROW_B].map((row, ri) => (
          <div key={ri} className="relative flex overflow-hidden">
            <div
              className="flex shrink-0 animate-marquee items-end gap-10 pr-10"
              style={{ animationDirection: ri === 1 ? "reverse" : "normal", animationDuration: `${34 + ri * 8}s` }}
            >
              {[...row, ...row].map((id, i) => (
                <Link key={`${id}-${i}`} href={`/pokedex/${id}`} className="transition-transform hover:scale-125">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={spriteAnimated(id)} alt={`#${id}`} className="sprite pixelated h-16 w-16 object-contain" loading="lazy" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link href="/pokedex" className="rounded-xl border-2 border-amber-300/60 px-6 py-3 font-bold text-amber-300 hover:bg-amber-300/10">
          {t("site.dexsec.viewall")}
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- type chart

export function TypeChartSection() {
  const { t } = useI18n();
  const [hover, setHover] = useState<[TypeName, TypeName] | null>(null);
  const cellColor = (m: number) =>
    m === 0 ? "#1c2030" : m === 2 ? "#e35060" : m === 0.5 ? "#3a4668" : "transparent";
  const cellText = (m: number) => (m === 0 ? "0" : m === 2 ? "2" : m === 0.5 ? "½" : "");

  return (
    <section className="bg-[#0c0f1a] py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-2xl font-black sm:text-3xl">{t("site.typechart.title")}</h2>
        <p className="mt-2 text-center text-sm text-slate-400">{t("site.typechart.sub")}</p>
        <div className="mt-4 h-7 text-center text-sm font-bold text-amber-300">
          {hover && (
            <span className="animate-pop inline-block">
              {t(`types.${hover[0]}`)} → {t(`types.${hover[1]}`)} : ×{matchup(hover[0], hover[1])}
            </span>
          )}
        </div>
        <div className="mt-2 overflow-x-auto pb-3">
          <table className="mx-auto border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[#0c0f1a] p-1 text-[10px] text-slate-500">
                  {t("site.typechart.atk")} ⟍ {t("site.typechart.def")}
                </th>
                {ALL_TYPES.map((d) => (
                  <th key={d} className="p-0.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded text-[9px] font-black text-white"
                      style={{ backgroundColor: TYPE_COLORS[d] }}
                      title={t(`types.${d}`)}
                    >
                      {t(`types.${d}`).slice(0, 2)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_TYPES.map((a) => (
                <tr key={a}>
                  <td className="sticky left-0 bg-[#0c0f1a] p-0.5">
                    <div
                      className="flex h-7 w-16 items-center justify-center rounded text-[10px] font-black text-white"
                      style={{ backgroundColor: TYPE_COLORS[a] }}
                    >
                      {t(`types.${a}`)}
                    </div>
                  </td>
                  {ALL_TYPES.map((d) => {
                    const m = matchup(a, d);
                    return (
                      <td key={d} className="p-0.5">
                        <div
                          onMouseEnter={() => setHover([a, d])}
                          onMouseLeave={() => setHover(null)}
                          className="flex h-7 w-7 cursor-crosshair items-center justify-center rounded text-[11px] font-black text-white/90 transition-transform hover:scale-125 hover:ring-2 hover:ring-amber-300"
                          style={{ backgroundColor: cellColor(m) }}
                        >
                          {cellText(m)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- CTA + footer

export function FinalCTA() {
  const { t } = useI18n();
  const { ref, vis } = useReveal();
  return (
    <section ref={ref} className={`relative overflow-hidden py-24 text-center ${vis ? "animate-risefade" : "opacity-0"}`}>
      <div className="hero-grid absolute inset-0 opacity-30" />
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-5 px-4">
        <div className="flex gap-6">
          {[1, 4, 7].map((id) => (
            <MonSprite key={id} id={id} size={88} animateGen5 className="animate-float" />
          ))}
        </div>
        <h2 className="text-3xl font-black sm:text-4xl">{t("site.cta.title")}</h2>
        <p className="text-slate-400">{t("site.cta.sub")}</p>
        <Link
          href="/play"
          className="animate-glowpulse rounded-2xl bg-amber-400 px-10 py-5 text-xl font-black text-ink shadow-xl transition-transform hover:scale-105"
        >
          {t("site.cta.button")}
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-white/10 bg-[#0a0c14] py-10 text-center text-xs text-slate-500">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4">
        <div className="flex items-center justify-center gap-2 font-bold text-slate-400">
          <PokeballIcon size={16} /> {t("site.brand")} · {t("site.tagline")}
        </div>
        <p>{t("site.footer.disclaimer")}</p>
        <p>{t("site.footer.fan")}</p>
        <p className="mt-2 text-slate-600">
          {t("site.footer.credits")} · Next.js + Canvas + Web Audio ·{" "}
          <Link className="underline-offset-2 hover:text-slate-400 hover:underline" href="/changelog">Changelog</Link> ·{" "}
          <Link className="underline-offset-2 hover:text-slate-400 hover:underline" href="/replays">Replays</Link> ·{" "}
          <a className="underline-offset-2 hover:text-slate-400 hover:underline" href="https://github.com/appleweiping/pokeverse" target="_blank" rel="noreferrer">GitHub</a>
        </p>
      </div>
    </footer>
  );
}
