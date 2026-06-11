# PokéVerse · 像素奥德赛 (Pixel Odyssey)

> 一款运行在浏览器里的同人像素宝可梦 RPG —— 全国图鉴 1025 只、正统对战公式、P2P 联机、原创芯片音乐、五种语言。桌面与手机通吃，零下载。

**Fan game disclaimer / 同人声明**：本项目为非商业粉丝自制游戏，与任天堂、Game Freak、Creatures Inc. 及株式会社宝可梦无关。Pokémon 及相关名称的版权归原权利方所有。宝可梦数据来自 [PokeAPI](https://pokeapi.co/)，精灵图与叫声经 jsDelivr CDN 加载；音乐与音效为本项目原创合成，地图、剧情、像素瓦片均为程序化原创。

## ✨ 特性

| | |
|---|---|
| 🌍 像素开放世界 | 程序化瓦片引擎（零图片资源）、网格移动、碰撞、传送、草丛遇敌、昼夜色调、跟随宝可梦 |
| 📕 全国图鉴 1025 | 九个世代全收录：多语言名称、种族值、属性、进化链、升级技能表、图鉴描述、叫声播放 |
| ⚔️ 正统战斗 | 18 属性克制、物理/特殊、性格 25 种、个体值、状态异常（麻/烧/毒/眠/冻/混乱）、能力等级、暴击、吸血/反伤/多段，捕捉摇晃公式、六种经验曲线、升级学招、进化 |
| 🧑‍🤝‍🧑 剧情主线 | 奥罗拉地区：选御三家、劲敌战、道馆挑战（磐石徽章）、训练家对战、商店/宝可梦中心/电脑盒子 |
| 🌐 联机 | PeerJS (WebRTC) 点对点：房间码匹配、实时对战（共享种子确定性模拟）、宝可梦交换 |
| 🎵 原创音乐 | Web Audio 四通道芯片音源（双方波+三角波+噪声），10 首原创曲目 + 24 种合成音效 |
| 🗺 五种语言 | 简中 / 繁中 / English / 日本語 / 한국어 实时切换，宝可梦名同步本地化 |
| 💾 存档 | localStorage 自动+手动存档，base64 导出/导入跨设备迁移 |
| 📱 全平台 | 桌面键盘（方向键+Z/X/Enter），手机虚拟十字键+AB 键，响应式整数像素缩放 |

## 🚀 快速开始

```bash
npm install
npm run dev        # http://localhost:3000
```

- `/` —— 官网落地页（含开场动画）
- `/play` —— 游戏本体
- `/pokedex` —— 全国图鉴浏览器
- `/battle` —— 联机大厅

### 重新烘焙图鉴数据（可选）

`public/data/` 已包含烘焙好的全部数据。如需更新：

```bash
npm run dex   # 从 PokeAPI 抓取（自动 fallback 到 jsDelivr 镜像）
```

## ☁️ 部署到 Vercel

```bash
npm i -g vercel
vercel        # 按提示登录并部署；零配置，Next.js 自动识别
vercel --prod
```

或在 [vercel.com](https://vercel.com) 导入此目录所在的 Git 仓库即可，无需任何环境变量。

## 🎮 操作

| 动作 | 桌面 | 手机 |
|---|---|---|
| 移动 | 方向键 / WASD | 虚拟十字键 |
| 确认 / 交互 | Z / 空格 / Enter | A 键 |
| 取消 / 跑步 | X / Shift | B 键 |
| 菜单 | Enter / Esc | ☰ MENU |

## 🏗 技术栈

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Zustand · Canvas 2D（自研瓦片引擎）· Web Audio（自研芯片音源）· PeerJS (WebRTC)

数据层：构建期把 PokeAPI 烘焙为静态 JSON（`public/data/`，约 900KB，gzip 后 ~200KB），运行时零外部 API 依赖；精灵图/叫声走 jsDelivr CDN（国内可达）。

## 📁 结构

```
src/
  app/                # 路由：/ /play /pokedex /pokedex/[id] /battle
  components/
    game/             # 游戏 UI：战斗、菜单、对话、标题、虚拟键、进化
    landing/          # 官网：开场动画、各区块
  lib/
    audio/            # 芯片音源引擎 + 原创曲目
    data/             # 类型表、公式（伤害/捕捉/经验/性格）、数据加载
    game/             # 引擎、战斗、地图、瓦片、道具、存档 store
    i18n/             # 五语言字典
    net/              # PeerJS 联机
scripts/build-dex.mjs # 图鉴数据烘焙器
public/data/          # 烘焙数据（dex/moves/learnsets/flavor）
```

详见 [ROADMAP.md](./ROADMAP.md) 了解后续扩充计划。
