"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "vi" | "en";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tr: (vi: string, en: string) => string;
  dateLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("vi");

  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem("limgrow-locale"); } catch { /* Private or restricted browsing context. */ }
    const next = saved === "en" || saved === "vi" ? saved : navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
    document.documentElement.lang = next;
    const timer = window.setTimeout(() => setLocaleState(next), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try { window.localStorage.setItem("limgrow-locale", next); } catch { /* Locale still works for this session. */ }
    document.documentElement.lang = next;
  };

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    tr: (vi, en) => locale === "vi" ? vi : en,
    dateLocale: locale === "vi" ? "vi-VN" : "en-US",
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className="inline-flex rounded-lg border border-current/15 bg-current/5 p-0.5" role="group" aria-label="Language / Ngôn ngữ">
      {(["vi", "en"] as const).map((item) => (
        <button
          type="button"
          key={item}
          onClick={() => setLocale(item)}
          aria-pressed={locale === item}
          className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase transition ${locale === item ? "bg-white text-[#130b5c] shadow-sm" : "opacity-65 hover:opacity-100"}`}
        >
          {compact ? item : item === "vi" ? "Tiếng Việt" : "English"}
        </button>
      ))}
    </div>
  );
}
