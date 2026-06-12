"use client";
import React from "react";
import { NavBar, Footer } from "@/components/landing/Sections";
import { useI18n } from "@/lib/i18n";

const RELEASES: { v: string; date: string; zh: string[]; en: string[] }[] = [
  {
    v: "v0.9.0", date: "2026-06-12",
    zh: ["培育屋与蛋系统（蛋组兼容、IV 遗传、步数孵化）", "地图常驻天气（海路雨/雪原雪，野战自动带天气）", "战败黑屏修复：真正传送回治疗点 + 损失金额提示", "训练家卡新增「当前目标」指引", "真实玩家 UX 实测反馈轮 1 修复 5 项"],
    en: ["Day Care & Eggs (egg groups, IV inheritance, step hatching)", "Ambient map weather (sea rain / snowfield snow, carried into battles)", "Blackout fix: real teleport to heal point + money-loss message", "Trainer card now shows your current objective", "5 fixes from real-player UX testing round 1"],
  },
  {
    v: "v0.8.0", date: "2026-06-12",
    zh: ["联盟终章：四天王连战 + 冠军小蓝战", "冰系道馆（滑冰谜题）+ 龙系道馆 + 胜利之路", "传说宝可梦水君捕捉战（专属 BGM）", "通关制作名单 + 殿堂登录", "全图鉴闪光奖励（512→64）", "新曲 3 首、43 图、五语言 58 条新文本"],
    en: ["League finale: Elite Four gauntlet + Champion Blue", "Ice Gym (sliding puzzle) + Dragon Gym + Victory Road", "Legendary Suicune encounter (unique BGM)", "End credits + Hall of Fame", "Full-dex shiny reward (512→64)", "3 new tracks, 43 maps, 58 new lines ×5 languages"],
  },
  {
    v: "v0.7.0", date: "2026-06-12",
    zh: ["5 号水道冲浪海路 + 水面遇敌", "钓鱼系统（旧钓竿 + 逐图钓鱼表）", "紫晶港毒系道馆 + 星见塔超能道馆（传送谜题）", "极光队二三幕（占塔 + 海上拦截）", "传说前兆剧情链"],
    en: ["Route 5 surf passage + water encounters", "Fishing system (Old Rod + per-map tables)", "Poison Gym at Amethyst Port + Psychic Gym tower (teleport puzzle)", "Team Aurora acts 2 & 3", "Legendary omen story chain"],
  },
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
