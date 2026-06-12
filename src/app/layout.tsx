import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "PokéVerse · 像素奥德赛 — Pixel Odyssey",
  description:
    "A fan-made pixel Pokémon RPG in your browser: full 1025 National Dex, authentic battles, online multiplayer, original chiptune music, five languages.",
  keywords: ["pokemon", "fan game", "pixel", "rpg", "pokedex", "宝可梦", "像素游戏"],
  manifest: "/manifest.json",
  icons: {
    icon: "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' fill='#10131c'/><circle cx='8' cy='8' r='6' fill='#e3350d'/><path d='M2 8h12v6H2z' fill='#f8f8f8'/><rect x='2' y='7' width='12' height='2' fill='#16181f'/><circle cx='8' cy='8' r='2' fill='#f8f8f8' stroke='#16181f'/></svg>`
    ),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10131c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <I18nProvider>{children}</I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
