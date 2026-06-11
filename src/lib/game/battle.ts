import type { DexEntry, MajorStatus, Mon, MoveData, StatStageKey } from "../types";
import { effectiveness } from "../data/typechart";
import { accStageMult, attemptCapture, expGain, stageMult, statusCatchMult } from "../data/formulas";
import { getMoveMap, getSpecies } from "../data/dex";
import { applyExp, statsOf } from "./factory";
import { ITEMS } from "./items";

// ---------------------------------------------------------------------------
// Battle events — the UI replays these sequentially with animations.
// ---------------------------------------------------------------------------

export type BattleEvent =
  | { t: "msg"; key: string; params?: Record<string, string | number> }
  | { t: "anim"; kind: "attack" | "hit" | "hit_super" | "hit_weak" | "faint" | "ball_throw" | "ball_shake" | "ball_open" | "catch" | "heal" | "stat_up" | "stat_down"; side: Side }
  | { t: "hp"; side: Side; hp: number; maxHp: number }
  | { t: "status"; side: Side; status: MajorStatus | null }
  | { t: "exp"; exp: number; toNext: number; pct: number }
  | { t: "level"; level: number }
  | { t: "switch"; side: Side; view: BattlerPublicView }
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
  private moveMap!: Map<number, MoveData>;

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
    opts: { trainer?: TrainerInfo; rng?: () => number } = {}
  ): Promise<BattleSession> {
    const s = new BattleSession(kind, party, enemyParty, opts.rng ?? Math.random, opts.trainer);
    s.moveMap = await getMoveMap();
    const firstAble = party.findIndex((m) => m.curHP > 0);
    s.player = await makeBattler(party[Math.max(0, firstAble)]);
    s.enemy = await makeBattler(enemyParty[0]);
    return s;
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
    const pSpe = this.player.stats[5] * stageMult(this.player.stages.spe) * (this.player.mon.status === "par" ? 0.5 : 1);
    const eSpe = this.enemy.stats[5] * stageMult(this.enemy.stages.spe) * (this.enemy.mon.status === "par" ? 0.5 : 1);
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
    return ev;
  }

  /**
   * PvP turn: both move choices supplied externally (online battles run the
   * same deterministic session on both peers with a shared RNG seed).
   */
  async pvpTurn(playerMoveIdx: number, enemyMoveIdx: number): Promise<BattleEvent[]> {
    const ev: BattleEvent[] = [];
    if (this.over) return ev;
    const pMove = this.resolveMoveChoice(this.player, playerMoveIdx);
    const eMove = this.resolveEnemyMoveChoice(enemyMoveIdx);
    const pSpe = this.player.stats[5] * stageMult(this.player.stages.spe) * (this.player.mon.status === "par" ? 0.5 : 1);
    const eSpe = this.enemy.stats[5] * stageMult(this.enemy.stages.spe) * (this.enemy.mon.status === "par" ? 0.5 : 1);
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
      if (def.mon.curHP <= 0 || att.mon.curHP <= 0) {
        this.resolvePvpFaint(ev);
        if (this.over) break;
      }
    }
    if (!this.over) {
      this.pvpEndOfTurn(ev);
    }
    return ev;
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

  /** 1v1 PvP faint check: whoever drops to 0 ends the battle. */
  private resolvePvpFaint(ev: BattleEvent[]) {
    if (this.enemy.mon.curHP <= 0) {
      ev.push({ t: "anim", kind: "faint", side: "enemy" });
      ev.push({ t: "msg", key: "game.battle.enemy_fainted", params: this.nameParam(this.enemy) });
      this.finish(ev, "win");
    } else if (this.player.mon.curHP <= 0) {
      ev.push({ t: "anim", kind: "faint", side: "player" });
      ev.push({ t: "msg", key: "game.battle.fainted", params: this.nameParam(this.player) });
      this.finish(ev, "lose");
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

  private async executeMove(att: Battler, def: Battler, move: MoveData, moveIdx: number, ev: BattleEvent[]) {
    const isPlayer = att === this.player;
    const who = this.nameParam(att);

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

    // --- accuracy
    if (move.a > 0) {
      const acc = (move.a / 100) * accStageMult(att.stages.acc) / accStageMult(def.stages.eva);
      if (this.rng() > acc) {
        ev.push({ t: "msg", key: "game.battle.missed" });
        return;
      }
    }

    const defSide: Side = def === this.player ? "player" : "enemy";

    if (move.c === 2) {
      // ------- status move
      this.applyMoveEffects(att, def, move, ev, 0, true);
      return;
    }

    // ------- damaging move
    const eff = effectiveness(move.t, def.species.t);
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
    for (let h = 0; h < hits && def.mon.curHP > 0; h++) {
      const { dmg, crit } = this.computeDamage(att, def, { move });
      total += dmg;
      lastCrit = crit;
      this.dealDamage(def, dmg, ev);
    }
    ev.push({
      t: "anim",
      kind: eff > 1 ? "hit_super" : eff < 1 ? "hit_weak" : "hit",
      side: defSide,
    });
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

    if (def.mon.curHP > 0) this.applyMoveEffects(att, def, move, ev, total, false);
  }

  private computeDamage(
    att: Battler,
    def: Battler,
    src: { move?: MoveData; power?: number; phys?: boolean; typeless?: boolean }
  ): { dmg: number; crit: boolean } {
    const move = src.move;
    const power = move ? move.p : src.power ?? 40;
    if (power <= 0) return { dmg: 0, crit: false };
    const phys = move ? move.c === 0 : !!src.phys;
    const L = att.mon.level;
    const critChance = move?.m?.crit ? 1 / 8 : 1 / 24;
    const crit = !src.typeless && this.rng() < critChance;
    let aStage = phys ? att.stages.atk : att.stages.spa;
    let dStage = phys ? def.stages.def : def.stages.spd;
    if (crit) { aStage = Math.max(0, aStage); dStage = Math.min(0, dStage); }
    const A = att.stats[phys ? 1 : 3] * stageMult(aStage);
    const D = Math.max(1, def.stats[phys ? 2 : 4] * stageMult(dStage));
    let dmg = Math.floor(Math.floor((Math.floor((2 * L) / 5 + 2) * power * A) / D) / 50) + 2;
    if (!src.typeless && move) {
      if (att.species.t.includes(move.t)) dmg *= 1.5; // STAB
      dmg *= effectiveness(move.t, def.species.t);
    }
    if (crit) dmg *= 1.5;
    if (phys && att.mon.status === "brn") dmg *= 0.5;
    dmg *= 0.85 + this.rng() * 0.15;
    return { dmg: Math.max(1, Math.floor(dmg)), crit };
  }

  private dealDamage(def: Battler, dmg: number, ev: BattleEvent[]) {
    def.mon.curHP = Math.max(0, def.mon.curHP - dmg);
    ev.push({
      t: "hp",
      side: def === this.player ? "player" : "enemy",
      hp: def.mon.curHP,
      maxHp: def.stats[0],
    });
  }

  private applyMoveEffects(att: Battler, def: Battler, move: MoveData, ev: BattleEvent[], dealt: number, isStatusMove: boolean) {
    const m = move.m;
    if (!m) return;
    const who = (b: Battler) => this.nameParam(b);

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
      const chance = isStatusMove ? (m.ailCh || 100) : m.ailCh || 0;
      if (chance > 0 && this.rng() * 100 < chance) {
        this.applyAilment(def, m.ail, ev);
      }
    }

    // flinch
    if (m.flinch && dealt > 0 && this.rng() * 100 < m.flinch) {
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
    if (def.mon.status) return; // already has a major status
    const t = def.species.t;
    let status: MajorStatus | null = null;
    if (ail === "paralysis" && !t.includes("electric")) status = "par";
    else if (ail === "burn" && !t.includes("fire")) status = "brn";
    else if (ail === "poison" && !t.includes("poison") && !t.includes("steel")) status = "psn";
    else if (ail === "sleep") status = "slp";
    else if (ail === "freeze" && !t.includes("ice")) status = "frz";
    if (!status) return;
    def.mon.status = status;
    if (status === "slp") def.sleepTurns = 1 + Math.floor(this.rng() * 3);
    if (status === "psn") def.toxicN = 1;
    ev.push({ t: "msg", key: `game.battle.${status}_inflict`, params: who });
    ev.push({ t: "status", side, status });
  }

  // -------------------------------------------------------------- end of turn
  private endOfTurn(ev: BattleEvent[]) {
    if (this.over) return;
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
      // exp for the active player mon
      const gain = expGain(b.species.be, b.mon.level, this.kind === "trainer");
      const p = this.player;
      if (p.mon.curHP > 0 && p.mon.level < 100) {
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
    }
    this.player = await makeBattler(target);
    ev.push({ t: "msg", key: "game.battle.switch_in", params: this.nameParam(this.player) });
    ev.push({ t: "switch", side: "player", view: this.playerView() });
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
