"use client";

import React from "react";
import { Language } from "@/types";
import { translations } from "@/lib/translations";
import {
  Disc,
  Key,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Car,
} from "lucide-react";

interface GuideViewProps {
  lang: Language;
}

export const GuideView: React.FC<GuideViewProps> = ({ lang }) => {
  const t = translations[lang];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white mb-1">
          {t.guide.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Volkswagen RNS 510 • Škoda Columbus • SEAT Media System
        </p>
      </div>

      {/* Safety Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xl flex items-start space-x-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white mb-1">
            {t.guide.safetyTitle}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {t.guide.safetyDesc}
          </p>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-6">
        {/* Step 1 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col md:flex-row gap-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 font-extrabold text-lg">
            1
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <Disc className="w-4 h-4 text-cyan-400" />
              <span>{t.guide.step1Title}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.guide.step1Desc}
            </p>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1">
              <div className="text-emerald-400 font-semibold">
                ✓ Recomandat: CD-R Verbatim AZO (scriere la 4x sau 8x)
              </div>
              <div className="text-rose-400 font-semibold">
                ✗ Nu folosi: CD-RW (rescriabil), DVD-R, stick USB sau card SD
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col md:flex-row gap-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 font-extrabold text-lg">
            2
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <Car className="w-4 h-4 text-cyan-400" />
              <span>{t.guide.step2Title}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.guide.step2Desc}
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col md:flex-row gap-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 font-extrabold text-lg">
            3
          </div>
          <div className="flex-1 space-y-3">
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>{t.guide.step3Title}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.guide.step3Desc}
            </p>
            {/* Visual Hardware Buttons Representation */}
            <div className="flex items-center space-x-2 pt-1">
              <kbd className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-white shadow">
                SETUP
              </kbd>
              <span className="text-slate-500 font-bold">+</span>
              <kbd className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-white shadow">
                EJECT (⏏)
              </kbd>
              <span className="text-slate-500 font-bold">+</span>
              <kbd className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-white shadow">
                MIC / INFO (i)
              </kbd>
            </div>
          </div>
        </div>

        {/* Step 4 & 5 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col md:flex-row gap-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 font-extrabold text-lg">
            4
          </div>
          <div className="flex-1 space-y-3">
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>{t.guide.step4Title} & {t.guide.step5Title}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.guide.step4Desc}
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.guide.step5Desc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
