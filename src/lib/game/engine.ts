import type { Dir } from "../types";
import { getMap, tileAt, type CompiledMap, type NpcDef, type TrainerDef } from "./maps";
import { T, TILE, SOLID, ENCOUNTER_TILES, drawTile, getCharSprite } from "./tiles";
import { useGame } from "./state";
import { audio } from "../audio/tracks";
import { tr, currentLocale } from "../i18n";
import { getSpecies, localName, spriteIcon } from "../data/dex";
import { createMon, healMon } from "./factory";
import { MART_STOCK } from "./items";

const WALK_MS = 190;
const RUN_MS = 120;
const VIEW_W = 320; // logical pixels (20 tiles)
const VIEW_H = 240; // 15 tiles

const DIRV: Record<Dir, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const DIRN: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 };

interface NpcState {
  def: NpcDef;
  x: number;
  y: number;
  dir: Dir;
  faceTimer: number;
}

/** Wait until the battle/dialog flow returns control to the overworld. */
function waitForOverworld(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const st = useGame.getState();
      return st.phase === "overworld" && !st.dialogue && !st.choice && !st.evolution;
    };
    if (check()) { resolve(); return; }
    const unsub = useGame.subscribe(() => {
      if (check()) { unsub(); resolve(); }
    });
  });
}

export class Overworld {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private destroyed = false;

  map!: CompiledMap;
  // tile position + pixel position (for tweening)
  tx = 0; ty = 0;
  px = 0; py = 0;
  dir: Dir = "down";
  private moving = false;
  private moveFrom: [number, number] = [0, 0];
  private moveT = 0;
  private running = false;
  private walkFrame = 0;

  private keys = new Set<string>();
  private virtualDir: Dir | null = null;

  private clock = 0;
  private banner: { text: string; t: number } | null = null;
  private fade = 0; // 0 transparent, 1 black
  private fadeTarget = 0;
  private busy = false;

  private npcs: NpcState[] = [];
  private followerHist: [number, number][] = [];
  private iconCache = new Map<number, HTMLImageElement>();

  private onKeyDown = (e: KeyboardEvent) => {
    const st = useGame.getState();
    if (st.phase !== "overworld") return;
    const uiOpen = !!st.dialogue || !!st.choice || st.menuOpen || !!st.evolution || !!st.submenu;
    if (uiOpen) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(k)) {
      e.preventDefault();
    }
    this.keys.add(k);
    if (k === "z" || k === " ") this.interact();
    if (k === "enter" || k === "escape") {
      audio.sfx("select");
      st.setMenu(true);
    }
    if (k === "shift" || k === "x") this.running = true;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === "shift" || k === "x") this.running = false;
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    const save = useGame.getState().save;
    const mapId = save?.mapId ?? "player-home";
    this.loadMap(mapId, save?.x ?? 4, save?.y ?? 4, save?.dir ?? "down", true);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    // restore overworld music whenever a battle/menu flow ends
    this.unsubMusic = useGame.subscribe((st, prev) => {
      if (st.phase === "overworld" && prev.phase === "battle") {
        audio.playMusic(this.map.music);
      }
    });
  }
  private unsubMusic: () => void = () => {};

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.unsubMusic();
  }

  /** Advance one frame manually (debug/E2E in throttled background tabs). */
  debugFrame(dt = 16) {
    this.update(dt);
    this.render();
  }

  // ----------------------------------------------------------------- input (touch)
  setVirtualDir(d: Dir | null) { this.virtualDir = d; }
  virtualA() {
    const st = useGame.getState();
    if (st.phase === "overworld" && !st.dialogue && !st.choice && !st.menuOpen && !st.submenu && !st.evolution) {
      this.interact();
    }
  }
  setRunning(r: boolean) { this.running = r; }

  // ----------------------------------------------------------------- map
  loadMap(id: string, x: number, y: number, dir: Dir, instant = false) {
    this.map = getMap(id);
    this.tx = x; this.ty = y;
    this.px = x * TILE; this.py = y * TILE;
    this.dir = dir;
    this.moving = false;
    this.followerHist = [[x, y], [x, y]];
    this.npcs = this.map.npcs
      .filter((n) => this.npcVisible(n))
      .map((n) => ({ def: n, x: n.x, y: n.y, dir: n.dir, faceTimer: 1500 + Math.random() * 2500 }));
    const save = useGame.getState().save;
    if (save) {
      save.mapId = id; save.x = x; save.y = y; save.dir = dir;
    }
    this.banner = { text: tr(this.map.nameKey), t: 2600 };
    audio.playMusic(this.map.music);
    if (!instant) useGame.getState().persist(); // autosave on map change
  }

  private npcVisible(n: NpcDef): boolean {
    const f = useGame.getState();
    if (n.ifFlag && !f.flag(n.ifFlag)) return false;
    if (n.ifNotFlag && f.flag(n.ifNotFlag)) return false;
    return true;
  }

  private async warp(to: string, x: number, y: number, dir: Dir) {
    this.busy = true;
    audio.sfx("door");
    this.fadeTarget = 1;
    await this.waitFade();
    this.loadMap(to, x, y, dir);
    this.fadeTarget = 0;
    await this.waitFade();
    this.busy = false;
    void this.runMapTriggers();
  }

  private waitFade(): Promise<void> {
    return new Promise((r) => {
      const tick = () => {
        if (Math.abs(this.fade - this.fadeTarget) < 0.02 || this.destroyed) r();
        else setTimeout(tick, 30);
      };
      tick();
    });
  }

  // ----------------------------------------------------------------- loop
  private loop = (t: number) => {
    if (this.destroyed) return;
    const dt = Math.min(50, t - this.last);
    this.last = t;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private inputDir(): Dir | null {
    if (this.virtualDir) return this.virtualDir;
    if (this.keys.has("arrowup") || this.keys.has("w")) return "up";
    if (this.keys.has("arrowdown") || this.keys.has("s")) return "down";
    if (this.keys.has("arrowleft") || this.keys.has("a")) return "left";
    if (this.keys.has("arrowright") || this.keys.has("d")) return "right";
    return null;
  }

  private uiBlocked(): boolean {
    const st = useGame.getState();
    return st.phase !== "overworld" || !!st.dialogue || !!st.choice || st.menuOpen || !!st.submenu || !!st.evolution || this.busy;
  }

  private update(dt: number) {
    this.clock += dt;
    // fade tween
    const fd = dt / 260;
    if (this.fade < this.fadeTarget) this.fade = Math.min(this.fadeTarget, this.fade + fd);
    else if (this.fade > this.fadeTarget) this.fade = Math.max(this.fadeTarget, this.fade - fd);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    // npc idle facing
    for (const n of this.npcs) {
      if (n.def.trainer || n.def.script) continue;
      n.faceTimer -= dt;
      if (n.faceTimer <= 0) {
        const dirs: Dir[] = ["up", "down", "left", "right"];
        n.dir = dirs[Math.floor(Math.random() * 4)];
        n.faceTimer = 1500 + Math.random() * 3000;
      }
    }

    if (this.moving) {
      const speed = this.running ? RUN_MS : WALK_MS;
      this.moveT += dt / speed;
      if (this.moveT >= 1) {
        this.moving = false;
        this.px = this.tx * TILE;
        this.py = this.ty * TILE;
        void this.arrived();
      } else {
        const [fx, fy] = this.moveFrom;
        this.px = (fx + (this.tx - fx) * this.moveT) * TILE;
        this.py = (fy + (this.ty - fy) * this.moveT) * TILE;
        this.walkFrame = Math.floor(this.moveT * 2 + (this.tx + this.ty)) % 2;
      }
      return;
    }

    if (this.uiBlocked()) return;
    const d = this.inputDir();
    if (!d) return;
    if (d !== this.dir) {
      this.dir = d; // turn first; movement continues if key held next frames
    }
    const [dx, dy] = DIRV[d];
    const nx = this.tx + dx;
    const ny = this.ty + dy;
    const tile = tileAt(this.map, nx, ny);
    // ledges: jump down only
    if (tile === T.LEDGE) {
      if (d === "down" && this.passable(nx, ny + 1, true)) {
        this.startMove(nx, ny + 1);
        return;
      }
      audio.sfx("bump");
      return;
    }
    if (!this.passable(nx, ny)) return;
    this.startMove(nx, ny);
  }

  private startMove(nx: number, ny: number) {
    this.followerHist.unshift([this.tx, this.ty]);
    this.followerHist.length = Math.min(this.followerHist.length, 4);
    this.moveFrom = [this.tx, this.ty];
    this.tx = nx; this.ty = ny;
    this.moveT = 0;
    this.moving = true;
  }

  private passable(x: number, y: number, ignoreLedge = false): boolean {
    const tile = tileAt(this.map, x, y);
    if (tile === T.LEDGE && !ignoreLedge) return false;
    if (tile === T.DOOR) {
      // doors are enterable only when a warp exists
      return this.map.warps.some((w) => w.x === x && w.y === y);
    }
    if (SOLID.has(tile)) return false;
    if (this.npcs.some((n) => n.x === x && n.y === y)) return false;
    return true;
  }

  private async arrived() {
    const g = useGame.getState();
    const save = g.save;
    if (save) { save.x = this.tx; save.y = this.ty; save.dir = this.dir; }

    // warp?
    const w = this.map.warps.find((w) => w.x === this.tx && w.y === this.ty);
    if (w) {
      await this.warp(w.to, w.tx, w.ty, w.dir ?? this.dir);
      return;
    }
    // leaving town with no Pokémon
    if (this.map.id === "sprout-town" && this.ty <= 1 && (!save || save.party.length === 0)) {
      this.busy = true;
      this.startMove(this.tx, this.ty + 1);
      await g.showDialogue([tr("game.field.no_pokemon")]);
      this.busy = false;
      return;
    }
    // wild encounter
    const tile = tileAt(this.map, this.tx, this.ty);
    if (ENCOUNTER_TILES.has(tile) && this.map.encounters && save && save.party.some((m) => m.curHP > 0)) {
      if (Math.random() < this.map.encounters.rate) {
        const { table } = this.map.encounters;
        const total = table.reduce((a, e) => a + e[1], 0);
        let roll = Math.random() * total;
        let pick = table[0];
        for (const e of table) { roll -= e[1]; if (roll <= 0) { pick = e; break; } }
        const level = pick[2] + Math.floor(Math.random() * (pick[3] - pick[2] + 1));
        this.busy = true;
        await g.startWildBattle(pick[0], level);
        await waitForOverworld();
        this.busy = false;
      }
    }
    void this.runMapTriggers();
  }

  /** Scripted one-time events per map. */
  private async runMapTriggers() {
    const g = useGame.getState();
    const save = g.save;
    if (!save || this.busy) return;
    // Rival ambush on Route 1
    if (this.map.id === "route-1" && g.flag("starter") && !g.flag("rival1")) {
      this.busy = true;
      g.setFlag("rival1", 1);
      audio.sfx("encounter");
      await g.showDialogue([tr("story.rival1"), tr("story.rival2")]);
      const starter = Number(g.flag("starter"));
      const counter = starter === 1 ? 4 : starter === 4 ? 7 : 1;
      const def: TrainerDef = {
        id: "rival1", nameKey: "story.rival2", preKey: "story.rival2",
        loseKey: "story.rival_lose",
        team: [{ speciesId: counter, level: 5 }], prize: 300,
      };
      await g.startTrainerBattle(def);
      await waitForOverworld();
      const won = !!g.flag("tr:rival1");
      await g.showDialogue([tr(won ? "story.rival_lose" : "story.rival_win"), tr("story.rival_after")]);
      this.busy = false;
    }
  }

  // ----------------------------------------------------------------- interact
  private facing(): [number, number] {
    const [dx, dy] = DIRV[this.dir];
    return [this.tx + dx, this.ty + dy];
  }

  async interact() {
    if (this.uiBlocked() || this.moving) return;
    const g = useGame.getState();
    let [fx, fy] = this.facing();
    let npc = this.npcs.find((n) => n.x === fx && n.y === fy);
    const tile = tileAt(this.map, fx, fy);

    // talk across counters
    if (!npc && tile === T.COUNTER) {
      const [dx, dy] = DIRV[this.dir];
      npc = this.npcs.find((n) => n.x === fx + dx && n.y === fy + dy);
    }

    if (npc) {
      npc.dir = ({ up: "down", down: "up", left: "right", right: "left" } as const)[this.dir];
      await this.talkTo(npc);
      return;
    }

    // signs
    const sign = this.map.signs.find((s) => s.x === fx && s.y === fy);
    if (sign) {
      audio.sfx("select");
      this.busy = true;
      await g.showDialogue([tr("game.field.sign") + " " + tr(sign.textKey)]);
      this.busy = false;
      return;
    }
    // ground items
    const item = this.map.items.find((i) => i.x === fx && i.y === fy && !g.flag(i.flag));
    if (item) {
      g.setFlag(item.flag, 1);
      g.giveItem(item.item, item.qty);
      audio.sfx("catch");
      this.busy = true;
      await g.showDialogue([tr("game.field.bag_item", { item: tr(`items.${item.item}.n`), n: item.qty })]);
      this.busy = false;
      g.persist();
      return;
    }
    // furniture
    if (tile === T.PC) {
      audio.sfx("select");
      g.setSubmenu("box");
      return;
    }
    if (tile === T.BED) {
      this.busy = true;
      audio.sfx("heal");
      await g.healParty();
      await g.showDialogue([tr("story.mom_heal")]);
      this.busy = false;
      return;
    }
    if (tile === T.DOOR && !this.map.warps.some((w) => w.x === fx && w.y === fy)) {
      this.busy = true;
      await g.showDialogue([tr("game.field.door_locked")]);
      this.busy = false;
      return;
    }
    if (tile === T.WATER) {
      this.busy = true;
      await g.showDialogue([tr("game.field.cant_swim")]);
      this.busy = false;
      return;
    }
  }

  private async talkTo(npc: NpcState) {
    const g = useGame.getState();
    const d = npc.def;
    this.busy = true;
    audio.sfx("select");

    if (d.trainer && !g.flag("tr:" + d.trainer.id)) {
      await g.showDialogue([tr(d.trainer.preKey)]);
      await g.startTrainerBattle(d.trainer);
      await waitForOverworld();
      if (g.flag("tr:" + d.trainer.id)) {
        const lines = [tr(d.trainer.loseKey)];
        if (d.trainer.badge === "boulder") {
          lines.push(tr("story.gym1_badge"), tr("story.gym1_after"));
        }
        await g.showDialogue(lines);
      }
      this.busy = false;
      return;
    }
    if (d.trainer) {
      await g.showDialogue([tr(d.trainer.badge ? "story.gym1_after" : "story.trainer_lose_generic")]);
      this.busy = false;
      return;
    }

    switch (d.script) {
      case "professor": await this.scriptProfessor(); break;
      case "nurse": await this.scriptNurse(); break;
      case "mart": {
        await g.showDialogue([tr("game.field.mart_welcome")]);
        g.setSubmenu("shop");
        break;
      }
      case "mom": await this.scriptMom(); break;
      default:
        if (d.dialogKeys?.length) {
          await g.showDialogue(d.dialogKeys.map((k) => tr(k)));
        }
    }
    this.busy = false;
  }

  private async scriptProfessor() {
    const g = useGame.getState();
    if (g.flag("starter")) {
      await g.showDialogue([tr("story.prof_dex")]);
      return;
    }
    await g.showDialogue([tr("story.prof1"), tr("story.prof2"), tr("story.prof3"), tr("story.prof4")]);
    const ids = [1, 4, 7];
    const names: Record<number, string> = {};
    for (const id of ids) {
      const sp = await getSpecies(id);
      names[id] = localName(sp.n, currentLocale());
    }
    const descKey: Record<number, string> = { 1: "story.starter_grass", 4: "story.starter_fire", 7: "story.starter_water" };
    let chosen: number | null = null;
    while (chosen === null) {
      const pick = await g.askChoice(tr("story.prof4"), ids.map((id) => ({ label: names[id], value: String(id) })));
      if (pick === null) continue;
      const id = Number(pick);
      await g.showDialogue([tr(descKey[id])]);
      const ok = await g.askChoice(tr("story.starter_confirm", { name: names[id] }), [
        { label: tr("game.field.yes"), value: "y" },
        { label: tr("game.field.no"), value: "n" },
      ]);
      if (ok === "y") chosen = id;
    }
    const save = g.save!;
    const mon = await createMon(chosen, 5, save.playerName);
    save.party.push(mon);
    g.markCaught(chosen);
    g.setFlag("starter", chosen);
    audio.sfx("catch");
    await g.showDialogue([
      tr("story.starter_got", { name: names[chosen] }),
      tr("story.prof_dex"),
      tr("story.prof_balls"),
    ]);
    g.giveItem("poke-ball", 5);
    audio.sfx("levelup");
    g.persist();
  }

  private async scriptNurse() {
    const g = useGame.getState();
    const yes = await g.askChoice(tr("game.field.heal_prompt"), [
      { label: tr("game.field.yes"), value: "y" },
      { label: tr("game.field.no"), value: "n" },
    ]);
    if (yes !== "y") return;
    await g.showDialogue([tr("game.field.heal_doing")]);
    audio.sfx("heal");
    await g.healParty();
    const save = g.save!;
    save.flags.lastHealMapId = this.map.id;
    save.flags.lastHealX = this.tx;
    save.flags.lastHealY = this.ty;
    g.persist();
    await g.showDialogue([tr("game.field.heal_done")]);
  }

  private async scriptMom() {
    const g = useGame.getState();
    if (!g.flag("starter")) {
      await g.showDialogue([tr("story.mom1")]);
      return;
    }
    await g.showDialogue([tr("story.mom2")]);
    audio.sfx("heal");
    await g.healParty();
    await g.showDialogue([tr("story.mom_heal")]);
  }

  // ----------------------------------------------------------------- render
  private render() {
    const cv = this.canvas;
    const ctx = this.ctx;
    const w = cv.width;
    const h = cv.height;
    if (w === 0 || h === 0) return;
    const zoom = Math.max(2, Math.min(6, Math.floor(Math.min(w / VIEW_W, h / VIEW_H))));
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#10131c";
    ctx.fillRect(0, 0, w, h);

    const viewW = w / zoom;
    const viewH = h / zoom;
    let camX = this.px + TILE / 2 - viewW / 2;
    let camY = this.py + TILE / 2 - viewH / 2;
    camX = Math.max(0, Math.min(this.map.w * TILE - viewW, camX));
    camY = Math.max(0, Math.min(this.map.h * TILE - viewH, camY));
    if (this.map.w * TILE < viewW) camX = (this.map.w * TILE - viewW) / 2;
    if (this.map.h * TILE < viewH) camY = (this.map.h * TILE - viewH) / 2;
    camX = Math.round(camX * zoom) / zoom;
    camY = Math.round(camY * zoom) / zoom;

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    const frame: 0 | 1 = Math.floor(this.clock / 500) % 2 === 0 ? 0 : 1;
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(this.map.w - 1, Math.ceil((camX + viewW) / TILE));
    const y1 = Math.min(this.map.h - 1, Math.ceil((camY + viewH) / TILE));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        drawTile(ctx, tileAt(this.map, x, y), frame, x * TILE, y * TILE);
      }
    }

    // ground items (visible pokéballs)
    const g = useGame.getState();
    for (const it of this.map.items) {
      if (g.flag(it.flag)) continue;
      const ix = it.x * TILE, iy = it.y * TILE;
      ctx.fillStyle = "#e3350d";
      ctx.fillRect(ix + 4, iy + 6, 8, 4);
      ctx.fillStyle = "#f8f8f8";
      ctx.fillRect(ix + 4, iy + 10, 8, 3);
      ctx.fillStyle = "#222";
      ctx.fillRect(ix + 4, iy + 9, 8, 1);
      ctx.fillRect(ix + 7, iy + 8, 2, 3);
    }

    // entities sorted by y so lower ones draw in front
    interface Drawable { y: number; draw: () => void }
    const drawables: Drawable[] = [];

    for (const n of this.npcs) {
      drawables.push({
        y: n.y * TILE,
        draw: () => {
          ctx.drawImage(getCharSprite(n.def.palette, DIRN[n.dir], 0), n.x * TILE, n.y * TILE - 2);
        },
      });
    }

    // follower pokemon (lead party mon)
    const lead = g.save?.party.find((m) => m.curHP > 0) ?? g.save?.party[0];
    if (lead && this.followerHist.length > 1) {
      const [hx, hy] = this.followerHist[1];
      const img = this.icon(lead.speciesId);
      if (img?.complete && img.naturalWidth > 0) {
        drawables.push({
          y: hy * TILE - 1,
          draw: () => {
            const bob = Math.floor(this.clock / 300) % 2;
            ctx.drawImage(img, hx * TILE - 7, hy * TILE - 14 + bob, 30, 30);
          },
        });
      }
    }

    drawables.push({
      y: this.py,
      draw: () => {
        const f = this.moving ? this.walkFrame : 0;
        ctx.drawImage(getCharSprite("hero", DIRN[this.dir], f), this.px, this.py - 2);
      },
    });

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    ctx.restore();

    // day/night tint by real time
    const hour = new Date().getHours();
    if (!this.map.indoor) {
      if (hour >= 20 || hour < 5) {
        ctx.fillStyle = "rgba(20,30,80,0.32)";
        ctx.fillRect(0, 0, w, h);
      } else if (hour >= 18 || hour < 7) {
        ctx.fillStyle = "rgba(255,140,60,0.12)";
        ctx.fillRect(0, 0, w, h);
      }
    }

    // location banner
    if (this.banner) {
      const a = Math.min(1, this.banner.t / 400, (2600 - this.banner.t) / 300);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "#10131c";
      ctx.fillRect(12, 12, 8 + this.banner.text.length * 13, 30);
      ctx.fillStyle = "#ffcb05";
      ctx.fillRect(12, 12, 4, 30);
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(this.banner.text, 24, 27);
      ctx.globalAlpha = 1;
    }

    // fade overlay
    if (this.fade > 0.01) {
      ctx.fillStyle = `rgba(8,10,16,${this.fade})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private icon(speciesId: number): HTMLImageElement | null {
    let img = this.iconCache.get(speciesId) ?? null;
    if (!img && typeof window !== "undefined") {
      img = new Image();
      img.src = spriteIcon(speciesId);
      this.iconCache.set(speciesId, img);
    }
    return img;
  }
}
