import type { DexEntry, MajorStatus, Mon, MoveData, StatStageKey, TypeName, Weather } from "../types";
import { effectiveness } from "../data/typechart";
import { accStageMult, applyEvYield, attemptCapture, expGain, stageMult, statusCatchMult } from "../data/formulas";
import { getMoveMap, getSpecies } from "../data/dex";
import { applyExp, statsOf } from "./factory";
import { ITEMS } from "./items";
import { ABILITIES, type AbilityDef } from "../data/abilities";

// ---------------------------------------------------------------------------
// Battle events — the UI replays these sequentially with animations.
// ---------------------------------------------------------------------------

export type BattleEvent =
  | { t: "msg"; key: string; params?: Record<string, string | number> }
  | { t: "anim"; kind: "attack" | "hit" | "hit_super" | "hit_weak" | "faint" | "ball_throw" | "ball_shake" | "ball_open" | "catch" | "heal" | "stat_up" | "stat_down"; side: Side; mt?: TypeName }
  | { t: "hp"; side: Side; hp: number; maxHp: number }
  | { t: "status"; side: Side; status: MajorStatus | null }
  | { t: "exp"; exp: number; toNext: number; pct: number }
  | { t: "level"; level: number }
  | { t: "switch"; side: Side; view: BattlerPublicView }
  | { t: "weather"; weather: Weather }
  | { t: "ability"; side: Side; ability: string }
  | { t: "end"; result: BattleResult };

export type Side = "player" | "enemy";
export type BattleResult = "win" | "lose" | "run" | "caught";

export interface BattlerPublicView {
  speciesId: number;
  nickname?: string;
  level: number;
  hp: number;
  maxHp: number;
  status: MajorStatus | null;
  shiny: boolean;
}

export type BattleAction =
  | { kind: "move"; index: number }
  | { kind: "switch"; partyIdx: number }
  | { kind: "ball"; itemId: string }
  | { kind: "item"; itemId: string; partyIdx: number }
  | { kind: "run" };

export interface TrainerInfo {
  id: string;
  nameKey: string;
  prize: number;
  badge?: string;
}

const STRUGGLE_ID = 165;

interface Battler {
  mon: Mon;
  species: DexEntry;
  stats: [number, number, number, number, number, number];
  stages: Record<StatStageKey, number>;
  confuse: number;     // turns remaining
  flinched: boolean;
  sleepTurns: number;
  toxicN: number;
  /** enemy PP is tracked here so wild mons don't mutate save data */
  pp: number[];
  ability: AbilityDef | null;
  /** flash-fire activated (1.5× own fire moves) */
  fireBoost: boolean;
  /** held berry consumed flag (one-time) */
  berryUsed: boolean;
  /** Protect/Detect active for the rest of this turn */
  protectedT: boolean;
  /** consecutive Protect uses (success falls off) */
  protectStreak: number;
  /** Substitute HP (0 = none) */
  sub: number;
  /** Bind/Wrap turns remaining */
  trapTurns: number;
  /** Focus Energy active (crit chance 1/2) */
  focused: boolean;
  /** two-turn move being charged (Fly/Dig/Solar Beam) */
  charging: { moveId: number; idx: number } | null;
  /** airborne/underground during Fly/Dig charge turn */
  semiInvuln: boolean;
  /** faint already announced (PvP multi-mon guard) */
  faintAnnounced: boolean;
}

function abilityOf(mon: Mon): AbilityDef | null {
  return mon.ability ? ABILITIES[mon.ability] ?? null : null;
}

function freshStages(): Record<StatStageKey, number> {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}

function viewOf(b: Battler): BattlerPublicView {
  return {
    speciesId: b.mon.speciesId,
    nickname: b.mon.nickname,
    level: b.mon.level,
    hp: b.mon.curHP,
    maxHp: b.stats[0],
    status: b.mon.status,
    shiny: b.mon.shiny,
  };
}

async function makeBattler(mon: Mon): Promise<Battler> {
  const species = await getSpecies(mon.speciesId);
  return {
    mon,
    species,
    stats: statsOf(mon, species),
    stages: freshStages(),
    confuse: 0,
    flinched: false,
    sleepTurns: mon.status === "slp" ? 2 : 0,
    toxicN: 1,
    pp: mon.moves.map((m) => m.pp),
    ability: abilityOf(mon),
    fireBoost: false,
    berryUsed: false,
    protectedT: false,
    protectStreak: 0,
    sub: 0,
    trapTurns: 0,
    focused: false,
    charging: null,
    semiInvuln: false,
    faintAnnounced: false,
  };
}

// ---------------------------------------------------------------------------

export class BattleSession {
  kind: "wild" | "trainer";
  player!: Battler;
  enemy!: Battler;
  party: Mon[];
  enemyParty: Mon[];
  enemyIdx = 0;
  trainer?: TrainerInfo;
  rng: () => number;
  runAttempts = 0;
  over = false;
  result: BattleResult | null = null;
  /** moves the active mon may learn after the battle: [monUid, level, moveId] */
  pendingLearns: { uid: string; moveId: number }[] = [];
  expEarnedBy = new Set<string>();
  weather: Weather = "none";
  weatherTurns = 0;
  /** every event ever emitted — used for battle replays */
  allEvents: BattleEvent[] = [];
  private moveMap!: Map<number, MoveData>;

  private record(ev: BattleEvent[]): BattleEvent[] {
    this.allEvents.push(...ev);
    return ev;
  }

  private constructor(kind: "wild" | "trainer", party: Mon[], enemyParty: Mon[], rng: () => number, trainer?: TrainerInfo) {
    this.kind = kind;
    this.party = party;
    this.enemyParty = enemyParty;
    this.trainer = trainer;
    this.rng = rng;
  }

  static async create(
    kind: "wild" | "trainer",
    party: Mon[],
    enemyParty: Mon[],
    opts: { trainer?: TrainerInfo; rng?: () => number; weather?: Weather } = {}
  ): Promise<BattleSession> {
    const s = new BattleSession(kind, party, enemyParty, opts.rng ?? Math.random, opts.trainer);
    s.moveMap = await getMoveMap();
    const firstAble = party.findIndex((m) => m.curHP > 0);
    s.player = await makeBattler(party[Math.max(0, firstAble)]);
    s.enemy = await makeBattler(enemyParty[0]);
    if (opts.weather && opts.weather !== "none") {
      // ambient map weather: weatherTurns 0 = never counts down
      s.weather = opts.weather;
      s.weatherTurns = 0;
    }
    return s;
  }

  /** Switch-in ability triggers (weather setters, intimidate). Call after intro. */
  introAbilities(): BattleEvent[] {
    const ev: BattleEvent[] = [];
    if (this.weather !== "none") {
      // ambient weather carried in from the overworld map
      ev.push({ t: "weather", weather: this.weather });
      ev.push({ t: "msg", key: `game.battle.weather_${this.weather}_start` });
    }
    // faster mon's ability would announce first, but order is cosmetic here
    for (const b of [this.enemy, this.player] as Battler[]) {
      this.onSwitchIn(b, ev);
    }
    return ev;
  }

  private onSwitchIn(b: Battler, ev: BattleEvent[]) {
    const ab = b.ability;
    if (!ab) return;
    const side: Side = b === this.player ? "player" : "enemy";
    if (ab.weather) {
      const w = ab.weather as Weather;
      if (this.weather !== w) {
        this.weather = w;
        this.weatherTurns = 5;
        ev.push({ t: "ability", side, ability: ab.slug });
        ev.push({ t: "weather", weather: w });
        ev.push({ t: "msg", key: `game.battle.weather_${w}_start` });
      }
    }
    if (ab.intimidate) {
      const foe = b === this.player ? this.enemy : this.player;
      if (foe.mon.curHP > 0 && (foe.ability?.slug !== "clear-body")) {
        ev.push({ t: "ability", side, ability: ab.slug });
        this.applyStatChange(foe, "attack", -1, ev);
      }
    }
  }

  playerView() { return viewOf(this.player); }
  enemyView() { return viewOf(this.enemy); }
  moveData(id: number) { return this.moveMap.get(id); }

  /** usable party indexes for switching */
  switchable(): number[] {
    return this.party
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.curHP > 0 && m.uid !== this.player.mon.uid)
      .map(({ i }) => i);
  }

  ableCount(): number {
    return this.party.filter((m) => m.curHP > 0).length;
  }

  // ------------------------------------------------------------------ turn
  async turn(action: BattleAction): Promise<BattleEvent[]> {
    return this.record(await this.turnInner(action));
  }

  private async turnInner(action: BattleAction): Promise<BattleEvent[]> {
    const ev: BattleEvent[] = [];
    if (this.over) return ev;

    if (action.kind === "run") {
      if (this.kind === "trainer") {
        ev.push({ t: "msg", key: "game.battle.cant_run" });
      } else {
        this.runAttempts++;
        const f = Math.floor((this.player.stats[5] * stageMult(this.player.stages.spe) * 128) /
          Math.max(1, this.enemy.stats[5] * stageMult(this.enemy.stages.spe))) + 30 * this.runAttempts;
        if (this.rng() * 256 < f) {
          ev.push({ t: "msg", key: "game.battle.ran_away" });
          this.finish(ev, "run");
          return ev;
        }
        ev.push({ t: "msg", key: "game.battle.run_fail" });
        await this.enemyActs(ev);
        this.endOfTurn(ev);
        return ev;
      }
      return ev;
    }

    if (action.kind === "ball") {
      if (this.kind === "trainer") {
        ev.push({ t: "msg", key: "game.battle.cant_catch_trainer" });
        return ev;
      }
      await this.throwBall(action.itemId, ev);
      if (!this.over) {
        await this.enemyActs(ev);
        this.endOfTurn(ev);
      }
      return ev;
    }

    if (action.kind === "item") {
      this.useHealItem(action.itemId, action.partyIdx, ev);
      await this.enemyActs(ev);
      this.endOfTurn(ev);
      return ev;
    }

    if (action.kind === "switch") {
      await this.doSwitch(action.partyIdx, ev, true);
      await this.enemyActs(ev);
      this.endOfTurn(ev);
      return ev;
    }

    // ---- both choose moves: order by priority then speed
    const pMove = this.resolveMoveChoice(this.player, action.index);
    const eMove = this.pickEnemyMove();
    const pSpe = this.effSpeed(this.player);
    const eSpe = this.effSpeed(this.enemy);
    const pPrio = pMove.move.pr;
    const ePrio = eMove.move.pr;
    const playerFirst =
      pPrio !== ePrio ? pPrio > ePrio : pSpe !== eSpe ? pSpe > eSpe : this.rng() < 0.5;

    const order: [Battler, Battler, { move: MoveData; idx: number }][] = playerFirst
      ? [[this.player, this.enemy, pMove], [this.enemy, this.player, eMove]]
      : [[this.enemy, this.player, eMove], [this.player, this.enemy, pMove]];

    for (const [att, def, mv] of order) {
      if (this.over) break;
      if (att.mon.curHP <= 0) continue;
      await this.executeMove(att, def, mv.move, mv.idx, ev);
      if (this.over) break;
      if (def.mon.curHP <= 0) {
        await this.handleFaint(def, ev);
        if (this.over) break;
      }
      if (att.mon.curHP <= 0) {
        await this.handleFaint(att, ev);
        if (this.over) break;
      }
    }
    if (!this.over) this.endOfTurn(ev);
    return ev;
  }

  /** After the player's mon faints, the UI picks a replacement (free action). */
  async replaceFainted(partyIdx: number): Promise<BattleEvent[]> {
    const ev: BattleEvent[] = [];
    await this.doSwitch(partyIdx, ev, false);
    return this.record(ev);
  }

  /** PvP: bring in the enemy side's replacement after a faint. */
  async replaceFaintedEnemy(teamIdx: number): Promise<BattleEvent[]> {
    const ev: BattleEvent[] = [];
    const target = this.enemyParty[teamIdx];
    if (target && target.curHP > 0) {
      this.enemyIdx = teamIdx;
      this.enemy = await makeBattler(target);
      ev.push({ t: "msg", key: "game.battle.enemy_switch", params: { trainer: `%TR_online.opponent%`, name: `%SPECIES_${target.speciesId}%` } });
      ev.push({ t: "switch", side: "enemy", view: this.enemyView() });
      this.onSwitchIn(this.enemy, ev);
    }
    return this.record(ev);
  }

  /** PvP voluntary switch for the enemy (guest) side. */
  private async pvpSwitchEnemy(teamIdx: number, ev: BattleEvent[]) {
    const target = this.enemyParty[teamIdx];
    if (!target || target.curHP <= 0) return;
    ev.push({ t: "msg", key: "game.battle.come_back", params: this.nameParam(this.enemy) });
    const out = this.enemy;
    if (out.mon.curHP > 0) {
      if (out.ability?.regenerator) out.mon.curHP = Math.min(out.stats[0], out.mon.curHP + Math.floor(out.stats[0] / 3));
      if (out.ability?.naturalCure && out.mon.status) out.mon.status = null;
    }
    this.enemyIdx = teamIdx;
    this.enemy = await makeBattler(target);
    ev.push({ t: "msg", key: "game.battle.switch_in", params: this.nameParam(this.enemy) });
    ev.push({ t: "switch", side: "enemy", view: this.enemyView() });
    this.onSwitchIn(this.enemy, ev);
  }

  /**
   * PvP turn: both actions supplied externally (online battles run the same
   * deterministic session on both peers with a shared RNG seed). Switches
   * resolve before moves, as in the official games.
   */
  async pvpTurn(playerAct: BattleAction, enemyAct: BattleAction): Promise<BattleEvent[]> {
    const ev: BattleEvent[] = [];
    if (this.over) return this.record(ev);

    // ---- switches happen first
    if (playerAct.kind === "switch") await this.doSwitch(playerAct.partyIdx, ev, true);
    if (enemyAct.kind === "switch") await this.pvpSwitchEnemy(enemyAct.partyIdx, ev);

    const pMoving = playerAct.kind === "move";
    const eMoving = enemyAct.kind === "move";
    const pMove = pMoving ? this.resolveMoveChoice(this.player, playerAct.index) : null;
    const eMove = eMoving ? this.resolveEnemyMoveChoice(enemyAct.index) : null;

    if (pMove && eMove) {
      const pSpe = this.effSpeed(this.player);
      const eSpe = this.effSpeed(this.enemy);
      const playerFirst =
        pMove.move.pr !== eMove.move.pr ? pMove.move.pr > eMove.move.pr
        : pSpe !== eSpe ? pSpe > eSpe : this.rng() < 0.5;
      const order: [Battler, Battler, { move: MoveData; idx: number }][] = playerFirst
        ? [[this.player, this.enemy, pMove], [this.enemy, this.player, eMove]]
        : [[this.enemy, this.player, eMove], [this.player, this.enemy, pMove]];
      for (const [att, def, mv] of order) {
        if (this.over) break;
        if (att.mon.curHP <= 0) continue;
        await this.executeMove(att, def, mv.move, mv.idx, ev);
        this.resolvePvpFaint(ev);
        if (this.over) break;
      }
    } else if (pMove) {
      if (this.player.mon.curHP > 0) {
        await this.executeMove(this.player, this.enemy, pMove.move, pMove.idx, ev);
        this.resolvePvpFaint(ev);
      }
    } else if (eMove) {
      if (this.enemy.mon.curHP > 0) {
        await this.executeMove(this.enemy, this.player, eMove.move, eMove.idx, ev);
        this.resolvePvpFaint(ev);
      }
    }

    if (!this.over) {
      this.pvpEndOfTurn(ev);
    }
    return this.record(ev);
  }

  private resolveEnemyMoveChoice(idx: number): { move: MoveData; idx: number } {
    const b = this.enemy;
    const chosen = b.mon.moves[idx];
    if (!chosen || b.pp[idx] <= 0) {
      const i = b.mon.moves.findIndex((_, j) => b.pp[j] > 0);
      if (i < 0) return { move: this.moveMap.get(STRUGGLE_ID)!, idx: -1 };
      return { move: this.moveMap.get(b.mon.moves[i].id)!, idx: i };
    }
    return { move: this.moveMap.get(chosen.id)!, idx };
  }

  /** PvP faint check: a side loses when its whole team is out. */
  private resolvePvpFaint(ev: BattleEvent[]) {
    if (this.enemy.mon.curHP <= 0 && !this.enemy.faintAnnounced) {
      this.enemy.faintAnnounced = true;
      ev.push({ t: "anim", kind: "faint", side: "enemy" });
      ev.push({ t: "msg", key: "game.battle.enemy_fainted", params: this.nameParam(this.enemy) });
      if (this.enemyParty.every((m) => m.curHP <= 0)) this.finish(ev, "win");
    }
    if (!this.over && this.player.mon.curHP <= 0 && !this.player.faintAnnounced) {
      this.player.faintAnnounced = true;
      ev.push({ t: "anim", kind: "faint", side: "player" });
      ev.push({ t: "msg", key: "game.battle.fainted", params: this.nameParam(this.player) });
      if (this.party.every((m) => m.curHP <= 0)) this.finish(ev, "lose");
    }
  }

  private pvpEndOfTurn(ev: BattleEvent[]) {
    for (const b of [this.player, this.enemy] as Battler[]) {
      if (b.mon.curHP <= 0) continue;
      const side: Side = b === this.player ? "player" : "enemy";
      const who = this.nameParam(b);
      if (b.mon.status === "brn") {
        b.mon.curHP = Math.max(0, b.mon.curHP - Math.max(1, Math.floor(b.stats[0] / 16)));
        ev.push({ t: "msg", key: "game.battle.brn_dmg", params: who });
        ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      } else if (b.mon.status === "psn" || b.mon.status === "tox") {
        b.mon.curHP = Math.max(0, b.mon.curHP - Math.max(1, Math.floor(b.stats[0] / 8)));
        ev.push({ t: "msg", key: "game.battle.psn_dmg", params: who });
        ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      }
    }
    this.resolvePvpFaint(ev);
  }

  // ----------------------------------------------------------------- moves
  private resolveMoveChoice(b: Battler, idx: number): { move: MoveData; idx: number } {
    const hasPP = b.mon.moves.some((m, i) => (b === this.player ? m.pp : b.pp[i]) > 0);
    if (!hasPP) {
      return { move: this.moveMap.get(STRUGGLE_ID)!, idx: -1 };
    }
    const chosen = b.mon.moves[idx];
    const pp = b === this.player ? chosen?.pp ?? 0 : b.pp[idx] ?? 0;
    if (!chosen || pp <= 0) {
      const i = b.mon.moves.findIndex((m, j) => (b === this.player ? m.pp : b.pp[j]) > 0);
      return { move: this.moveMap.get(b.mon.moves[i].id)!, idx: i };
    }
    return { move: this.moveMap.get(chosen.id)!, idx };
  }

  private pickEnemyMove(): { move: MoveData; idx: number } {
    const b = this.enemy;
    const usable = b.mon.moves
      .map((m, i) => ({ m, i }))
      .filter(({ i }) => b.pp[i] > 0)
      .map(({ m, i }) => ({ move: this.moveMap.get(m.id)!, idx: i }))
      .filter((x) => x.move);
    if (usable.length === 0) return { move: this.moveMap.get(STRUGGLE_ID)!, idx: -1 };
    if (this.kind === "trainer" && this.rng() > 0.2) {
      // greedy: highest expected damage
      let best = usable[0];
      let bestScore = -1;
      for (const u of usable) {
        if (u.move.c === 2) continue;
        const eff = effectiveness(u.move.t, this.player.species.t);
        const stab = b.species.t.includes(u.move.t) ? 1.5 : 1;
        const score = u.move.p * eff * stab * (u.move.a ? u.move.a / 100 : 1);
        if (score > bestScore) { bestScore = score; best = u; }
      }
      if (bestScore > 0) return best;
    }
    return usable[Math.floor(this.rng() * usable.length)];
  }

  private nameParam(b: Battler): Record<string, string | number> {
    // The UI substitutes %SPECIES_<id>% with the localized species name.
    return { name: b.mon.nickname ?? `%SPECIES_${b.mon.speciesId}%` };
  }

  /** Effective speed incl. stages, paralysis and abilities. */
  private effSpeed(b: Battler): number {
    let spe = b.stats[5] * stageMult(b.stages.spe);
    if (b.ability?.quickFeet && b.mon.status) spe *= 1.5;
    else if (b.mon.status === "par") spe *= 0.5;
    if (b.ability?.weatherSpeed && b.ability.weatherSpeed === this.weather) spe *= 2;
    return spe;
  }

  private async executeMove(att: Battler, def: Battler, move: MoveData, moveIdx: number, ev: BattleEvent[]) {
    const isPlayer = att === this.player;
    const who = this.nameParam(att);

    // --- releasing a charged two-turn move overrides the chosen action
    let releasing = false;
    if (att.charging) {
      const c = att.charging;
      move = this.moveMap.get(c.moveId) ?? move;
      moveIdx = -2; // PP was paid on the charge turn
      att.charging = null;
      att.semiInvuln = false;
      releasing = true;
    }

    // --- pre-action status gates
    if (att.flinched) {
      att.flinched = false;
      ev.push({ t: "msg", key: "game.battle.flinch", params: who });
      return;
    }
    if (att.mon.status === "slp") {
      if (att.sleepTurns <= 0) {
        att.mon.status = null;
        ev.push({ t: "msg", key: "game.battle.slp_wake", params: who });
        ev.push({ t: "status", side: isPlayer ? "player" : "enemy", status: null });
      } else {
        att.sleepTurns--;
        ev.push({ t: "msg", key: "game.battle.slp_stay", params: who });
        return;
      }
    }
    if (att.mon.status === "frz") {
      if (this.rng() < 0.2 || move.t === "fire") {
        att.mon.status = null;
        ev.push({ t: "msg", key: "game.battle.frz_thaw", params: who });
        ev.push({ t: "status", side: isPlayer ? "player" : "enemy", status: null });
      } else {
        ev.push({ t: "msg", key: "game.battle.frz_stay", params: who });
        return;
      }
    }
    if (att.mon.status === "par" && this.rng() < 0.25) {
      ev.push({ t: "msg", key: "game.battle.par_cant", params: who });
      return;
    }
    if (att.confuse > 0) {
      att.confuse--;
      if (att.confuse === 0) {
        ev.push({ t: "msg", key: "game.battle.confuse_end", params: who });
      } else {
        ev.push({ t: "msg", key: "game.battle.confuse_stay", params: who });
        if (this.rng() < 1 / 3) {
          ev.push({ t: "msg", key: "game.battle.confuse_self" });
          const dmg = this.computeDamage(att, att, { power: 40, phys: true, typeless: true });
          this.dealDamage(att, dmg.dmg, ev);
          if (att.mon.curHP <= 0) return;
          return;
        }
      }
    }

    // any non-Protect move breaks the Protect success chain
    att.protectStreak = 0;

    // --- announce + PP
    ev.push({
      t: "msg",
      key: isPlayer ? "game.battle.used" : "game.battle.enemy_used",
      params: { ...who, move: `%MOVE_${move.id}%` },
    });
    if (moveIdx >= 0) {
      if (isPlayer) att.mon.moves[moveIdx].pp = Math.max(0, att.mon.moves[moveIdx].pp - 1);
      else att.pp[moveIdx] = Math.max(0, att.pp[moveIdx] - 1);
    }
    ev.push({ t: "anim", kind: "attack", side: isPlayer ? "player" : "enemy" });

    // --- two-turn charge moves (Fly / Dig / Solar Beam)
    const CHARGE_MSG: Record<number, string> = { 19: "charge_fly", 91: "charge_dig", 76: "charge_solar" };
    if (!releasing && CHARGE_MSG[move.id] && move.c !== 2) {
      // Solar Beam fires immediately in harsh sunlight
      if (!(move.id === 76 && this.weather === "sun")) {
        att.charging = { moveId: move.id, idx: moveIdx };
        if (move.id !== 76) att.semiInvuln = true;
        ev.push({ t: "msg", key: `game.battle.${CHARGE_MSG[move.id]}`, params: who });
        return;
      }
    }

    // --- accuracy (No Guard on either side bypasses the check)
    const noGuard = att.ability?.noGuard || def.ability?.noGuard;
    if (def.semiInvuln && !noGuard && move.c !== 2) {
      ev.push({ t: "msg", key: "game.battle.missed" });
      return;
    }
    if (move.a > 0 && !noGuard) {
      const acc = (move.a / 100) * accStageMult(att.stages.acc) / accStageMult(def.stages.eva);
      if (this.rng() > acc) {
        ev.push({ t: "msg", key: "game.battle.missed" });
        return;
      }
    }

    const defSide: Side = def === this.player ? "player" : "enemy";

    if (move.c === 2) {
      // ------- Protect / Detect
      if (move.id === 182 || move.id === 197) {
        const chance = 1 / Math.pow(2, att.protectStreak);
        if (this.rng() < chance) {
          att.protectedT = true;
          att.protectStreak++;
          ev.push({ t: "msg", key: "game.battle.protected_self", params: who });
        } else {
          att.protectStreak = 0;
          ev.push({ t: "msg", key: "game.battle.protect_fail", params: who });
        }
        return;
      }
      // ------- Substitute
      if (move.id === 164) {
        const cost = Math.floor(att.stats[0] / 4);
        if (att.sub > 0 || att.mon.curHP <= cost) {
          ev.push({ t: "msg", key: "game.battle.protect_fail" });
          return;
        }
        att.mon.curHP -= cost;
        att.sub = cost;
        ev.push({ t: "msg", key: "game.battle.sub_make", params: who });
        ev.push({ t: "hp", side: isPlayer ? "player" : "enemy", hp: att.mon.curHP, maxHp: att.stats[0] });
        return;
      }
      // ------- Focus Energy
      if (move.id === 116) {
        if (att.focused) { ev.push({ t: "msg", key: "game.battle.protect_fail" }); return; }
        att.focused = true;
        ev.push({ t: "msg", key: "game.battle.focus", params: who });
        return;
      }
      // ------- Rest
      if (move.id === 156) {
        if (att.mon.curHP >= att.stats[0]) {
          ev.push({ t: "msg", key: "game.battle.missed" });
          return;
        }
        att.mon.status = "slp";
        att.sleepTurns = 2;
        att.mon.curHP = att.stats[0];
        ev.push({ t: "msg", key: "game.battle.rest", params: who });
        ev.push({ t: "status", side: isPlayer ? "player" : "enemy", status: "slp" });
        ev.push({ t: "hp", side: isPlayer ? "player" : "enemy", hp: att.mon.curHP, maxHp: att.stats[0] });
        return;
      }
      // ------- weather-setting moves
      const WEATHER_MOVES: Record<number, Weather> = { 241: "sun", 240: "rain", 201: "sand", 258: "hail" };
      const w = WEATHER_MOVES[move.id];
      if (w) {
        if (this.weather === w) {
          ev.push({ t: "msg", key: "game.battle.missed" });
        } else {
          this.weather = w;
          this.weatherTurns = 5;
          ev.push({ t: "weather", weather: w });
          ev.push({ t: "msg", key: `game.battle.weather_${w}_start` });
        }
        return;
      }
      // ------- Protect / Substitute block status moves aimed at the foe
      if (move.m?.tgt !== "user") {
        if (def.protectedT) {
          ev.push({ t: "msg", key: "game.battle.protected", params: this.nameParam(def) });
          return;
        }
        if (def.sub > 0) {
          ev.push({ t: "msg", key: "game.battle.sub_block", params: this.nameParam(def) });
          return;
        }
      }
      // ------- status move
      this.applyMoveEffects(att, def, move, ev, 0, true);
      return;
    }

    // ------- Protect blocks the incoming damaging move
    if (def.protectedT) {
      ev.push({ t: "msg", key: "game.battle.protected", params: this.nameParam(def) });
      return;
    }

    // ------- ability-based immunities & absorption (defender)
    const dab = def.ability;
    if (dab) {
      if (dab.levitate && move.t === "ground") {
        ev.push({ t: "ability", side: defSide, ability: dab.slug });
        ev.push({ t: "msg", key: "game.battle.immune" });
        return;
      }
      if (dab.absorbType === move.t) {
        ev.push({ t: "ability", side: defSide, ability: dab.slug });
        const heal = Math.max(1, Math.floor(def.stats[0] / 4));
        if (def.mon.curHP < def.stats[0]) {
          def.mon.curHP = Math.min(def.stats[0], def.mon.curHP + heal);
          ev.push({ t: "msg", key: "game.battle.healed", params: this.nameParam(def) });
          ev.push({ t: "hp", side: defSide, hp: def.mon.curHP, maxHp: def.stats[0] });
        } else {
          ev.push({ t: "msg", key: "game.battle.immune" });
        }
        return;
      }
      if (dab.absorbBoost && dab.absorbBoost.type === move.t) {
        ev.push({ t: "ability", side: defSide, ability: dab.slug });
        if (dab.slug === "flash-fire") {
          def.fireBoost = true;
          ev.push({ t: "msg", key: "game.battle.flashfire", params: this.nameParam(def) });
        } else if (dab.absorbBoost.stages > 0) {
          const statName = { atk: "attack", spa: "special-attack", spe: "speed" }[dab.absorbBoost.stat];
          this.applyStatChange(def, statName, dab.absorbBoost.stages, ev);
        } else {
          ev.push({ t: "msg", key: "game.battle.immune" });
        }
        return;
      }
    }

    // ------- damaging move
    let eff = effectiveness(move.t, def.species.t);
    // Scrappy lets Normal/Fighting moves hit Ghost
    if (eff === 0 && att.ability?.scrappy && (move.t === "normal" || move.t === "fighting")) eff = 1;
    if (eff === 0) {
      ev.push({ t: "msg", key: "game.battle.immune" });
      return;
    }
    let hits = 1;
    if (move.m?.hits) {
      const [mn, mx] = move.m.hits;
      if (mx > mn) {
        const roll = this.rng();
        hits = mx >= 5 ? (roll < 0.35 ? 2 : roll < 0.7 ? 3 : roll < 0.85 ? 4 : 5) : mn + Math.floor(this.rng() * (mx - mn + 1));
      } else hits = mn;
    }
    let total = 0;
    let lastCrit = false;
    let subBroke = false;
    let subTook = false;
    for (let h = 0; h < hits && def.mon.curHP > 0 && !subBroke; h++) {
      const { dmg, crit } = this.computeDamage(att, def, { move });
      total += dmg;
      lastCrit = crit;
      if (def.sub > 0) {
        // the substitute soaks the hit
        subTook = true;
        def.sub -= dmg;
        if (def.sub <= 0) { def.sub = 0; subBroke = true; }
      } else {
        this.dealDamage(def, dmg, ev);
      }
    }
    ev.push({
      t: "anim",
      kind: eff > 1 ? "hit_super" : eff < 1 ? "hit_weak" : "hit",
      side: defSide,
      mt: move.t,
    });
    if (subTook) ev.push({ t: "msg", key: "game.battle.sub_hit", params: this.nameParam(def) });
    if (subBroke) ev.push({ t: "msg", key: "game.battle.sub_break", params: this.nameParam(def) });
    if (hits > 1) ev.push({ t: "msg", key: "game.battle.hits_n", params: { n: hits } });
    if (lastCrit) ev.push({ t: "msg", key: "game.battle.crit" });
    if (eff > 1) ev.push({ t: "msg", key: "game.battle.super" });
    else if (eff < 1) ev.push({ t: "msg", key: "game.battle.notvery" });

    // drain / recoil
    if (move.m?.drain && total > 0) {
      const amount = Math.max(1, Math.floor((total * move.m.drain) / 100));
      if (move.m.drain > 0) {
        att.mon.curHP = Math.min(att.stats[0], att.mon.curHP + amount);
        ev.push({ t: "msg", key: "game.battle.drained", params: this.nameParam(def) });
      } else {
        att.mon.curHP = Math.max(0, att.mon.curHP + amount);
        ev.push({ t: "msg", key: "game.battle.recoil", params: who });
      }
      ev.push({ t: "hp", side: att === this.player ? "player" : "enemy", hp: att.mon.curHP, maxHp: att.stats[0] });
    }
    if (move.id === STRUGGLE_ID) {
      const recoil = Math.max(1, Math.floor(att.stats[0] / 4));
      att.mon.curHP = Math.max(0, att.mon.curHP - recoil);
      ev.push({ t: "msg", key: "game.battle.recoil", params: who });
      ev.push({ t: "hp", side: att === this.player ? "player" : "enemy", hp: att.mon.curHP, maxHp: att.stats[0] });
    }

    if (def.mon.curHP > 0) {
      // a substitute blocks the move's secondary effects on the target
      if (!subTook) this.applyMoveEffects(att, def, move, ev, total, false);
      this.checkBerry(def, ev); // pinch berry after taking the hit

      // contact retaliation (physical moves touch the defender)
      if (move.c === 0 && total > 0 && !subTook && att.mon.curHP > 0) {
        const dab = def.ability;
        if (dab?.contactStatus && this.rng() * 100 < dab.contactStatus.chance) {
          ev.push({ t: "ability", side: defSide, ability: dab.slug });
          this.applyAilment(att, { par: "paralysis", psn: "poison", brn: "burn" }[dab.contactStatus.status], ev);
        }
        if (dab?.contactDamage && !att.ability?.magicGuard) {
          const chip = Math.max(1, Math.floor(att.stats[0] / 8));
          att.mon.curHP = Math.max(0, att.mon.curHP - chip);
          ev.push({ t: "ability", side: defSide, ability: dab.slug });
          ev.push({ t: "msg", key: "game.battle.contact_hurt", params: who });
          ev.push({ t: "hp", side: isPlayer ? "player" : "enemy", hp: att.mon.curHP, maxHp: att.stats[0] });
        }
      }
    }
  }

  private computeDamage(
    att: Battler,
    def: Battler,
    src: { move?: MoveData; power?: number; phys?: boolean; typeless?: boolean }
  ): { dmg: number; crit: boolean } {
    const move = src.move;
    let power = move ? move.p : src.power ?? 40;
    if (power <= 0) return { dmg: 0, crit: false };
    const phys = move ? move.c === 0 : !!src.phys;
    const L = att.mon.level;
    const aAb = att.ability;
    const dAb = def.ability;
    const moveType: TypeName | null = src.typeless ? null : move ? move.t : null;

    // technician: ≤60 BP gets 1.5×
    if (aAb?.technician && power <= 60) power = Math.floor(power * 1.5);

    let critChance = move?.m?.crit ? 1 / 8 : 1 / 24;
    if (att.focused) critChance = Math.max(critChance, 1 / 2);
    const crit = !src.typeless && this.rng() < critChance;
    let aStage = phys ? att.stages.atk : att.stages.spa;
    let dStage = phys ? def.stages.def : def.stages.spd;
    if (crit) { aStage = Math.max(0, aStage); dStage = Math.min(0, dStage); }
    let A = att.stats[phys ? 1 : 3] * stageMult(aStage);
    let D = Math.max(1, def.stats[phys ? 2 : 4] * stageMult(dStage));
    // huge/pure power double physical attack
    if (phys && aAb?.doubleAtk) A *= 2;
    // guts: 1.5× attack when statused
    if (phys && aAb?.guts && att.mon.status) A *= 1.5;
    // solar power: 1.5× SpA in sun
    if (!phys && aAb?.solarPower && this.weather === "sun") A *= 1.5;
    // marvel scale: 1.5× Defense while statused
    if (phys && dAb?.marvelScale && def.mon.status) D *= 1.5;
    let dmg = Math.floor(Math.floor((Math.floor((2 * L) / 5 + 2) * power * A) / D) / 50) + 2;

    if (moveType && move) {
      // STAB (Adaptability upgrades it to 2×)
      if (att.species.t.includes(moveType)) dmg *= aAb?.adaptability ? 2 : 1.5;
      let eff = effectiveness(moveType, def.species.t);
      if (eff === 0 && aAb?.scrappy && (moveType === "normal" || moveType === "fighting")) eff = 1;
      dmg *= eff;
      // tinted lens: double damage on not-very-effective hits
      if (aAb?.tintedLens && eff > 0 && eff < 1) dmg *= 2;
      // pinch abilities: 1.5× own-type move when HP ≤ 1/3
      if (aAb?.pinchType === moveType && att.mon.curHP <= att.stats[0] / 3) dmg *= 1.5;
      // flash-fire boost
      if (att.fireBoost && moveType === "fire") dmg *= 1.5;
      // weather
      if (this.weather === "sun") { if (moveType === "fire") dmg *= 1.5; else if (moveType === "water") dmg *= 0.5; }
      else if (this.weather === "rain") { if (moveType === "water") dmg *= 1.5; else if (moveType === "fire") dmg *= 0.5; }
      // defender abilities: thick-fat, resist, reduce-SE
      if (dAb?.thickFat && (moveType === "fire" || moveType === "ice")) dmg *= 0.5;
      if (dAb?.resistType === moveType) dmg *= 0.5;
      if (dAb?.reduceSE && eff > 1) dmg *= 0.75;
      // multiscale: halved at full HP
      if (dAb?.multiscale && def.mon.curHP === def.stats[0]) dmg *= 0.5;
    }
    if (crit) dmg *= aAb?.sniper ? 2.25 : 1.5;
    // burn halves physical unless Guts
    if (phys && att.mon.status === "brn" && !aAb?.guts) dmg *= 0.5;
    dmg *= 0.85 + this.rng() * 0.15;
    return { dmg: Math.max(1, Math.floor(dmg)), crit };
  }

  private dealDamage(def: Battler, dmg: number, ev: BattleEvent[]) {
    const side: Side = def === this.player ? "player" : "enemy";
    // Sturdy: endure a OHKO from full HP with 1 HP
    let sturdy = false;
    if (def.ability?.sturdy && def.mon.curHP === def.stats[0] && dmg >= def.mon.curHP) {
      dmg = def.mon.curHP - 1;
      sturdy = true;
    }
    def.mon.curHP = Math.max(0, def.mon.curHP - dmg);
    ev.push({ t: "hp", side, hp: def.mon.curHP, maxHp: def.stats[0] });
    if (sturdy) {
      ev.push({ t: "ability", side, ability: "sturdy" });
      ev.push({ t: "msg", key: "game.battle.sturdy", params: this.nameParam(def) });
    }
  }

  private applyMoveEffects(att: Battler, def: Battler, move: MoveData, ev: BattleEvent[], dealt: number, isStatusMove: boolean) {
    const m = move.m;
    if (!m) return;
    const who = (b: Battler) => this.nameParam(b);
    // Serene Grace doubles secondary effect chances
    const graceMul = att.ability?.sereneGrace ? 2 : 1;

    // healing (recover etc.)
    if (m.heal && m.heal > 0) {
      const amount = Math.max(1, Math.floor((att.stats[0] * m.heal) / 100));
      att.mon.curHP = Math.min(att.stats[0], att.mon.curHP + amount);
      ev.push({ t: "msg", key: "game.battle.healed", params: who(att) });
      ev.push({ t: "hp", side: att === this.player ? "player" : "enemy", hp: att.mon.curHP, maxHp: att.stats[0] });
    }

    // stat changes
    if (m.st?.length) {
      const chance = isStatusMove ? 100 : m.stCh || 100;
      if (this.rng() * 100 < chance) {
        const positive = m.st.every(([, c]) => c > 0);
        const target: Battler = m.tgt === "user" || (!isStatusMove && positive) ? att : def;
        for (const [statName, change] of m.st) {
          this.applyStatChange(target, statName, change, ev);
        }
      }
    }

    // ailments
    if (m.ail) {
      const chance = (isStatusMove ? (m.ailCh || 100) : m.ailCh || 0) * graceMul;
      if (chance > 0 && this.rng() * 100 < chance) {
        this.applyAilment(def, m.ail, ev);
      }
    }

    // flinch
    if (m.flinch && dealt > 0 && this.rng() * 100 < m.flinch * graceMul) {
      def.flinched = true;
    }
  }

  private applyStatChange(target: Battler, statName: string, change: number, ev: BattleEvent[]) {
    const keyMap: Record<string, StatStageKey> = {
      attack: "atk", defense: "def", "special-attack": "spa", "special-defense": "spd",
      speed: "spe", accuracy: "acc", evasion: "eva",
    };
    const k = keyMap[statName];
    if (!k) return;
    // Simple doubles the target's own stage changes
    if (target.ability?.simple) change *= 2;
    const side: Side = target === this.player ? "player" : "enemy";
    const cur = target.stages[k];
    const params = { ...this.nameParam(target), stat: `%STAT_${k}%` };
    if (change > 0 && cur >= 6) { ev.push({ t: "msg", key: "game.battle.stat_max", params }); return; }
    if (change < 0 && cur <= -6) { ev.push({ t: "msg", key: "game.battle.stat_min", params }); return; }
    target.stages[k] = Math.max(-6, Math.min(6, cur + change));
    ev.push({ t: "anim", kind: change > 0 ? "stat_up" : "stat_down", side });
    ev.push({
      t: "msg",
      key: change >= 2 ? "game.battle.stat_up2" : change === 1 ? "game.battle.stat_up" : change <= -2 ? "game.battle.stat_down2" : "game.battle.stat_down",
      params,
    });
  }

  private applyAilment(def: Battler, ail: string, ev: BattleEvent[]) {
    const side: Side = def === this.player ? "player" : "enemy";
    const who = this.nameParam(def);
    if (ail === "confusion") {
      if (def.confuse > 0) return;
      def.confuse = 2 + Math.floor(this.rng() * 3);
      ev.push({ t: "msg", key: "game.battle.confuse_inflict", params: who });
      return;
    }
    if (ail === "trap") {
      if (def.trapTurns > 0) return;
      def.trapTurns = 2 + Math.floor(this.rng() * 4); // 2-5 turns
      ev.push({ t: "msg", key: "game.battle.trap_inflict", params: who });
      return;
    }
    if (def.mon.status) return; // already has a major status
    const t = def.species.t;
    let status: MajorStatus | null = null;
    if (ail === "paralysis" && !t.includes("electric")) status = "par";
    else if (ail === "burn" && !t.includes("fire")) status = "brn";
    else if (ail === "poison" && !t.includes("poison") && !t.includes("steel")) status = "psn";
    else if (ail === "sleep") status = "slp";
    else if (ail === "freeze" && !t.includes("ice")) status = "frz";
    if (!status) return;
    // ability status immunity
    if (def.ability?.statusImmune?.includes(status)) {
      ev.push({ t: "ability", side, ability: def.ability.slug });
      return;
    }
    def.mon.status = status;
    if (status === "slp") def.sleepTurns = 1 + Math.floor(this.rng() * 3);
    if (status === "psn") def.toxicN = 1;
    ev.push({ t: "msg", key: `game.battle.${status}_inflict`, params: who });
    ev.push({ t: "status", side, status });
    this.checkBerry(def, ev); // status-curing berry may trigger
  }

  /** Auto-trigger a held berry (after HP loss or status). Consumes the item. */
  private checkBerry(b: Battler, ev: BattleEvent[]) {
    if (b.berryUsed || !b.mon.item || b.mon.curHP <= 0) return;
    const def = ITEMS[b.mon.item];
    const berry = def?.berry;
    if (!berry) return;
    const side: Side = b === this.player ? "player" : "enemy";
    let used = false;
    if (berry.healBelow && b.mon.curHP <= b.stats[0] * berry.healBelow && b.mon.curHP < b.stats[0]) {
      const amount = berry.healFraction ? Math.floor(b.stats[0] * berry.healFraction) : berry.healAmount ?? 0;
      b.mon.curHP = Math.min(b.stats[0], b.mon.curHP + amount);
      ev.push({ t: "msg", key: "game.battle.berry_heal", params: { ...this.nameParam(b), item: `%ITEM_${b.mon.item}%` } });
      ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      used = true;
    } else if (berry.cureStatus && b.mon.status) {
      const cures = berry.cureStatus === "all" || berry.cureStatus.includes(b.mon.status);
      if (cures) {
        b.mon.status = null;
        b.sleepTurns = 0;
        ev.push({ t: "msg", key: "game.battle.berry_cure", params: { ...this.nameParam(b), item: `%ITEM_${b.mon.item}%` } });
        ev.push({ t: "status", side, status: null });
        used = true;
      }
    }
    if (used) {
      b.berryUsed = true;
      b.mon.item = null; // berry consumed
    }
  }

  /** Is this battler immune to sand/hail chip damage? */
  private weatherImmune(b: Battler, w: Weather): boolean {
    if (w === "sand") return b.species.t.some((t) => t === "rock" || t === "ground" || t === "steel");
    if (w === "hail") return b.species.t.includes("ice");
    return true;
  }

  // -------------------------------------------------------------- end of turn
  private endOfTurn(ev: BattleEvent[]) {
    if (this.over) return;
    // ---- weather chip damage
    if (this.weather === "sand" || this.weather === "hail") {
      for (const b of [this.player, this.enemy] as Battler[]) {
        if (b.mon.curHP <= 0 || this.weatherImmune(b, this.weather) || b.ability?.magicGuard) continue;
        const side: Side = b === this.player ? "player" : "enemy";
        b.mon.curHP = Math.max(0, b.mon.curHP - Math.max(1, Math.floor(b.stats[0] / 16)));
        ev.push({ t: "msg", key: `game.battle.weather_${this.weather}_dmg`, params: this.nameParam(b) });
        ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      }
    }
    // ---- status chip damage (Magic Guard is immune to indirect damage)
    for (const b of [this.player, this.enemy] as Battler[]) {
      if (b.mon.curHP <= 0 || b.ability?.magicGuard) continue;
      const side: Side = b === this.player ? "player" : "enemy";
      const who = this.nameParam(b);
      if (b.mon.status === "brn") {
        b.mon.curHP = Math.max(0, b.mon.curHP - Math.max(1, Math.floor(b.stats[0] / 16)));
        ev.push({ t: "msg", key: "game.battle.brn_dmg", params: who });
        ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      } else if (b.mon.status === "psn" || b.mon.status === "tox") {
        b.mon.curHP = Math.max(0, b.mon.curHP - Math.max(1, Math.floor(b.stats[0] / 8)));
        ev.push({ t: "msg", key: "game.battle.psn_dmg", params: who });
        ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      }
    }
    // ---- bind/wrap chip + countdown
    for (const b of [this.player, this.enemy] as Battler[]) {
      if (b.trapTurns <= 0 || b.mon.curHP <= 0) continue;
      const side: Side = b === this.player ? "player" : "enemy";
      const who = this.nameParam(b);
      b.trapTurns--;
      if (!b.ability?.magicGuard) {
        b.mon.curHP = Math.max(0, b.mon.curHP - Math.max(1, Math.floor(b.stats[0] / 8)));
        ev.push({ t: "msg", key: "game.battle.trap_dmg", params: who });
        ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      }
      if (b.trapTurns === 0) ev.push({ t: "msg", key: "game.battle.trap_end", params: who });
    }
    // ---- end-of-turn abilities
    for (const b of [this.player, this.enemy] as Battler[]) {
      if (b.mon.curHP <= 0) continue;
      const side: Side = b === this.player ? "player" : "enemy";
      if (b.ability?.speedBoost && b.stages.spe < 6) {
        ev.push({ t: "ability", side, ability: b.ability.slug });
        this.applyStatChange(b, "speed", 1, ev);
      }
      if (b.ability?.shedSkin && b.mon.status && this.rng() < 0.3) {
        ev.push({ t: "ability", side, ability: b.ability.slug });
        b.mon.status = null;
        b.sleepTurns = 0;
        ev.push({ t: "status", side, status: null });
      }
      if (b.ability?.solarPower && this.weather === "sun" && !b.ability.magicGuard) {
        b.mon.curHP = Math.max(0, b.mon.curHP - Math.max(1, Math.floor(b.stats[0] / 8)));
        ev.push({ t: "hp", side, hp: b.mon.curHP, maxHp: b.stats[0] });
      }
    }
    // ---- low-HP berry triggers
    for (const b of [this.player, this.enemy] as Battler[]) this.checkBerry(b, ev);
    // ---- Protect expires at end of turn
    this.player.protectedT = false;
    this.enemy.protectedT = false;
    // ---- weather countdown
    if (this.weather !== "none" && this.weatherTurns > 0) {
      this.weatherTurns--;
      if (this.weatherTurns === 0) {
        ev.push({ t: "msg", key: `game.battle.weather_${this.weather}_end` });
        this.weather = "none";
        ev.push({ t: "weather", weather: "none" });
      }
    }
    // faints from residual damage
    void this.resolveResidualFaints(ev);
  }

  private async resolveResidualFaints(ev: BattleEvent[]) {
    if (this.enemy.mon.curHP <= 0 && !this.over) await this.handleFaint(this.enemy, ev);
    if (this.player.mon.curHP <= 0 && !this.over) await this.handleFaint(this.player, ev);
  }

  // ------------------------------------------------------------------ faints
  private async handleFaint(b: Battler, ev: BattleEvent[]) {
    const side: Side = b === this.player ? "player" : "enemy";
    ev.push({ t: "anim", kind: "faint", side });
    ev.push({
      t: "msg",
      key: side === "enemy" ? "game.battle.enemy_fainted" : "game.battle.fainted",
      params: this.nameParam(b),
    });

    if (side === "enemy") {
      // exp + EVs for the active player mon
      const gain = expGain(b.species.be, b.mon.level, this.kind === "trainer");
      const p = this.player;
      if (p.mon.curHP > 0 && p.mon.level < 100) {
        // effort values from the defeated species
        if (b.species.ey?.length) {
          if (!p.mon.evs) p.mon.evs = [0, 0, 0, 0, 0, 0];
          if (applyEvYield(p.mon.evs, b.species.ey)) {
            p.stats = statsOf(p.mon, p.species);
          }
        }
        ev.push({ t: "msg", key: "game.battle.gained_exp", params: { ...this.nameParam(p), exp: gain } });
        const { levels, newMoves } = await applyExp(p.mon, p.species, gain);
        this.expEarnedBy.add(p.mon.uid);
        for (const lv of levels) {
          p.stats = statsOf(p.mon, p.species);
          ev.push({ t: "level", level: lv });
          ev.push({ t: "msg", key: "game.battle.level_up", params: { ...this.nameParam(p), lv } });
          ev.push({ t: "hp", side: "player", hp: p.mon.curHP, maxHp: p.stats[0] });
        }
        for (const nm of newMoves) this.pendingLearns.push({ uid: p.mon.uid, moveId: nm.moveId });
      }

      // next enemy?
      if (this.kind === "trainer" && this.enemyIdx < this.enemyParty.length - 1) {
        this.enemyIdx++;
        this.enemy = await makeBattler(this.enemyParty[this.enemyIdx]);
        ev.push({
          t: "msg", key: "game.battle.enemy_switch",
          params: { trainer: `%TR_${this.trainer?.nameKey ?? ""}%`, name: `%SPECIES_${this.enemy.mon.speciesId}%` },
        });
        ev.push({ t: "switch", side: "enemy", view: this.enemyView() });
        return;
      }
      // victory
      if (this.kind === "trainer" && this.trainer) {
        ev.push({ t: "msg", key: "game.battle.you_win", params: { name: `%TR_${this.trainer.nameKey}%` } });
        ev.push({ t: "msg", key: "game.battle.money_got", params: { n: this.trainer.prize } });
      }
      this.finish(ev, "win");
      return;
    }

    // player mon fainted
    if (this.ableCount() === 0) {
      ev.push({ t: "msg", key: "game.battle.whiteout" });
      this.finish(ev, "lose");
    }
    // otherwise UI must call replaceFainted()
  }

  private async doSwitch(partyIdx: number, ev: BattleEvent[], voluntary: boolean) {
    const target = this.party[partyIdx];
    if (!target || target.curHP <= 0) return;
    if (voluntary) {
      ev.push({ t: "msg", key: "game.battle.come_back", params: this.nameParam(this.player) });
      // switch-out abilities of the departing mon
      const out = this.player;
      if (out.mon.curHP > 0) {
        if (out.ability?.regenerator) {
          out.mon.curHP = Math.min(out.stats[0], out.mon.curHP + Math.floor(out.stats[0] / 3));
        }
        if (out.ability?.naturalCure && out.mon.status) {
          out.mon.status = null;
        }
      }
    }
    this.player = await makeBattler(target);
    ev.push({ t: "msg", key: "game.battle.switch_in", params: this.nameParam(this.player) });
    ev.push({ t: "switch", side: "player", view: this.playerView() });
    this.onSwitchIn(this.player, ev);
  }

  private async enemyActs(ev: BattleEvent[]) {
    if (this.over || this.enemy.mon.curHP <= 0) return;
    const mv = this.pickEnemyMove();
    await this.executeMove(this.enemy, this.player, mv.move, mv.idx, ev);
    if (this.player.mon.curHP <= 0) await this.handleFaint(this.player, ev);
  }

  // ------------------------------------------------------------------- ball
  private async throwBall(itemId: string, ev: BattleEvent[]) {
    const def = ITEMS[itemId];
    const ballMult = def?.ballMult ?? 1;
    ev.push({ t: "msg", key: "game.battle.threw_ball", params: { ball: `%ITEM_${itemId}%` } });
    ev.push({ t: "anim", kind: "ball_throw", side: "enemy" });
    const e = this.enemy;
    const { caught, shakes } = attemptCapture(
      e.stats[0], e.mon.curHP, e.species.cr, ballMult, statusCatchMult(e.mon.status), this.rng
    );
    for (let i = 0; i < (caught ? 3 : shakes); i++) {
      ev.push({ t: "anim", kind: "ball_shake", side: "enemy" });
    }
    if (caught) {
      ev.push({ t: "anim", kind: "catch", side: "enemy" });
      ev.push({ t: "msg", key: "game.battle.caught", params: this.nameParam(e) });
      e.mon.ball = itemId;
      this.finish(ev, "caught");
    } else {
      ev.push({ t: "anim", kind: "ball_open", side: "enemy" });
      ev.push({ t: "msg", key: shakes >= 2 ? "game.battle.almost" : "game.battle.broke_free" });
    }
  }

  private useHealItem(itemId: string, partyIdx: number, ev: BattleEvent[]) {
    const def = ITEMS[itemId];
    const mon = this.party[partyIdx];
    if (!def || !mon) return;
    const isActive = mon.uid === this.player.mon.uid;
    const battler = isActive ? this.player : null;
    const maxHp = battler ? battler.stats[0] : mon.curHP; // non-active heals capped later by store
    if (def.heal) {
      mon.curHP = Math.min(battler ? battler.stats[0] : 99999, mon.curHP + def.heal);
    }
    if (def.cure) {
      if (def.cure === "all") mon.status = null;
      else if (mon.status && (def.cure as string[]).includes(mon.status)) mon.status = null;
    }
    ev.push({ t: "anim", kind: "heal", side: "player" });
    ev.push({ t: "msg", key: "game.battle.healed", params: { name: mon.nickname ?? `%SPECIES_${mon.speciesId}%` } });
    if (isActive && battler) {
      ev.push({ t: "hp", side: "player", hp: mon.curHP, maxHp });
      ev.push({ t: "status", side: "player", status: mon.status });
    }
  }

  private finish(ev: BattleEvent[], result: BattleResult) {
    this.over = true;
    this.result = result;
    ev.push({ t: "end", result });
  }
}
