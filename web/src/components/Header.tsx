"use client";

import React from "react";
import { Language } from "@/types";
import { translations } from "@/lib/translations";
import { Disc3, Sliders, ShieldCheck, BookOpen, Sparkles, Globe } from "lucide-react";

interface HeaderProps {
  currentTab: "studio" | "presets" | "inspector" | "guide";
  onTabChange: (tab: "studio" | "presets" | "inspector" | "guide") => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  lang,
  onLangChange,
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2.5 md:py-0 md:h-16 gap-2 md:gap-0">
          {/* Top row on mobile: Logo + Language Switcher */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div
              className="flex items-center space-x-2.5 cursor-pointer select-none"
              onClick={() => onTabChange("studio")}
            >
              <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 animate-spin-slow" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    RNS 510
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider uppercase rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Studio
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden lg:block">
                  {lang === "ro"
                    ? "Motor RGB555 • Generator ISO Bootabil • Filtru Anti-Purici"
                    : "RGB555 Engine • Bootable ISO Builder • Anti-Green Specks"}
                </p>
              </div>
            </div>

            {/* Language Switcher on mobile (right side of top row) */}
            <div className="flex md:hidden items-center">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px] font-semibold">
                <button
                  onClick={() => onLangChange("ro")}
                  className={`px-2 py-1 rounded transition-colors ${
                    lang === "ro"
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🇷🇴 RO
                </button>
                <button
                  onClick={() => onLangChange("en")}
                  className={`px-2 py-1 rounded transition-colors ${
                    lang === "en"
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🇬🇧 EN
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Scrollable on mobile without scrollbar, neat inline on desktop) */}
          <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-0.5 md:pb-0 scrollbar-none w-full md:w-auto -mx-1 px-1">
            <button
              onClick={() => onTabChange("studio")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                currentTab === "studio"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t.tabs.studio}</span>
              <span className="sm:hidden">{t.tabs.studioShort}</span>
            </button>

            <button
              onClick={() => onTabChange("presets")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                currentTab === "presets"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t.tabs.presets}</span>
              <span className="sm:hidden">{t.tabs.presetsShort}</span>
            </button>

            <button
              onClick={() => onTabChange("inspector")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                currentTab === "inspector"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t.tabs.inspector}</span>
              <span className="sm:hidden">{t.tabs.inspectorShort}</span>
            </button>

            <button
              onClick={() => onTabChange("guide")}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                currentTab === "guide"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t.tabs.guide}</span>
              <span className="sm:hidden">{t.tabs.guideShort}</span>
            </button>
          </nav>

          {/* Language Switcher on desktop */}
          <div className="hidden md:flex items-center space-x-2 shrink-0">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => onLangChange("ro")}
                className={`px-2 py-1 rounded transition-colors ${
                  lang === "ro"
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇷🇴 RO
              </button>
              <button
                onClick={() => onLangChange("en")}
                className={`px-2 py-1 rounded transition-colors ${
                  lang === "en"
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
