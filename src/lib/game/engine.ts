import type { Dir, Mon, Weather } from "../types";
import { getMap, tileAt, type CompiledMap, type NpcDef, type TrainerDef } from "./maps";
import { T, TILE, SOLID, ENCOUNTER_TILES, drawTile, getCharSprite } from "./tiles";
import { useGame } from "./state";
import { audio } from "../audio/tracks";
import { tr, currentLocale } from "../i18n";
import { getSpecies, localName, spriteIcon } from "../data/dex";
import { createMon, healMon, maxHPOf } from "./factory";
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
      // battleResolving covers endBattle's async tail (replay save, learn/evolution
      // flows) — without it a script's dialogue can be clobbered by runLearnFlow's
      return st.phase === "overworld" && !st.battleResolving && !st.dialogue && !st.choice && !st.evolution;
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

  /** Teleport to the last heal point after a battle loss (set by endBattle). */
  private async doRespawn(rs: { mapId: string; x: number; y: number; moneyLost: number }) {
    this.busy = true;
    this.fadeTarget = 1;
    await this.waitFade();
    this.loadMap(rs.mapId, rs.x, rs.y, "down");
    this.fadeTarget = 0;
    await this.waitFade();
    const g = useGame.getState();
    await g.showDialogue([
      rs.moneyLost > 0
        ? tr("game.field.respawned_money", { n: rs.moneyLost })
        : tr("game.field.respawned"),
    ]);
    this.busy = false;
  }

  /** Map ambient weather → battle weather ("snow" falls as hail in battle). */
  private battleWeather(): Weather | undefined {
    const w = this.map.weather;
    if (!w) return undefined;
    return w === "snow" ? "hail" : w;
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
    // battle-loss respawn request from the store (wait for all UI to settle first)
    if (!this.moving && !this.uiBlocked()) {
      const rs = useGame.getState().respawn;
      if (rs) {
        useGame.setState({ respawn: null });
        void this.doRespawn(rs);
      }
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
    // Surf: water becomes passable once the player can use Surf
    if (tile === T.WATER) return this.canField(57, "tidal");
    // electric barriers drop when the map's switch flag is on
    if (tile === T.BARRIER) return useGame.getState().flag("sw:" + this.map.id) > 0;
    if (SOLID.has(tile)) return false;
    if (this.npcs.some((n) => n.x === x && n.y === y)) return false;
    return true;
  }

  /** Whether the party can use a field move now (knows the move + has the badge). */
  private canField(moveId: number, badge: string): boolean {
    const save = useGame.getState().save;
    if (!save) return false;
    if (badge && !save.badges.includes(badge)) return false;
    return save.party.some((m) => m.moves.some((mv) => mv.id === moveId));
  }

  private async arrived() {
    const g = useGame.getState();
    const save = g.save;
    if (save) { save.x = this.tx; save.y = this.ty; save.dir = this.dir; }

    // warp?
    const w = this.map.warps.find((w) => w.x === this.tx && w.y === this.ty);
    if (w) {
      // "badges:N" pseudo-flag gates on badge count
      const badgeGate = w.ifFlag?.match(/^badges:(\d+)$/);
      const blocked = w.ifFlag
        ? badgeGate
          ? (g.save?.badges.length ?? 0) < Number(badgeGate[1])
          : !g.flag(w.ifFlag)
        : false;
      if (blocked) {
        this.busy = true;
        await g.showDialogue([tr(w.lockedKey ?? "game.field.door_locked")]);
        this.busy = false;
      } else {
        await this.warp(w.to, w.tx, w.ty, w.dir ?? this.dir);
        return;
      }
    }
    // floor switch: toggle this map's barriers
    if (tileAt(this.map, this.tx, this.ty) === T.SWITCH) {
      const key = "sw:" + this.map.id;
      g.setFlag(key, g.flag(key) ? 0 : 1);
      audio.sfx(g.flag(key) ? "stat_down" : "stat_up");
    }
    // leaving town with no Pokémon
    if (this.map.id === "sprout-town" && this.ty <= 1 && (!save || save.party.length === 0)) {
      this.busy = true;
      this.startMove(this.tx, this.ty + 1);
      await g.showDialogue([tr("game.field.no_pokemon")]);
      this.busy = false;
      return;
    }
    // ice: slide onward in the facing direction until hitting something
    const standing = tileAt(this.map, this.tx, this.ty);
    if (standing === T.ICE && !this.busy) {
      const [dx, dy] = DIRV[this.dir];
      if (this.passable(this.tx + dx, this.ty + dy)) {
        this.startMove(this.tx + dx, this.ty + dy);
        return;
      }
    }

    // day-care progress + party egg hatching (one tick per tile stepped)
    if (save) await this.stepBreeding();

    // wild encounter (tall grass, or open water while surfing)
    const tile = tileAt(this.map, this.tx, this.ty);
    if ((ENCOUNTER_TILES.has(tile) || tile === T.WATER) && this.map.encounters && save && save.party.some((m) => !m.egg && m.curHP > 0)) {
      if (Math.random() < this.map.encounters.rate) {
        const { table } = this.map.encounters;
        const total = table.reduce((a, e) => a + e[1], 0);
        let roll = Math.random() * total;
        let pick = table[0];
        for (const e of table) { roll -= e[1]; if (roll <= 0) { pick = e; break; } }
        const level = pick[2] + Math.floor(Math.random() * (pick[3] - pick[2] + 1));
        this.busy = true;
        await g.startWildBattle(pick[0], level, undefined, this.battleWeather());
        await waitForOverworld();
        this.busy = false;
      }
    }
    void this.runMapTriggers();
  }

  /** guards stepBreeding against concurrent ticks (arrived() is fire-and-forget) */
  private breedingTick = false;

  /** Per-step breeding tick: day-care egg production + carried-egg hatching. */
  private async stepBreeding() {
    if (this.breedingTick) return;
    this.breedingTick = true;
    try {
      await this.stepBreedingInner();
    } finally {
      this.breedingTick = false;
    }
  }

  private async stepBreedingInner() {
    const g = useGame.getState();
    const save = g.save;
    if (!save) return;

    // day-care pair: count steps; roll for an egg every 64 steps
    const dc = save.daycare;
    if (dc?.a && dc?.b && !dc.egg) {
      dc.steps++;
      if (dc.steps % 64 === 0) {
        const { compatible } = await import("./breeding");
        const [spA, spB] = await Promise.all([getSpecies(dc.a.speciesId), getSpecies(dc.b.speciesId)]);
        if (compatible(spA, dc.a, spB, dc.b) && Math.random() < 0.5) {
          dc.egg = true;
        }
      }
    }

    // carried eggs tick down and hatch
    for (const mon of save.party) {
      if (!mon.egg) continue;
      mon.egg.steps--;
      if (mon.egg.steps > 0) continue;
      this.busy = true;
      const { hatchEgg } = await import("./breeding");
      await hatchEgg(mon);
      const sp = await getSpecies(mon.speciesId);
      mon.curHP = maxHPOf(mon, sp);
      g.markSeen(mon.speciesId);
      g.markCaught(mon.speciesId);
      audio.sfx("evolve");
      await g.showDialogue([
        tr("game.field.egg_hatching"),
        tr("game.field.egg_hatched", { name: localName(sp.n, currentLocale()) }),
      ]);
      g.bump();
      g.persist();
      void g.checkAchv();
      this.busy = false;
    }
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
      // on a loss the blackout respawn takes over — no victor gloating afterwards
      if (g.flag("tr:rival1")) {
        await g.showDialogue([tr("story.rival_lose"), tr("story.rival_after")]);
      }
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
      if (sign.textKey === "story.legend_spot") {
        // legendary omen — deepens once Team Aurora's plot has unfolded
        const ready = (g.save?.badges.length ?? 0) >= 6 && g.flag("tr:auroraadmin2") && g.flag("tr:auroraadmin3");
        if (ready) {
          await g.showDialogue([tr("story.legend_omen1")]);
          audio.sfx("faint"); // distant roar
          await g.showDialogue([tr("story.legend_omen2")]);
          g.setFlag("legend_omen", 1);
          g.persist();
        } else {
          await g.showDialogue([tr("story.legend_quiet")]);
        }
        this.busy = false;
        return;
      }
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
    if (tile === T.CUT_TREE) {
      this.busy = true;
      if (this.canField(15, "boulder")) {
        await g.showDialogue([tr("game.field.used_cut")]);
        audio.sfx("hit");
        this.setTile(fx, fy, T.GROUND);
      } else {
        await g.showDialogue([tr("game.field.need_cut")]);
      }
      this.busy = false;
      return;
    }
    if (tile === T.ROCK_SMASH) {
      this.busy = true;
      if (this.canField(249, "boulder")) {
        await g.showDialogue([tr("game.field.used_smash")]);
        audio.sfx("hit_super");
        this.setTile(fx, fy, T.PATH);
      } else {
        await g.showDialogue([tr("game.field.need_smash")]);
      }
      this.busy = false;
      return;
    }
    if (tile === T.WATER) {
      this.busy = true;
      const hasRod = (g.save?.bag["old-rod"] ?? 0) > 0;
      if (hasRod && this.map.fishing) {
        const choice = await g.askChoice(tr("game.field.fish_prompt"), [
          { label: tr("game.field.fish_cast"), value: "fish" },
          { label: tr("common.cancel"), value: "no" },
        ]);
        if (choice === "fish") {
          await this.fish();
          this.busy = false;
          return;
        }
      }
      if (this.canField(57, "tidal")) {
        await g.showDialogue([tr("game.field.surf_prompt")]);
      } else {
        await g.showDialogue([tr("game.field.cant_swim")]);
      }
      this.busy = false;
      return;
    }
  }

  /** Old Rod fishing at a water edge. */
  private async fish() {
    const g = useGame.getState();
    const table = this.map.fishing;
    if (!table) return;
    await g.showDialogue([tr("game.field.fish_wait")]);
    if (Math.random() < 0.75) {
      audio.sfx("encounter");
      await g.showDialogue([tr("game.field.fish_bite")]);
      const total = table.table.reduce((a, e) => a + e[1], 0);
      let roll = Math.random() * total;
      let pick = table.table[0];
      for (const e of table.table) { roll -= e[1]; if (roll <= 0) { pick = e; break; } }
      const level = pick[2] + Math.floor(Math.random() * (pick[3] - pick[2] + 1));
      await g.startWildBattle(pick[0], level);
      await waitForOverworld();
    } else {
      audio.sfx("cancel");
      await g.showDialogue([tr("game.field.fish_nothing")]);
    }
  }

  /** Mutate a tile in the active (cached) map — persists for the session. */
  private setTile(x: number, y: number, t: T) {
    this.map.tiles[y * this.map.w + x] = t;
  }

  private async talkTo(npc: NpcState) {
    const g = useGame.getState();
    const d = npc.def;
    this.busy = true;
    audio.sfx("select");

    // badge -> post-victory message key prefix
    const BADGE_GYM: Record<string, string> = {
      boulder: "gym1", tidal: "gym2", volt: "gym3", meadow: "gym4",
      venom: "gym5", mind: "gym6", frost: "gym7", dragon: "gym8",
    };

    if (d.trainer && !g.flag("tr:" + d.trainer.id)) {
      await g.showDialogue([tr(d.trainer.preKey)]);
      await g.startTrainerBattle(d.trainer, this.battleWeather());
      await waitForOverworld();
      if (g.flag("tr:" + d.trainer.id)) {
        const lines = [tr(d.trainer.loseKey)];
        const gym = d.trainer.badge ? BADGE_GYM[d.trainer.badge] : null;
        if (gym) lines.push(tr(`story.${gym}_badge`), tr(`story.${gym}_after`));
        await g.showDialogue(lines);
        // one-time reward item
        if (d.trainer.reward && !g.flag("rw:" + d.trainer.id)) {
          g.setFlag("rw:" + d.trainer.id, 1);
          g.giveItem(d.trainer.reward.item, d.trainer.reward.qty);
          audio.sfx("catch");
          await g.showDialogue([
            tr("game.field.bag_item", { item: tr(`items.${d.trainer.reward.item}.n`), n: d.trainer.reward.qty }),
          ]);
          g.persist();
        }
        // fleeing grunts vanish from the map immediately
        if (d.trainer.vanish) {
          audio.sfx("run");
          this.npcs = this.npcs.filter((n) => n !== npc);
        }
      }
      this.busy = false;
      return;
    }
    if (d.trainer) {
      const gym = d.trainer.badge ? BADGE_GYM[d.trainer.badge] : null;
      await g.showDialogue([tr(gym ? `story.${gym}_after` : "story.trainer_lose_generic")]);
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
      case "rod": {
        if (!g.flag("got_rod")) {
          await g.showDialogue([tr("story.rod_give1"), tr("story.rod_give2")]);
          g.giveItem("old-rod", 1);
          g.setFlag("got_rod", 1);
          audio.sfx("catch");
          await g.showDialogue([tr("game.field.bag_item", { item: tr("items.old-rod.n"), n: 1 })]);
          g.persist();
        } else {
          await g.showDialogue([tr("story.rod_hint")]);
        }
        break;
      }
      case "legend": {
        await this.scriptLegend(npc);
        break;
      }
      case "champion": {
        await this.scriptChampion();
        break;
      }
      case "daycare": {
        await this.scriptDaycare();
        break;
      }
      case "tower": {
        await this.scriptTower();
        break;
      }
      case "bpshop": {
        await this.scriptBpShop();
        break;
      }
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
    void g.checkAchv(); // first-catch unlocks right here, not after the next battle
  }

  /** Day-care: board two Pokémon; compatible pairs produce an egg while you walk. */
  private async scriptDaycare() {
    const g = useGame.getState();
    const save = g.save!;
    save.daycare ??= { a: null, b: null, steps: 0, egg: false };
    const dc = save.daycare;
    const monName = async (m: Mon) => m.nickname ?? localName((await getSpecies(m.speciesId)).n, currentLocale());

    // an egg is waiting
    if (dc.egg && dc.a && dc.b) {
      await g.showDialogue([tr("story.daycare_egg_ready")]);
      const take = await g.askChoice(tr("story.daycare_egg_take"), [
        { label: tr("game.field.yes"), value: "y" },
        { label: tr("game.field.no"), value: "n" },
      ]);
      if (take === "y") {
        if (save.party.length >= 6) {
          await g.showDialogue([tr("story.daycare_party_full")]);
        } else {
          const { makeEgg } = await import("./breeding");
          const egg = await makeEgg(dc.a, dc.b, save.playerName);
          save.party.push(egg);
          dc.egg = false;
          dc.steps = 0;
          audio.sfx("catch");
          await g.showDialogue([tr("story.daycare_egg_got")]);
          g.bump();
          g.persist();
        }
      }
      return;
    }

    await g.showDialogue([tr("story.daycare_welcome")]);
    if (dc.a && dc.b) {
      const { compatible } = await import("./breeding");
      const [spA, spB] = await Promise.all([getSpecies(dc.a.speciesId), getSpecies(dc.b.speciesId)]);
      await g.showDialogue([
        tr("story.daycare_status", { a: await monName(dc.a), b: await monName(dc.b) }),
        tr(compatible(spA, dc.a, spB, dc.b) ? "story.daycare_good" : "story.daycare_meh"),
      ]);
    }

    const opts: { label: string; value: string }[] = [];
    if ((!dc.a || !dc.b) && save.party.filter((m) => !m.egg).length > 1) opts.push({ label: tr("story.daycare_opt_leave"), value: "leave" });
    if (dc.a || dc.b) opts.push({ label: tr("story.daycare_opt_take"), value: "take" });
    opts.push({ label: tr("story.daycare_opt_bye"), value: "bye" });
    const action = await g.askChoice(tr("story.daycare_prompt"), opts);

    if (action === "leave") {
      const eligible = save.party.filter((m) => !m.egg);
      // must keep at least one healthy non-egg in the party
      const pickable = eligible.filter((m) => eligible.some((o) => o !== m && o.curHP > 0));
      const names: { label: string; value: string }[] = [];
      for (const m of pickable) names.push({ label: `${await monName(m)} Lv.${m.level}`, value: m.uid });
      names.push({ label: tr("game.bag.give_up"), value: "skip" });
      const pick = await g.askChoice(tr("story.daycare_which"), names);
      if (pick && pick !== "skip") {
        const idx = save.party.findIndex((m) => m.uid === pick);
        const [mon] = save.party.splice(idx, 1);
        if (!dc.a) dc.a = mon; else dc.b = mon;
        dc.steps = 0;
        await g.showDialogue([tr("story.daycare_left", { name: await monName(mon) })]);
        g.bump();
        g.persist();
      }
    } else if (action === "take") {
      const boarded = [dc.a, dc.b].filter((m): m is Mon => !!m);
      const names: { label: string; value: string }[] = [];
      for (const m of boarded) names.push({ label: `${await monName(m)} Lv.${m.level}`, value: m.uid });
      names.push({ label: tr("game.bag.give_up"), value: "skip" });
      const pick = await g.askChoice(tr("story.daycare_which"), names);
      if (pick && pick !== "skip") {
        if (save.party.length >= 6) {
          await g.showDialogue([tr("story.daycare_party_full")]);
        } else {
          let mon: Mon;
          if (dc.a?.uid === pick) { mon = dc.a; dc.a = null; }
          else { mon = dc.b!; dc.b = null; }
          dc.egg = false;
          // boarded Pokémon come back rested
          healMon(mon, await getSpecies(mon.speciesId));
          save.party.push(mon);
          await g.showDialogue([tr("story.daycare_taken", { name: await monName(mon) })]);
          g.bump();
          g.persist();
        }
      }
    }
  }

  /** Battle Tower: 7-round streak, scaled opponents, BP rewards. */
  private async scriptTower() {
    const g = useGame.getState();
    const save = g.save!;
    save.stats ??= {};
    const able = save.party.filter((m) => !m.egg);
    if (able.length === 0) {
      await g.showDialogue([tr("story.tower_need_party")]);
      return;
    }
    await g.showDialogue([tr("story.tower_welcome", { bp: save.stats.bp ?? 0, best: save.stats.towerBest ?? 0 })]);
    const go = await g.askChoice(tr("story.tower_prompt"), [
      { label: tr("game.field.yes"), value: "y" },
      { label: tr("game.field.no"), value: "n" },
    ]);
    if (go !== "y") return;

    // strong, varied opponent pool; levels track the player's strongest mon
    const POOL = [3, 6, 9, 59, 65, 68, 94, 103, 112, 121, 130, 131, 134, 135, 136, 142, 143, 149];
    const baseLv = Math.max(30, Math.min(70, Math.max(...able.map((m) => m.level))));
    let wins = 0;

    for (let round = 1; round <= 7; round++) {
      await g.healParty();
      await g.showDialogue([tr("story.tower_round", { n: round })]);
      const team: { speciesId: number; level: number }[] = [];
      const used = new Set<number>();
      while (team.length < 3) {
        const sp = POOL[Math.floor(Math.random() * POOL.length)];
        if (used.has(sp)) continue;
        used.add(sp);
        team.push({ speciesId: sp, level: baseLv + Math.floor(round / 2) });
      }
      const def: TrainerDef = {
        id: "tower", nameKey: "story.tn.tower", preKey: "story.tower_round",
        loseKey: "story.tower_opp_lose", team, prize: 0, theme: "league", noExp: true,
      };
      const winsBefore = save.stats.battlesWon ?? 0;
      const moneyBefore = save.money;
      await g.startTrainerBattle(def);
      await waitForOverworld();
      const won = (useGame.getState().save?.stats?.battlesWon ?? 0) > winsBefore;
      if (!won) {
        // a tower loss ends the streak — no blackout teleport, no money penalty
        useGame.setState({ respawn: null });
        save.money = moneyBefore;
        await g.healParty();
        await g.showDialogue([tr("story.tower_lost", { n: wins })]);
        break;
      }
      wins++;
      save.stats.bp = (save.stats.bp ?? 0) + 2;
      if (wins === 7) {
        save.stats.bp += 10;
        await g.showDialogue([tr("story.tower_clear")]);
      }
    }
    save.stats.towerBest = Math.max(save.stats.towerBest ?? 0, wins);
    await g.healParty();
    await g.showDialogue([tr("story.tower_result", { n: wins, bp: save.stats.bp ?? 0 })]);
    g.persist();
    void g.checkAchv();
  }

  /** BP shop next to the Battle Tower desk. */
  private async scriptBpShop() {
    const g = useGame.getState();
    const save = g.save!;
    save.stats ??= {};
    const STOCK: { item: string; qty: number; bp: number }[] = [
      { item: "ultra-ball", qty: 5, bp: 1 },
      { item: "full-restore", qty: 1, bp: 2 },
      { item: "lum-berry", qty: 1, bp: 2 },
      { item: "sitrus-berry", qty: 1, bp: 2 },
      { item: "fire-stone", qty: 1, bp: 6 },
      { item: "water-stone", qty: 1, bp: 6 },
      { item: "thunder-stone", qty: 1, bp: 6 },
      { item: "leaf-stone", qty: 1, bp: 6 },
      { item: "moon-stone", qty: 1, bp: 6 },
    ];
    for (;;) {
      const bp = save.stats.bp ?? 0;
      const opts = STOCK.map((s, i) => ({
        label: `${tr(`items.${s.item}.n`)}${s.qty > 1 ? `×${s.qty}` : ""} — ${s.bp}BP`,
        value: String(i),
      }));
      opts.push({ label: tr("story.daycare_opt_bye"), value: "bye" });
      const pick = await g.askChoice(tr("story.bpshop_prompt", { bp }), opts);
      if (pick === null || pick === "bye") break;
      const row = STOCK[Number(pick)];
      if ((save.stats.bp ?? 0) < row.bp) {
        await g.showDialogue([tr("story.bpshop_poor")]);
        continue;
      }
      save.stats.bp = (save.stats.bp ?? 0) - row.bp;
      g.giveItem(row.item, row.qty);
      audio.sfx("catch");
      await g.showDialogue([tr("game.field.bag_item", { item: tr(`items.${row.item}.n`), n: row.qty })]);
      g.persist();
    }
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

  /** Suicune — the Aurora Beast. One-shot static encounter at Lv.50. */
  private async scriptLegend(npc: NpcState) {
    const g = useGame.getState();
    await g.showDialogue([tr("story.legend_meet1")]);
    audio.sfx("faint"); // roar
    await g.showDialogue([tr("story.legend_meet2")]);
    await g.startWildBattle(245, 50, "legend");
    await waitForOverworld();
    g.setFlag("legend_done", 1);
    this.npcs = this.npcs.filter((n) => n !== npc);
    if (g.save?.dexCaught.includes(245)) {
      await g.showDialogue([tr("story.legend_caught")]);
    } else {
      await g.showDialogue([tr("story.legend_gone")]);
    }
    g.persist();
    void g.checkAchv();
  }

  /** Champion Blue — his ace counters your starter. Victory enters the Hall of Fame. */
  private async scriptChampion() {
    const g = useGame.getState();
    const save = g.save!;
    if (g.flag("champion_done")) {
      await g.showDialogue([tr("story.champion_after")]);
      return;
    }
    await g.showDialogue([tr("story.champion_pre1"), tr("story.champion_pre2")]);
    const starter = Number(g.flag("starter")) || 1;
    // ace beats your starter: grass->fire(6), fire->water(9), water->grass(3)
    const ace = starter === 1 ? 6 : starter === 4 ? 9 : 3;
    const def: TrainerDef = {
      id: "champion", nameKey: "story.tn.champion", preKey: "story.champion_pre2",
      loseKey: "story.champion_lose",
      team: [
        { speciesId: 18, level: 47 },
        { speciesId: 65, level: 47 },
        { speciesId: 112, level: 47 },
        { speciesId: 59, level: 48 },
        { speciesId: 103, level: 48 },
        { speciesId: ace, level: 50 },
      ],
      prize: 12000, theme: "league",
    };
    await g.startTrainerBattle(def);
    await waitForOverworld();
    if (!g.flag("tr:champion")) return; // lost — try again later
    g.setFlag("champion_done", 1);
    await g.showDialogue([tr("story.champion_lose"), tr("story.champion_hof")]);
    // Hall of Fame registration
    save.hallOfFame = {
      date: Date.now(),
      team: save.party.map((m) => ({ speciesId: m.speciesId, level: m.level })),
    };
    audio.sfx("badge");
    g.persist();
    void g.checkAchv();
    // roll credits
    useGame.setState({ credits: true });
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
    const switched = useGame.getState().flag("sw:" + this.map.id) > 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let t = tileAt(this.map, x, y);
        if (t === T.BARRIER && switched) t = T.BARRIER_OFF;
        if (t === T.SWITCH) {
          // switch state is positional, not animated
          drawTile(ctx, T.SWITCH, switched ? 1 : 0, x * TILE, y * TILE);
          continue;
        }
        drawTile(ctx, t, frame, x * TILE, y * TILE);
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
          // 16×20 sprite anchored to the tile bottom
          ctx.drawImage(getCharSprite(n.def.palette, DIRN[n.dir], 0), n.x * TILE, n.y * TILE - 4);
        },
      });
    }

    // follower pokemon (lead party mon; eggs stay in their carrier)
    const lead = g.save?.party.find((m) => !m.egg && m.curHP > 0) ?? g.save?.party.find((m) => !m.egg);
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

    const onWater = tileAt(this.map, this.tx, this.ty) === T.WATER;
    drawables.push({
      y: this.py,
      draw: () => {
        if (onWater) {
          // surf platform under the trainer
          ctx.fillStyle = "#3a78c0";
          ctx.beginPath();
          ctx.ellipse(this.px + 8, this.py + 14, 9, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#7fb6e8";
          ctx.fillRect(this.px + 1, this.py + 13, 14, 1);
        }
        const f = this.moving ? this.walkFrame : 0;
        ctx.drawImage(getCharSprite("hero", DIRN[this.dir], f), this.px, this.py - 4);
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
      // ambient map weather particles
      if (this.map.weather === "rain") {
        ctx.strokeStyle = "rgba(160,200,255,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 90; i++) {
          const rx = ((i * 131 + 17) % w + this.clock * 0.12 * ((i % 3) + 2)) % w;
          const ry = (i * 233 + this.clock * 0.5 * ((i % 3) + 2)) % h;
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 2, ry + 9);
        }
        ctx.stroke();
      } else if (this.map.weather === "snow") {
        ctx.fillStyle = "rgba(240,248,255,0.8)";
        for (let i = 0; i < 60; i++) {
          const sx = ((i * 173 + 31) % w + Math.sin((this.clock + i * 700) / 900) * 14 + this.clock * 0.02) % w;
          const sy = (i * 311 + this.clock * 0.06 * ((i % 3) + 1)) % h;
          const sz = (i % 3 === 0) ? 2 : 1;
          ctx.fillRect((sx + w) % w, sy, sz, sz);
        }
      } else if (this.map.weather === "sand") {
        ctx.fillStyle = "rgba(220,190,120,0.35)";
        for (let i = 0; i < 70; i++) {
          const sx = (i * 149 + this.clock * 0.35 * ((i % 4) + 2)) % w;
          const sy = ((i * 271 + 13) % h + Math.sin((this.clock + i * 500) / 400) * 6) % h;
          ctx.fillRect(sx, (sy + h) % h, 2, 1);
        }
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
