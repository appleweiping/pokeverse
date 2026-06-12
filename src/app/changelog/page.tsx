"use client";
import React from "react";
import { NavBar, Footer } from "@/components/landing/Sections";
import { useI18n } from "@/lib/i18n";

const RELEASES: { v: string; date: string; zh: string[]; en: string[] }[] = [
  {
    v: "v0.6.0", date: "2026-06-12",
    zh: ["联机对战升级 3v3（含换人与强制替补）", "对战回放系统（保存/播放/倍速）", "PWA 离线支持（可安装、数据与精灵缓存）", "33 枚成就 + 成就页", "更新日志页"],
    en: ["Online battles upgraded to 3v3 with switching", "Battle replays (save / playback / speed)", "PWA offline support (installable, data & sprite caching)", "33 achievements + achievements page", "Changelog page"],
  },
  {
    v: "v0.5.0", date: "2026-06-12",
    zh: ["EV 努力值系统", "24 枚可复用技能机器 TM", "替身/束缚/聚气/飞翔挖洞蓄力", "特性 +20（加速/再生力/魔法防守等）", "属性配色命中粒子"],
    en: ["EV training system", "24 reusable TMs", "Substitute / Bind / Focus Energy / two-turn Fly & Dig", "+20 abilities (Speed Boost, Regenerator, Magic Guard...)", "Type-colored hit particles"],
  },
  {
    v: "v0.4.0", date: "2026-06-12",
    zh: ["雷鸣市 + 电系道馆（电网谜题）", "芳草镇 + 草系道馆（树篱迷宫）", "极光队第一幕（拦截×2 + 据点 + 干部战）", "新曲 2 首、训练家 11 名、27 图连通"],
    en: ["Thunder City + Electric Gym (barrier puzzle)", "Meadow Town + Grass Gym (hedge maze)", "Team Aurora act 1 (interceptions, hideout, admin fight)", "2 new tracks, 11 trainers, 27 connected maps"],
  },
  {
    v: "v0.3.0", date: "2026-06-12",
    zh: ["GBA 正统美术大改：16×20 描边角色精灵", "FRLG 风格全瓦片重绘", "后台标签页画布修复"],
    en: ["GBA-authentic art overhaul: 16×20 outlined sprites", "Full FRLG-style tileset repaint", "Background-tab canvas fix"],
  },
  {
    v: "v0.2.0", date: "2026-06-11",
    zh: ["30+ 特性、四种天气、携带树果", "月见洞窟/潮汐镇/水系道馆", "秘传机制（居合斩/碎岩/冲浪）"],
    en: ["30+ abilities, 4 weather states, held berries", "Moonview Cave / Tidal Town / Water Gym", "HM field moves (Cut / Rock Smash / Surf)"],
  },
  {
    v: "v0.1.0", date: "2026-06-11",
    zh: ["像素引擎、全国图鉴 1025、正统战斗公式", "芯片音源 10 曲、五语言、PeerJS 联机", "官网 + Vercel 部署"],
    en: ["Pixel engine, 1025 National Dex, authentic battle formulas", "10 chiptune tracks, 5 languages, PeerJS multiplayer", "Website + Vercel deploy"],
  },
];

export default function ChangelogPage() {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  return (
    <div className="min-h-screen bg-ink">
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-24">
        <h1 className="text-center text-3xl font-black text-emerald-300">📜 Changelog</h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          <a className="underline-offset-2 hover:underline" href="https://github.com/appleweiping/pokeverse/releases" target="_blank" rel="noreferrer">
            GitHub Releases →
          </a>
        </p>
        <div className="mt-8 flex flex-col gap-5">
          {RELEASES.map((r) => (
            <div key={r.v} className="rounded-2xl border border-white/10 bg-panel p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-black text-amber-300">{r.v}</h2>
                <span className="text-xs text-slate-500">{r.date}</span>
              </div>
              <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-slate-300">
                {(zh ? r.zh : r.en).map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
