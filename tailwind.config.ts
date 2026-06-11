import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Official-ish Pokémon type palette, used across site + game UI
        type: {
          normal: "#A8A77A",
          fire: "#EE8130",
          water: "#6390F0",
          electric: "#F7D02C",
          grass: "#7AC74C",
          ice: "#96D9D6",
          fighting: "#C22E28",
          poison: "#A33EA1",
          ground: "#E2BF65",
          flying: "#A98FF3",
          psychic: "#F95587",
          bug: "#A6B91A",
          rock: "#B6A136",
          ghost: "#735797",
          dragon: "#6F35FC",
          dark: "#705746",
          steel: "#B7B7CE",
          fairy: "#D685AD",
        },
        ink: "#10131c",
        panel: "#181d2c",
        glow: "#ffcb05",
        pokeblue: "#3466af",
        pokered: "#e3350d",
      },
      fontFamily: {
        pixel: ["var(--font-pixel)", "ui-monospace", "monospace"],
        pixelcjk: ["var(--font-pixel)", "var(--font-pixel-cjk)", "ui-monospace", "monospace"],
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        scanline: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100vh)" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        pop: { "0%": { transform: "scale(0)" }, "80%": { transform: "scale(1.15)" }, "100%": { transform: "scale(1)" } },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px) rotate(-4deg)" },
          "40%": { transform: "translateX(6px) rotate(4deg)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        risefade: {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowpulse: {
          "0%,100%": { boxShadow: "0 0 20px rgba(255,203,5,.25)" },
          "50%": { boxShadow: "0 0 44px rgba(255,203,5,.55)" },
        },
        spinslow: { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        blink: "blink 1.1s step-end infinite",
        scanline: "scanline 7s linear infinite",
        marquee: "marquee 30s linear infinite",
        pop: "pop .35s cubic-bezier(.2,1.6,.4,1) both",
        shake: "shake .45s ease-in-out",
        risefade: "risefade .7s ease-out both",
        glowpulse: "glowpulse 2.6s ease-in-out infinite",
        spinslow: "spinslow 14s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
