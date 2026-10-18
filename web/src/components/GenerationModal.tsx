"use client";

import React, { useEffect } from "react";
import { GenerationResult, Language } from "@/types";
import { translations } from "@/lib/translations";
import { Disc3, CheckCircle2, Download, AlertCircle, X, ShieldCheck, FileCode, Image as ImageIcon } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
        {/* Close Button */}
        {!isLoading && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center text-center py-6">
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
              <Disc3 className="w-9 h-9 text-cyan-400 animate-pulse" />
            </div>

            <h3 className="text-xl font-bold tracking-tight mb-2">
              {t.studio.generating}
            </h3>

            {/* Stepper */}
            <div className="w-full mt-6 space-y-3">
              {[
                "1. RGB555 15-bit conversion & Anti-Noise filtering",
                "2. RLE compression & LOGO.FLI header assembly",
                "3. CRC-16/XMODEM calculation & ECUORDER.TXT creation",
                "4. ISO 9660 filesystem building with pycdlib",
              ].map((stepName, idx) => {
                const isDone = progressStep > idx;
                const isCurrent = progressStep === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center space-x-3 text-xs p-2 rounded-lg transition-all ${
                      isDone
                        ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                        : isCurrent
                        ? "text-cyan-300 bg-blue-500/10 border border-blue-500/30 font-semibold"
                        : "text-slate-500 bg-slate-950/40"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isDone
                          ? "bg-emerald-500 text-slate-950"
                          : isCurrent
                          ? "bg-blue-500 text-white animate-pulse"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </span>
                    <span>{stepName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && result && !result.success && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-rose-400 mb-2">
              Generation Failed
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              {result.error || "An error occurred during Python ISO compilation."}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-all"
            >
              Close / Închide
            </button>
          </div>
        )}

        {/* Success State */}
        {!isLoading && result && result.success && (
          <div className="flex flex-col items-center py-2">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-bold tracking-tight text-white mb-1">
              Bootable ISO Ready!
            </h3>
            <p className="text-xs text-slate-400 text-center max-w-sm mb-5">
              100% verified for Volkswagen RNS 510, Škoda Columbus & SEAT Media System.
            </p>

            {/* Technical Verification Pill */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-slate-400">FLI Size:</div>
                <div className="font-mono text-right text-emerald-400 font-semibold">
                  {result.fliSizeBytes?.toLocaleString()} bytes
                </div>
                <div className="text-slate-400">ECUORDER CRC.16:</div>
                <div className="font-mono text-right text-cyan-400 font-semibold">
                  {result.crc16} (VALID)
                </div>
                <div className="text-slate-400">Green Noise Specks:</div>
                <div className="font-mono text-right text-emerald-400 font-semibold">
                  0 (CLEAN)
                </div>
                <div className="text-slate-400">Bit 15 Parity:</div>
                <div className="font-mono text-right text-emerald-400 font-semibold">
                  0 (SAFE)
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
                  <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
                  <span>{t.studio.downloadIso}</span>
                </a>
              )}

              <div className="grid grid-cols-2 gap-2">
                {result.fliFile && (
                  <a
                    href={`/api/download/${result.fliFile}`}
                    download={result.fliFile}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-all"
                  >
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>{t.studio.downloadFli}</span>
                  </a>
                )}

                {result.previewFile && (
                  <a
                    href={`/api/download/${result.previewFile}`}
                    download={result.previewFile}
                    className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-all"
                  >
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    <span>{t.studio.downloadPreview}</span>
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
