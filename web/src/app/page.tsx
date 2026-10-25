"use client";

import React, { useState } from "react";
import { Language, NavTab } from "@/types";
import { Header } from "@/components/Header";
import { StudioView } from "@/components/StudioView";
import { PresetsLibrary } from "@/components/PresetsLibrary";
import { InspectorView } from "@/components/InspectorView";
import { CompareView } from "@/components/CompareView";
import { MapVerifyView } from "@/components/MapVerifyView";
import { GuideView } from "@/components/GuideView";
import { translations } from "@/lib/translations";
import { Heart, Disc3 } from "lucide-react";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>("studio");
  const [lang, setLang] = useState<Language>("ro");
  const [selectedPresetSvg, setSelectedPresetSvg] = useState<string | null>(null);

  const t = translations[lang];

  const handleSelectPreset = (svgData: string) => {
    setSelectedPresetSvg(svgData);
    setCurrentTab("studio");
  };

  const handleFixInStudio = (imageUrl?: string) => {
    // Switch to studio tab
    setCurrentTab("studio");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]"></div>
      </div>

      {/* Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        lang={lang}
        onLangChange={setLang}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {currentTab === "studio" && (
          <StudioView
            lang={lang}
            presetSvgToLoad={selectedPresetSvg}
            onClearPreset={() => setSelectedPresetSvg(null)}
          />
        )}

        {currentTab === "presets" && (
          <PresetsLibrary
            lang={lang}
            onSelectPreset={handleSelectPreset}
          />
        )}

        {currentTab === "inspector" && (
          <InspectorView
            lang={lang}
            onFixInStudio={handleFixInStudio}
          />
        )}

        {currentTab === "compare" && (
          <CompareView
            lang={lang}
            onSendToStudio={handleFixInStudio}
          />
        )}

        {currentTab === "mapverify" && (
          <MapVerifyView lang={lang} />
        )}

        {currentTab === "guide" && (
          <GuideView lang={lang} />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Disc3 className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-400">
              VW RNS 510 Bootlogo Toolkit Web Edition
            </span>
          </div>

          <p>{t.footer.safeNote}</p>

          <p className="flex items-center justify-center space-x-1">
            <span>{t.footer.license}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
