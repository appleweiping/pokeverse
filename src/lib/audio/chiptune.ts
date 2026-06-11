/**
 * ChiptuneEngine — a tiny 4-channel "fantasy console" synthesizer.
 *
 * Channels: 2 pulse (square), 1 triangle (bass), 1 noise (drums), mirroring
 * the classic GB sound layout. Music is described as compact note strings
 * (see tracks.ts) and scheduled with the standard Web Audio look-ahead
 * pattern, so timing stays rock solid even when the tab stutters.
 *
 * All music and SFX are original compositions synthesized at runtime —
 * no copyrighted audio assets are shipped.
 */

export type Wave = "square" | "triangle" | "noise";

export interface TrackChannel {
  wave: Wave;
  vol: number;
  /** "C4:4 E4:2 -:2 K:4 S:4" — NOTE[:#]OCTAVE ":" duration-in-16ths. "-" rest. K/S/H drums. */
  notes: string;
}

export interface Track {
  bpm: number;
  channels: TrackChannel[];
  /** jingles play once instead of looping */
  once?: boolean;
}

interface ParsedNote {
  freq: number; // 0 = rest, -1 kick, -2 snare, -3 hat
  dur: number;  // in 16th steps
}

const NOTE_OFFSET: Record<string, number> = {
  C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4,
  "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2,
};

function noteFreq(token: string): number {
  // e.g. "C4", "F#3"
  const m = /^([A-G]#?)(\d)$/.exec(token);
  if (!m) return 0;
  const semis = NOTE_OFFSET[m[1]] + (Number(m[2]) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
}

function parseChannel(src: string): ParsedNote[] {
  const out: ParsedNote[] = [];
  for (const tok of src.trim().split(/\s+/)) {
    if (!tok) continue;
    const [head, durStr] = tok.split(":");
    const dur = Number(durStr ?? 1) || 1;
    if (head === "-") out.push({ freq: 0, dur });
    else if (head === "K") out.push({ freq: -1, dur });
    else if (head === "S") out.push({ freq: -2, dur });
    else if (head === "H") out.push({ freq: -3, dur });
    else out.push({ freq: noteFreq(head), dur });
  }
  return out;
}

interface ChannelState {
  parsed: ParsedNote[];
  idx: number;
  nextTime: number;
  totalSteps: number;
  cfg: TrackChannel;
}

export class ChiptuneEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private channels: ChannelState[] = [];
  private trackBpm = 120;
  private trackOnce = false;
  currentTrack: string | null = null;

  private _masterVol = 0.7;
  private _musicOn = true;
  private _sfxOn = true;
  /** registry injected from tracks.ts to avoid circular imports */
  trackRegistry: Record<string, Track> = {};

  /** Must be called from a user gesture at least once (browser autoplay). */
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._masterVol;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this._musicOn ? 1 : 0;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this._sfxOn ? 1 : 0;
      this.sfxBus.connect(this.master);
      // shared white-noise buffer for drums / sfx
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMaster(v: number) {
    this._masterVol = v;
    if (this.master) this.master.gain.value = v;
  }
  get masterVol() { return this._masterVol; }
  setMusicOn(on: boolean) {
    this._musicOn = on;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    }
  }
  get musicOn() { return this._musicOn; }
  setSfxOn(on: boolean) {
    this._sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.value = on ? 1 : 0;
  }
  get sfxOn() { return this._sfxOn; }

  // ----------------------------------------------------------------- music
  playMusic(id: string) {
    if (this.currentTrack === id) return;
    const track = this.trackRegistry[id];
    if (!track) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopMusic();
    this.currentTrack = id;
    this.trackBpm = track.bpm;
    this.trackOnce = !!track.once;
    const start = ctx.currentTime + 0.06;
    const parsedAll = track.channels.map((cfg) => parseChannel(cfg.notes));
    // pad every channel to the longest one so loops never drift apart
    const maxSteps = Math.max(...parsedAll.map((p) => p.reduce((a, n) => a + n.dur, 0)));
    this.channels = track.channels.map((cfg, i) => {
      const parsed = parsedAll[i];
      const total = parsed.reduce((a, n) => a + n.dur, 0);
      if (total < maxSteps) parsed.push({ freq: 0, dur: maxSteps - total });
      return { parsed, idx: 0, nextTime: start, totalSteps: maxSteps, cfg };
    });
    this.timer = setInterval(() => this.tick(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.currentTrack = null;
    this.channels = [];
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx) return;
    const stepDur = 60 / this.trackBpm / 4; // one 16th
    const horizon = ctx.currentTime + 0.15;
    let allDone = true;
    for (const ch of this.channels) {
      while (ch.nextTime < horizon) {
        if (ch.idx >= ch.parsed.length) {
          if (this.trackOnce) break;
          ch.idx = 0;
        }
        if (ch.idx >= ch.parsed.length) break;
        const note = ch.parsed[ch.idx];
        const dur = note.dur * stepDur;
        if (note.freq > 0) this.scheduleTone(ch.cfg.wave, note.freq, ch.nextTime, dur, ch.cfg.vol, this.musicBus!);
        else if (note.freq < 0) this.scheduleDrum(note.freq, ch.nextTime, ch.cfg.vol);
        ch.nextTime += dur;
        ch.idx++;
      }
      if (!(this.trackOnce && ch.idx >= ch.parsed.length)) allDone = false;
    }
    if (this.trackOnce && allDone) this.stopMusic();
  }

  private scheduleTone(
    wave: Wave, freq: number, t: number, dur: number, vol: number, bus: AudioNode,
    bend?: number
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave === "noise" ? "square" : wave;
    osc.frequency.setValueAtTime(freq, t);
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + bend), t + dur);
    const g = ctx.createGain();
    const a = 0.004;
    const sustain = Math.max(0.02, dur - 0.03);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + sustain * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + sustain);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private scheduleDrum(kind: number, t: number, vol: number) {
    const ctx = this.ctx!;
    if (kind === -1) {
      // kick: fast triangle pitch drop
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 1.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(this.musicBus!);
      osc.start(t); osc.stop(t + 0.13);
    } else {
      // snare (-2) / hat (-3): filtered noise burst
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = kind === -2 ? "bandpass" : "highpass";
      f.frequency.value = kind === -2 ? 1800 : 7000;
      const g = ctx.createGain();
      const decay = kind === -2 ? 0.1 : 0.04;
      g.gain.setValueAtTime(vol * (kind === -2 ? 1.1 : 0.6), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + decay);
      src.connect(f); f.connect(g); g.connect(this.musicBus!);
      src.start(t); src.stop(t + decay + 0.02);
    }
  }

  // ------------------------------------------------------------------- sfx
  /** Play a short synthesized effect by name. */
  sfx(name: SfxName) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + 0.01;
    const tone = (
      freq: number, dur: number, opts: { wave?: Wave; vol?: number; at?: number; to?: number } = {}
    ) => {
      const osc = ctx.createOscillator();
      osc.type = (opts.wave ?? "square") as OscillatorType;
      const start = t + (opts.at ?? 0);
      osc.frequency.setValueAtTime(freq, start);
      if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), start + dur);
      const g = ctx.createGain();
      const v = opts.vol ?? 0.35;
      g.gain.setValueAtTime(v, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(g); g.connect(this.sfxBus!);
      osc.start(start); osc.stop(start + dur + 0.03);
    };
    const noise = (dur: number, freq: number, opts: { vol?: number; at?: number; type?: BiquadFilterType } = {}) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = opts.type ?? "bandpass";
      f.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + (opts.at ?? 0);
      g.gain.setValueAtTime(opts.vol ?? 0.4, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxBus!);
      src.start(start); src.stop(start + dur + 0.02);
    };

    switch (name) {
      case "move": tone(880, 0.05, { vol: 0.18 }); break;
      case "select": tone(660, 0.05, { vol: 0.22 }); tone(990, 0.07, { at: 0.05, vol: 0.22 }); break;
      case "cancel": tone(440, 0.06, { vol: 0.2 }); tone(330, 0.08, { at: 0.05, vol: 0.2 }); break;
      case "bump": tone(90, 0.08, { wave: "triangle", vol: 0.4 }); break;
      case "door": tone(220, 0.1, { wave: "triangle", vol: 0.3, to: 110 }); break;
      case "hit": noise(0.12, 900); tone(160, 0.1, { wave: "triangle", vol: 0.3, to: 90 }); break;
      case "hit_super": noise(0.2, 500, { vol: 0.5 }); tone(120, 0.18, { wave: "triangle", vol: 0.45, to: 50 }); break;
      case "hit_weak": noise(0.07, 1500, { vol: 0.25 }); break;
      case "ball_throw": tone(300, 0.22, { vol: 0.25, to: 900 }); break;
      case "ball_open": noise(0.18, 3000, { vol: 0.35, type: "highpass" }); tone(523, 0.12, { at: 0.02, vol: 0.2 }); break;
      case "ball_shake": tone(180, 0.06, { wave: "triangle", vol: 0.4 }); tone(140, 0.05, { at: 0.07, wave: "triangle", vol: 0.3 }); break;
      case "catch": tone(523, 0.09, { vol: 0.25 }); tone(392, 0.2, { at: 0.1, vol: 0.25 }); break;
      case "run": tone(700, 0.16, { vol: 0.25, to: 200 }); break;
      case "faint": tone(330, 0.3, { vol: 0.3, to: 60 }); break;
      case "exp": tone(1046, 0.04, { vol: 0.15 }); break;
      case "heal": [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.09, { at: i * 0.09, vol: 0.22 })); break;
      case "levelup": [523, 659, 784, 880, 1046].forEach((f, i) => tone(f, 0.07, { at: i * 0.06, vol: 0.22 })); break;
      case "save": tone(784, 0.08, { vol: 0.2 }); tone(1175, 0.16, { at: 0.09, vol: 0.2 }); break;
      case "encounter": tone(200, 0.3, { vol: 0.3, to: 1200 }); noise(0.25, 2000, { vol: 0.2 }); break;
      case "evolve": [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.1, { at: i * 0.08, vol: 0.2 })); break;
      case "badge": [659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.12, { at: i * 0.1, vol: 0.25 })); break;
      case "buy": tone(988, 0.05, { vol: 0.22 }); tone(1319, 0.09, { at: 0.05, vol: 0.22 }); break;
      case "stat_up": tone(440, 0.05, { vol: 0.2 }); tone(554, 0.05, { at: 0.05, vol: 0.2 }); tone(659, 0.08, { at: 0.1, vol: 0.2 }); break;
      case "stat_down": tone(659, 0.05, { vol: 0.2 }); tone(554, 0.05, { at: 0.05, vol: 0.2 }); tone(440, 0.08, { at: 0.1, vol: 0.2 }); break;
    }
  }

  /** Play a Pokémon cry from the CDN through the sfx bus (with fallback beep). */
  cry(url: string, volume = 0.5) {
    const ctx = this.ensure();
    if (!ctx) return;
    const el = new Audio(url);
    el.crossOrigin = "anonymous";
    el.volume = Math.min(1, volume * this._masterVol * (this._sfxOn ? 1 : 0));
    void el.play().catch(() => this.sfx("hit"));
  }
}

export type SfxName =
  | "move" | "select" | "cancel" | "bump" | "door"
  | "hit" | "hit_super" | "hit_weak"
  | "ball_throw" | "ball_open" | "ball_shake" | "catch"
  | "run" | "faint" | "exp" | "heal" | "levelup" | "save"
  | "encounter" | "evolve" | "badge" | "buy" | "stat_up" | "stat_down";

/** Singleton used across the whole app (website + game). */
export const audio = new ChiptuneEngine();
