"use client";

import React from "react";
import { Diagnostics, Language } from "@/types";
import { translations } from "@/lib/translations";
import { ShieldCheck, AlertTriangle, CheckCircle2, Zap, Palette, Cpu } from "lucide-react";

interface DiagnosticBadgeProps {
  diagnostics: Diagnostics | null;
  lang: Language;
}

export const DiagnosticBadge: React.FC<DiagnosticBadgeProps> = ({
  diagnostics,
  lang,
}) => {
  const t = translations[lang];

  if (!diagnostics) return null;

  const isPerfect = diagnostics.isPerfect && diagnostics.bit15Errors === 0 && diagnostics.greenNoisePixels === 0;

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-800/60 pb-3">
        <div className="flex items-center space-x-2">
          {isPerfect ? (
            <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>{t.studio.perfectBadge}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>{t.studio.warningBadge}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          <span>CRC-16/XMODEM Ready</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Resolution */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resolution</span>
          </div>
          <span className="text-sm font-bold text-white">800 × 480</span>
          <span className="text-[10px] text-emerald-400 mt-0.5">384,000 Pixels</span>
        </div>

        {/* Color Space */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span>Color Space</span>
          </div>
          <span className="text-sm font-bold text-white">RGB555 (15-bit)</span>
          <span className="text-[10px] text-emerald-400 mt-0.5">0RRRRRGGGGGBBBBB</span>
        </div>

        {/* Bit 15 Errors */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Bit 15 Glitches</span>
          </div>
          <span className={`text-sm font-bold ${diagnostics.bit15Errors === 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {diagnostics.bit15Errors} {diagnostics.bit15Errors === 0 ? "Errors" : "Detected"}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">Clamped to 0 (Safe)</span>
        </div>

        {/* Green Noise Pixels */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Green Artifacts</span>
          </div>
          <span className={`text-sm font-bold ${diagnostics.greenNoisePixels === 0 ? "text-emerald-400" : "text-amber-400"}`}>
            {diagnostics.greenNoisePixels} Specks
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">Anti-Noise Filter Active</span>
        </div>
      </div>
    </div>
  );
};
