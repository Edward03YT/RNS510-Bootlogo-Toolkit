"use client";

import React, { useEffect } from "react";
import { GenerationResult, Language } from "@/types";
import { translations } from "@/lib/translations";
import { Disc3, CheckCircle2, AlertCircle, X, FileCode, Image as ImageIcon } from "lucide-react";
import confetti from "canvas-confetti";

interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  progressStep: number;
  result: GenerationResult | null;
  lang: Language;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  progressStep,
  result,
  lang,
}) => {
  const t = translations[lang];
  const gm = t.generationModal;

  useEffect(() => {
    if (result && result.success) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#3b82f6", "#06b6d4", "#10b981", "#ffffff"],
        });
      } catch (e) {}
    }
  }, [result]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl text-white my-auto">
        {/* Close Button */}
        {!isLoading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center text-center py-4 sm:py-6">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
              <Disc3 className="w-8 h-8 sm:w-9 sm:h-9 text-cyan-400 animate-pulse" />
            </div>

            <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2">
              {t.studio.generating}
            </h3>

            {/* Stepper */}
            <div className="w-full mt-4 sm:mt-6 space-y-2.5 sm:space-y-3">
              {gm.stepper.map((stepName, idx) => {
                const isDone = progressStep > idx;
                const isCurrent = progressStep === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center space-x-2.5 sm:space-x-3 text-xs p-2 sm:p-2.5 rounded-lg transition-all ${
                      isDone
                        ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                        : isCurrent
                        ? "text-cyan-300 bg-blue-500/10 border border-blue-500/30 font-semibold"
                        : "text-slate-500 bg-slate-950/40"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 ${
                        isDone
                          ? "bg-emerald-500 text-slate-950"
                          : isCurrent
                          ? "bg-blue-500 text-white animate-pulse"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </span>
                    <span className="text-left text-[11px] sm:text-xs">{stepName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && result && !result.success && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
              <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-rose-400 mb-2">
              {gm.failedTitle}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              {result.error || (lang === "ro" ? "A apărut o eroare la construirea imaginii ISO." : "An error occurred during ISO building.")}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-all"
            >
              {gm.close}
            </button>
          </div>
        )}

        {/* Success State */}
        {!isLoading && result && result.success && (
          <div className="flex flex-col items-center py-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 sm:mb-4 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
            </div>

            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mb-1 text-center">
              {gm.successTitle}
            </h3>
            <p className="text-xs text-slate-400 text-center max-w-sm mb-4 sm:mb-5">
              {gm.successSubtitle}
            </p>

            {/* Technical Verification Pill */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-slate-400">{gm.fliSizeLabel}</div>
                <div className="font-mono text-right text-emerald-400 font-semibold truncate">
                  {result.fliSizeBytes?.toLocaleString()} {gm.bytes}
                </div>

                <div className="text-slate-400">{gm.ecuorderLabel}</div>
                <div className="font-mono text-right text-cyan-400 font-semibold">
                  {result.crc16} ({gm.valid})
                </div>

                <div className="text-slate-400">{gm.greenNoiseLabel}</div>
                <div className="font-mono text-right text-emerald-400 font-semibold">
                  {gm.clean}
                </div>

                <div className="text-slate-400">{gm.bit15Label}</div>
                <div className="font-mono text-right text-emerald-400 font-semibold">
                  {gm.safe}
                </div>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="w-full space-y-2.5">
              {result.isoFile && (
                <a
                  href={`/api/download/${result.isoFile}`}
                  download={result.isoFile}
                  className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 font-bold text-sm text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.01]"
                >
                  <Disc3 className="w-5 h-5 text-white animate-spin-slow shrink-0" />
                  <span>{t.studio.downloadIso}</span>
                </a>
              )}

              <div className="grid grid-cols-2 gap-2">
                {result.fliFile && (
                  <a
                    href={`/api/download/${result.fliFile}`}
                    download={result.fliFile}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-all truncate"
                  >
                    <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">{t.studio.downloadFli}</span>
                  </a>
                )}

                {result.previewFile && (
                  <a
                    href={`/api/download/${result.previewFile}`}
                    download={result.previewFile}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-all truncate"
                  >
                    <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="truncate">{t.studio.downloadPreview}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
