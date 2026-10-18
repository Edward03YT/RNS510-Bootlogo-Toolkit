"use client";

import React, { useState } from "react";
import { Language, PresetLogo } from "@/types";
import { translations } from "@/lib/translations";
import { PRESET_LOGOS, generateCustomBadgeSvg } from "@/lib/presets";
import { Sparkles, ArrowRight, Type, Palette } from "lucide-react";

interface PresetsLibraryProps {
  lang: Language;
  onSelectPreset: (svgData: string) => void;
}

export const PresetsLibrary: React.FC<PresetsLibraryProps> = ({
  lang,
  onSelectPreset,
}) => {
  const t = translations[lang];

  // Custom text badge state
  const [customText, setCustomText] = useState<string>("GOLF R");
  const [customSub, setCustomSub] = useState<string>("4MOTION PERFORMANCE");
  const [customColor, setCustomColor] = useState<string>("#38bdf8");

  const colors = [
    { name: "VW Cyan", hex: "#38bdf8" },
    { name: "GTI Red", hex: "#ef4444" },
    { name: "Cobalt Blue", hex: "#3b82f6" },
    { name: "vRS Green", hex: "#22c55e" },
    { name: "Cupra Copper", hex: "#f59e0b" },
    { name: "Wolfsburg Gold", hex: "#eab308" },
    { name: "Silver Metal", hex: "#e2e8f0" },
  ];

  const customSvg = generateCustomBadgeSvg(customText, customSub, customColor);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white mb-1">
          {t.presets.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          {t.presets.subtitle}
        </p>
      </div>

      {/* Interactive Custom Badge Creator Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm mb-4">
          <Type className="w-4 h-4" />
          <span>{t.presets.customBadgeTitle}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Badge / Car Model Text
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. PASSAT B7, GOLF 6 GTI, RNS 510"
                maxLength={22}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Subtitle / Slogan
              </label>
              <input
                type="text"
                value={customSub}
                onChange={(e) => setCustomSub(e.target.value)}
                placeholder="e.g. 4MOTION PERFORMANCE, EDITION 35"
                maxLength={32}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Colors */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {t.presets.badgeColor}
              </label>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setCustomColor(c.hex)}
                    className={`w-7 h-7 rounded-full transition-transform border-2 ${
                      customColor === c.hex
                        ? "scale-110 border-white shadow-lg"
                        : "border-slate-800 hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => onSelectPreset(customSvg)}
              className="w-full mt-2 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-500/20"
            >
              <span>{t.presets.createCustomBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Live Preview Display */}
          <div className="lg:col-span-7">
            <div className="relative aspect-[800/480] rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center p-2">
              <div
                className="w-full h-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: customSvg }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* OEM Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PRESET_LOGOS.map((preset) => (
          <div
            key={preset.id}
            className="group bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col justify-between"
          >
            {/* SVG Thumbnail Container */}
            <div className="relative aspect-[800/480] bg-black overflow-hidden flex items-center justify-center border-b border-slate-800/80">
              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                dangerouslySetInnerHTML={{ __html: preset.svgData }}
              />
            </div>

            {/* Details & Button */}
            <div className="p-5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">
                  {preset.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {preset.subtitle}
                </p>
              </div>

              <button
                onClick={() => onSelectPreset(preset.svgData)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-all shadow-md group-hover:shadow-blue-500/20"
                title={t.presets.applyPreset}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
