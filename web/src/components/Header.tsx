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
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange("studio")}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Disc3 className="w-5 h-5 text-cyan-400 animate-spin-slow" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  RNS 510
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Bootlogo Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                RGB555 15-bit Engine • ISO Builder • Anti-Green Specks
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => onTabChange("studio")}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === "studio"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>{t.tabs.studio}</span>
            </button>

            <button
              onClick={() => onTabChange("presets")}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === "presets"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.tabs.presets}</span>
            </button>

            <button
              onClick={() => onTabChange("inspector")}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === "inspector"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t.tabs.inspector}</span>
            </button>

            <button
              onClick={() => onTabChange("guide")}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === "guide"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.tabs.guide}</span>
            </button>
          </nav>

          {/* Language Switcher */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => onLangChange("ro")}
                className={`px-2 py-1 rounded transition-colors ${
                  lang === "ro"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇷🇴 RO
              </button>
              <button
                onClick={() => onLangChange("en")}
                className={`px-2 py-1 rounded transition-colors ${
                  lang === "en"
                    ? "bg-blue-600 text-white"
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
