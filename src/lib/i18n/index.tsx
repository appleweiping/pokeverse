"use client";
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { Locale } from "../data/dex";
import zhCN from "./locales/zh-CN";
import zhTW from "./locales/zh-TW";
import en from "./locales/en";
import ja from "./locales/ja";
import ko from "./locales/ko";

export type Dict = { [key: string]: string | Dict };

const DICTS: Record<Locale, Dict> = { "zh-CN": zhCN, "zh-TW": zhTW, en, ja, ko };

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

function lookup(dict: Dict, path: string): string | undefined {
  let cur: string | Dict | undefined = dict;
  for (const part of path.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  let s = lookup(DICTS[locale], key) ?? lookup(DICTS["zh-CN"], key) ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Non-React access (game engine, audio, canvas code). The provider keeps this
// module-level mirror in sync so plain TS modules can translate too.
// ---------------------------------------------------------------------------
let _current: Locale = "zh-CN";
export function currentLocale(): Locale {
  return _current;
}
export function tr(key: string, params?: Record<string, string | number>): string {
  return translate(_current, key, params);
}

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>({
  locale: "zh-CN",
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("pv.locale") as Locale | null) : null;
    if (saved && DICTS[saved]) {
      setLocaleState(saved);
      _current = saved;
      return;
    }
    const nav = (navigator.language || "zh-CN").toLowerCase();
    let detected: Locale = "en";
    if (nav.startsWith("zh")) {
      detected = nav.includes("tw") || nav.includes("hk") || nav.includes("hant") ? "zh-TW" : "zh-CN";
    } else if (nav.startsWith("ja")) detected = "ja";
    else if (nav.startsWith("ko")) detected = "ko";
    setLocaleState(detected);
    _current = detected;
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    _current = l;
    try {
      localStorage.setItem("pv.locale", l);
      document.documentElement.lang = l;
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
