"use client";
import React from "react";
import { NavBar, Footer } from "@/components/landing/Sections";
import { useI18n } from "@/lib/i18n";

const RELEASES: { v: string; date: string; zh: string[]; en: string[] }[] = [
  {
    v: "v1.3.0", date: "2026-06-12",
    zh: ["道馆复战：通关后八位馆主 Lv.60+ 强化队伍（可重复，+5BP/胜）", "战后新区域「天空之柱」+ 传说二期凤王 Lv.60", "新成就 ×6（塔主/道场之星/超越进化/新生/双传说/王者再临）", "终极 QA：46 图全量 BFS 回归 + 全传送落点零错误"],
    en: ["Gym rematches: all 8 leaders with Lv.60+ teams post-champion (repeatable, +5 BP)", "New post-game area Sky Pillar + second legendary Ho-Oh Lv.60", "6 new achievements (Tower Master, Dojo Star, Beyond Evolution…)", "Final QA: full 46-map BFS regression, zero bad warp landings"],
  },
  {
    v: "v1.2.0", date: "2026-06-12",
    zh: ["Mega 超进化（6 种经典 Mega：妙蛙花/喷火龙Y/水箭龟/耿鬼/暴鲤龙/超梦Y）", "携带 Mega 石 + 战斗中一键变身（每场一次，结束自动复原）", "Mega 形态专属能力值/属性/特性（喷火龙Y自带日照）", "BP 商店上架 6 颗 Mega 石（15BP）", "战斗界面 ◆MEGA 切换按钮 + 变身演出"],
    en: ["Mega Evolution (6 classics: Venusaur, Charizard Y, Blastoise, Gengar, Gyarados, Mewtwo Y)", "Hold a Mega Stone + transform once per battle (auto-reverts after)", "Mega forms get their own stats/types/abilities (Charizard Y brings Drought)", "6 Mega Stones in the BP shop (15 BP)", "◆MEGA toggle in the battle UI with transform sequence"],
  },
  {
    v: "v1.1.0", date: "2026-06-12",
    zh: ["双打对战引擎（2v2、目标选择、范围招式 75% 减伤、波及队友）", "双打道场（三连战、+3BP/胜、通关 +6BP）", "双打专属 UI（双精灵、双血条、逐只指令、濒死换人）", "威吓双打化（同时压制两只对手）", "30 场单打回归零异常"],
    en: ["Double battle engine (2v2, target selection, 75% spread damage, ally-hit moves)", "Battle Dojo (3-round doubles, +3 BP per win, +6 clear bonus)", "Dedicated doubles UI (dual sprites & HP bars, per-mon commands, KO replacements)", "Intimidate now hits both foes in doubles", "30-battle singles regression, zero errors"],
  },
  {
    v: "v1.0.0", date: "2026-06-12",
    zh: ["对战塔（7 连胜挑战、对手随你强度成长、设施战零经验）", "BP 点数 + BP 兑换商店（进化石/全复药/树果）", "新特性 +10（耐热/干燥皮肤/拨沙/拨雪/洁净之盐等）", "重大修复：战后脚本竞态（学招对话覆盖导致剧情挂起）", "训练家卡显示 BP 与塔纪录"],
    en: ["Battle Tower (7-win streaks, opponents scale to you, no facility exp)", "Battle Points + BP exchange shop (stones / Full Restores / berries)", "+10 abilities (Heatproof, Dry Skin, Sand Rush, Purifying Salt…)", "Major fix: post-battle script race (learn dialogs could hang story flows)", "Trainer card shows BP & tower record"],
  },
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
