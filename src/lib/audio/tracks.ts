import { audio, type Track } from "./chiptune";

/**
 * Original chiptune compositions for PokéVerse. Notation: `NOTE[#]OCT:16ths`,
 * `-` = rest, `K/S/H` = kick/snare/hat. Channels are padded by the engine to
 * the longest channel so loops stay phase-aligned.
 *
 * Every melody here is an original composition written for this project.
 */
export const TRACKS: Record<string, Track> = {
  // ======================================================== TITLE (C major, heroic)
  title: {
    bpm: 138,
    channels: [
      {
        wave: "square", vol: 0.2,
        notes: `
G4:2 C5:2 E5:4 G5:4 E5:4
D5:2 G4:2 B4:4 D5:4 G5:2 F5:2
E5:4 C5:4 A4:4 C5:4
A4:2 C5:2 F5:4 A5:4 G5:2 F5:2
G4:2 C5:2 E5:4 G5:4 C6:4
B5:4 G5:4 D5:4 G5:4
A5:4 F5:4 G5:4 B5:4
C6:8 G5:4 E5:4`,
      },
      {
        wave: "square", vol: 0.1,
        notes: `
C4:2 E4:2 G4:2 E4:2 C4:2 E4:2 G4:2 E4:2
B3:2 D4:2 G4:2 D4:2 B3:2 D4:2 G4:2 D4:2
A3:2 C4:2 E4:2 C4:2 A3:2 C4:2 E4:2 C4:2
A3:2 C4:2 F4:2 C4:2 A3:2 C4:2 F4:2 C4:2
C4:2 E4:2 G4:2 E4:2 C4:2 E4:2 G4:2 E4:2
B3:2 D4:2 G4:2 D4:2 B3:2 D4:2 G4:2 D4:2
A3:2 C4:2 F4:2 C4:2 B3:2 D4:2 G4:2 D4:2
C4:2 E4:2 G4:2 E4:2 C4:2 E4:2 G4:4`,
      },
      {
        wave: "triangle", vol: 0.5,
        notes: `
C3:4 C3:4 G2:4 C3:4
G2:4 G2:4 D3:4 G2:4
A2:4 A2:4 E3:4 A2:4
F2:4 F2:4 C3:4 F2:4
C3:4 C3:4 G2:4 C3:4
G2:4 G2:4 B2:4 D3:4
F2:4 F2:4 G2:4 G2:4
C3:4 G2:4 C3:8`,
      },
      {
        wave: "noise", vol: 0.4,
        notes: `
K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4
K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 S:4 K:2 K:2 S:4`,
      },
    ],
  },

  // ======================================================== TOWN (F major, gentle)
  town: {
    bpm: 104,
    channels: [
      {
        wave: "square", vol: 0.18,
        notes: `
A4:4 C5:4 A4:4 F4:4
D5:4 F5:4 D5:2 C5:2 A4:4
A4:4 C5:2 A4:2 F4:4 G4:4
G4:4 E4:4 G4:4 C5:4
A4:4 C5:4 F5:4 C5:4
D5:4 F5:2 D5:2 A#4:4 C5:4
G4:2 A4:2 G4:4 E4:4 G4:4
F4:12 -:4`,
      },
      {
        wave: "triangle", vol: 0.45,
        notes: `
F2:8 C3:8
A#2:8 F3:8
F2:8 C3:8
C3:8 G3:8
F2:8 C3:8
A#2:8 F3:8
C3:8 G2:8
F2:16`,
      },
      {
        wave: "noise", vol: 0.18,
        notes: `H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4
H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 -:8`,
      },
    ],
  },

  // ======================================================== ROUTE (G major, upbeat)
  route: {
    bpm: 132,
    channels: [
      {
        wave: "square", vol: 0.2,
        notes: `
D5:2 G5:2 G5:2 A5:2 B5:4 A5:2 G5:2
E5:2 G5:2 G5:4 A5:2 G5:2 E5:2 C5:2
D5:2 G5:2 B5:2 G5:2 D5:2 B4:2 D5:4
A4:2 D5:2 F#5:2 D5:2 A5:4 F#5:2 D5:2
G5:2 B5:2 D6:4 B5:2 G5:2 B5:4
C6:4 B5:2 A5:2 G5:4 E5:4
A5:2 C6:2 A5:2 F#5:2 A5:2 F#5:2 D5:4
G5:8 D5:4 G4:4`,
      },
      {
        wave: "square", vol: 0.09,
        notes: `
G3:2 B3:2 D4:2 B3:2 G3:2 B3:2 D4:2 B3:2
C4:2 E4:2 G4:2 E4:2 C4:2 E4:2 G4:2 E4:2
G3:2 B3:2 D4:2 B3:2 G3:2 B3:2 D4:2 B3:2
A3:2 D4:2 F#4:2 D4:2 A3:2 D4:2 F#4:2 D4:2
G3:2 B3:2 D4:2 B3:2 G3:2 B3:2 D4:2 B3:2
C4:2 E4:2 G4:2 E4:2 C4:2 E4:2 G4:2 E4:2
A3:2 C4:2 E4:2 C4:2 A3:2 D4:2 F#4:2 D4:2
G3:2 B3:2 D4:2 B3:2 G3:2 B3:2 D4:4`,
      },
      {
        wave: "triangle", vol: 0.5,
        notes: `
G2:4 G2:4 D3:4 G2:4
C3:4 C3:4 G2:4 C3:4
G2:4 G2:4 D3:4 G2:4
D3:4 D3:4 A2:4 D3:4
G2:4 G2:4 D3:4 G2:4
C3:4 C3:4 G2:4 C3:4
A2:4 A2:4 D3:4 D3:4
G2:4 D3:4 G2:8`,
      },
      {
        wave: "noise", vol: 0.35,
        notes: `K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4
K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 S:4 K:4 S:4`,
      },
    ],
  },

  // ======================================================== WILD BATTLE (A minor, driving)
  battle_wild: {
    bpm: 168,
    channels: [
      {
        wave: "square", vol: 0.2,
        notes: `
A5:1 G#5:1 G5:1 F#5:1 F5:1 E5:1 D#5:1 D5:1 C#5:1 C5:1 B4:1 A#4:1 A4:1 G#4:1 G4:1 F#4:1
E5:2 A4:2 E5:2 A4:2 F5:2 A4:2 F5:2 A4:2
E5:2 A4:2 E5:2 A4:2 G5:2 A4:2 G5:2 A4:2
A5:4 G5:2 F5:2 E5:4 D5:2 E5:2
F5:2 C5:2 F5:2 C5:2 G5:2 C5:2 G5:2 C5:2
A5:2 E5:2 A5:2 E5:2 B5:2 E5:2 B5:2 E5:2
C6:4 B5:2 A5:2 G5:4 E5:2 G5:2
A5:2 E5:2 C5:2 E5:2 A4:8`,
      },
      {
        wave: "triangle", vol: 0.55,
        notes: `
A2:2 A2:2 A2:2 A2:2 A2:2 A2:2 A2:2 A2:2
A2:2 A2:2 A2:2 A2:2 F2:2 F2:2 F2:2 F2:2
A2:2 A2:2 A2:2 A2:2 G2:2 G2:2 G2:2 G2:2
A2:2 A2:2 G2:2 G2:2 F2:2 F2:2 E2:2 E2:2
F2:2 F2:2 F2:2 F2:2 C3:2 C3:2 C3:2 C3:2
A2:2 A2:2 A2:2 A2:2 E3:2 E3:2 E3:2 E3:2
C3:2 C3:2 B2:2 B2:2 A2:2 A2:2 E2:2 E2:2
A2:2 E2:2 A2:2 E2:2 A2:8`,
      },
      {
        wave: "noise", vol: 0.4,
        notes: `K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2
K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2
K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2
K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 S:2 K:2 S:2 K:2 K:2 S:4`,
      },
    ],
  },

  // ======================================================== TRAINER BATTLE (C minor)
  battle_trainer: {
    bpm: 172,
    channels: [
      {
        wave: "square", vol: 0.2,
        notes: `
C6:1 B5:1 A#5:1 A5:1 G#5:1 G5:1 F#5:1 F5:1 E5:1 D#5:1 D5:1 C#5:1 C5:4
D#5:2 G5:2 C6:2 G5:2 D#5:2 G5:2 C6:2 G5:2
D5:2 F5:2 A#5:2 F5:2 D5:2 F5:2 A#5:2 F5:2
C6:4 A#5:2 G#5:2 G5:4 F5:2 D5:2
G#5:2 C6:2 G#5:2 F5:2 G5:2 C6:2 G5:2 D#5:2
F5:2 A#5:2 F5:2 D5:2 D#5:2 G5:2 D#5:2 C5:2
G5:4 G#5:4 A#5:4 B5:4
C6:8 G5:4 C5:4`,
      },
      {
        wave: "triangle", vol: 0.55,
        notes: `
C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2
C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2
A#2:2 A#2:2 A#2:2 A#2:2 A#2:2 A#2:2 A#2:2 A#2:2
G2:2 G2:2 G2:2 G2:2 G2:2 G2:2 G2:2 G2:2
G#2:2 G#2:2 G#2:2 G#2:2 G#2:2 G#2:2 G#2:2 G#2:2
A#2:2 A#2:2 A#2:2 A#2:2 A#2:2 A#2:2 A#2:2 A#2:2
G2:4 G#2:4 A#2:4 B2:4
C3:2 G2:2 C3:2 G2:2 C3:8`,
      },
      {
        wave: "noise", vol: 0.4,
        notes: `K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2
K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2
K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2
K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 S:2 K:2 S:2 K:2 S:2 K:2 S:2`,
      },
    ],
  },

  // ======================================================== GYM (E minor, tense)
  gym: {
    bpm: 152,
    channels: [
      {
        wave: "square", vol: 0.19,
        notes: `
E5:2 E5:2 G5:2 E5:2 B5:2 E5:2 G5:2 E5:2
D5:2 D5:2 F#5:2 D5:2 A5:2 D5:2 F#5:2 D5:2
C5:2 C5:2 E5:2 C5:2 G5:2 C5:2 E5:2 C5:2
B4:2 D5:2 F#5:2 B5:2 A5:2 F#5:2 D5:2 B4:2`,
      },
      {
        wave: "triangle", vol: 0.55,
        notes: `
E2:2 E2:2 E3:2 E2:2 E2:2 E3:2 E2:2 E2:2
D2:2 D2:2 D3:2 D2:2 D2:2 D3:2 D2:2 D2:2
C2:2 C2:2 C3:2 C2:2 C2:2 C3:2 C2:2 C2:2
B1:2 B1:2 B2:2 B1:2 B1:2 B2:2 B1:2 B1:2`,
      },
      {
        wave: "noise", vol: 0.38,
        notes: `K:2 H:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 H:2 S:2 H:2
K:2 H:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 S:2 S:2 S:2`,
      },
    ],
  },

  // ======================================================== FOREST (E dorian, mysterious)
  forest: {
    bpm: 100,
    channels: [
      {
        wave: "square", vol: 0.16,
        notes: `
E4:4 G4:4 A4:4 B4:4
C5:4 B4:4 A4:2 G4:2 E4:4
E4:4 G4:4 A4:2 B4:2 D5:4
E5:8 B4:4 G4:4`,
      },
      {
        wave: "square", vol: 0.08,
        notes: `
E3:2 G3:2 B3:2 G3:2 E3:2 G3:2 B3:2 G3:2
A3:2 C4:2 E4:2 C4:2 A3:2 C4:2 E4:2 C4:2
E3:2 G3:2 B3:2 G3:2 E3:2 G3:2 B3:2 G3:2
E3:2 G3:2 B3:2 G3:2 B3:2 F#3:2 B3:2 F#3:2`,
      },
      {
        wave: "triangle", vol: 0.45,
        notes: `E2:8 E2:8 A2:8 A2:8 E2:8 E2:8 E2:8 B2:8`,
      },
      {
        wave: "noise", vol: 0.14,
        notes: `H:4 -:4 H:4 -:4 H:4 -:4 H:4 -:4 H:4 -:4 H:4 -:4 H:4 -:4 H:2 H:2 -:4`,
      },
    ],
  },

  // ======================================================== CAVE (chromatic, eerie)
  cave: {
    bpm: 88,
    channels: [
      {
        wave: "square", vol: 0.13,
        notes: `
C4:4 D#4:4 F#4:4 A4:4
G#4:4 F#4:4 D#4:4 C4:4
C#4:4 E4:4 G4:4 A#4:4
C4:8 -:8`,
      },
      {
        wave: "triangle", vol: 0.5,
        notes: `C2:8 C2:8 C2:8 G1:8 C#2:8 C#2:8 C2:16`,
      },
      {
        wave: "noise", vol: 0.1,
        notes: `-:8 H:2 -:6 -:8 H:2 -:6 -:8 H:2 -:6 -:16`,
      },
    ],
  },

  // ======================================================== POKÉMON CENTER (A major, cozy)
  center: {
    bpm: 116,
    channels: [
      {
        wave: "square", vol: 0.17,
        notes: `
C#5:2 E5:2 A5:4 E5:2 C#5:2 E5:4
D5:2 F#5:2 A5:4 F#5:2 D5:2 F#5:4
C#5:2 E5:2 A5:4 B5:2 A5:2 E5:4
D5:2 C#5:2 B4:4 A4:8`,
      },
      {
        wave: "triangle", vol: 0.45,
        notes: `
A2:4 E3:4 A2:4 E3:4
D3:4 A3:4 D3:4 A3:4
A2:4 E3:4 A2:4 E3:4
E3:4 E3:4 A2:8`,
      },
      {
        wave: "noise", vol: 0.12,
        notes: `H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 H:4 -:8`,
      },
    ],
  },

  // ======================================================== VICTORY (C major fanfare)
  victory: {
    bpm: 144,
    channels: [
      {
        wave: "square", vol: 0.2,
        notes: `
G5:2 G5:2 G5:4 E5:2 F5:2 G5:4
A5:2 G5:2 F5:4 E5:4 D5:2 E5:2
C5:2 E5:2 G5:2 C6:2 B5:2 A5:2 G5:2 F5:2
E5:4 G5:4 C6:8`,
      },
      {
        wave: "square", vol: 0.1,
        notes: `
E4:2 E4:2 E4:4 C4:2 D4:2 E4:4
F4:2 E4:2 D4:4 C4:4 B3:2 C4:2
E4:2 G4:2 E4:2 G4:2 G4:2 F4:2 E4:2 D4:2
C4:4 E4:4 E4:8`,
      },
      {
        wave: "triangle", vol: 0.5,
        notes: `
C3:4 G2:4 C3:4 G2:4
F2:4 C3:4 G2:4 C3:4
C3:4 C3:4 G2:4 G2:4
C3:4 G2:4 C3:8`,
      },
      {
        wave: "noise", vol: 0.35,
        notes: `K:4 S:4 K:4 S:4 K:4 S:4 K:4 S:4 K:4 S:4 K:2 K:2 S:4 K:4 S:4 K:8`,
      },
    ],
  },

  // ======================================================== THUNDER CITY (D major, buzzing energy)
  thunder: {
    bpm: 126,
    channels: [
      {
        wave: "square", vol: 0.19,
        notes: `
D5:2 F#5:2 A5:4 F#5:2 D5:2 A5:4
E5:2 G5:2 B5:4 G5:2 E5:2 B4:4
D5:2 F#5:2 A5:4 B5:2 A5:2 F#5:4
G5:4 F#5:4 E5:4 D5:4`,
      },
      {
        wave: "square", vol: 0.09,
        notes: `
D4:2 F#4:2 A4:2 F#4:2 D4:2 F#4:2 A4:2 F#4:2
E4:2 G4:2 B4:2 G4:2 E4:2 G4:2 B4:2 G4:2
D4:2 F#4:2 A4:2 F#4:2 D4:2 F#4:2 A4:2 F#4:2
G4:2 B4:2 D5:2 B4:2 A4:2 C#5:2 E5:2 C#5:2`,
      },
      {
        wave: "triangle", vol: 0.5,
        notes: `
D3:4 A2:4 D3:4 A2:4
E3:4 B2:4 E3:4 B2:4
D3:4 A2:4 D3:4 A2:4
G2:4 G2:4 A2:4 A2:4`,
      },
      {
        wave: "noise", vol: 0.32,
        notes: `K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 H:4 S:4 H:4 K:4 S:4 K:4 S:4`,
      },
    ],
  },

  // ======================================================== TEAM AURORA (B minor, menacing)
  aurora: {
    bpm: 156,
    channels: [
      {
        wave: "square", vol: 0.2,
        notes: `
B4:2 B4:2 D5:2 B4:2 F5:2 E5:2 D5:2 C#5:2
B4:2 B4:2 D5:2 F#5:2 G5:4 F#5:2 E5:2
A#4:2 A#4:2 C#5:2 A#4:2 E5:2 D5:2 C#5:2 B4:2
B4:4 C#5:4 D5:4 A#4:4`,
      },
      {
        wave: "square", vol: 0.08,
        notes: `
B3:2 D4:2 F#4:2 D4:2 B3:2 D4:2 F#4:2 D4:2
B3:2 D4:2 G4:2 D4:2 B3:2 D4:2 G4:2 D4:2
A#3:2 C#4:2 F#4:2 C#4:2 A#3:2 C#4:2 F#4:2 C#4:2
B3:2 D4:2 F#4:2 D4:2 A#3:2 C#4:2 F#4:2 C#4:2`,
      },
      {
        wave: "triangle", vol: 0.55,
        notes: `
B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2
G2:2 G2:2 G2:2 G2:2 G2:2 G2:2 G2:2 G2:2
E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2
F#2:2 F#2:2 F#2:2 F#2:2 F#2:2 F#2:2 F#2:2 F#2:2`,
      },
      {
        wave: "noise", vol: 0.38,
        notes: `K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2
K:2 K:2 S:2 H:2 K:2 H:2 S:2 H:2 K:2 K:2 S:2 H:2 K:2 S:2 S:2 S:2`,
      },
    ],
  },

  // ======================================================== EVOLUTION (rising)
  evolution: {
    bpm: 132,
    channels: [
      {
        wave: "square", vol: 0.18,
        notes: `
C5:2 E5:2 G5:2 C6:2 D5:2 F#5:2 A5:2 D6:2
E5:2 G#5:2 B5:2 E6:2 G5:2 B5:2 D6:2 G6:2`,
      },
      {
        wave: "triangle", vol: 0.5,
        notes: `C3:8 D3:8 E3:8 G3:8`,
      },
      {
        wave: "noise", vol: 0.2,
        notes: `H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2 H:2`,
      },
    ],
  },
};

// register into the singleton engine
audio.trackRegistry = TRACKS;

export { audio };
