"use client";

import React, { useState, useRef } from "react";
import { Language, IsoCompareResult, IsoAnalysis } from "@/types";
import { translations } from "@/lib/translations";
import { analyzeIsoImage, compareIsos } from "@/lib/isoParser";
import {
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Disc3,
  Sparkles,
  HelpCircle,
  UploadCloud,
  FileQuestion,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CompareViewProps {
  lang: Language;
  onSendToStudio?: (imageBmpUrl?: string) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  lang,
  onSendToStudio,
}) => {
  const t = translations[lang];

  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const fileInputBRef = useRef<HTMLInputElement | null>(null);

  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  const [isDragOverA, setIsDragOverA] = useState<boolean>(false);
  const [isDragOverB, setIsDragOverB] = useState<boolean>(false);

  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [compareResult, setCompareResult] = useState<IsoCompareResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  // Helper to run comparison (client-side first for instant speed, fallback to server)
  const runComparison = async (fA: File, fB: File) => {
    setIsComparing(true);
    setErrorMessage(null);
    setCompareResult(null);

    try {
      // Fast in-browser client analysis using our pure TypeScript ISO parser
      const bufA = new Uint8Array(await fA.arrayBuffer());
      const bufB = new Uint8Array(await fB.arrayBuffer());

      const analysisA = analyzeIsoImage(bufA, fA.name);
      const analysisB = analyzeIsoImage(bufB, fB.name);

      const result = compareIsos(analysisA, analysisB);
      setCompareResult(result);
      setIsComparing(false);
    } catch (err: any) {
      // Fallback to server route if client buffer fails
      try {
        const formData = new FormData();
        formData.append("isoA", fA);
        formData.append("isoB", fB);

        const res = await fetch("/api/compare", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          setCompareResult(data);
        } else {
          setErrorMessage(data.error || "Eroare la compararea fișierelor ISO.");
        }
      } catch (serverErr: any) {
        setErrorMessage(err.message || serverErr.message || "Eroare neașteptată");
      } finally {
        setIsComparing(false);
      }
    }
  };

  const handleFileDropA = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverA(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileA(file);
      if (fileB) runComparison(file, fileB);
    }
  };

  const handleFileDropB = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverB(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileB(file);
      if (fileA) runComparison(fileA, file);
    }
  };

  const handleSelectFileA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileA(file);
      if (fileB) runComparison(file, fileB);
    }
  };

  const handleSelectFileB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileB(file);
      if (fileA) runComparison(fileA, file);
    }
  };

  const handleReset = () => {
    setFileA(null);
    setFileB(null);
    setCompareResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Title Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>{lang === "ro" ? "Diagnostic SWL & Semnături Digitale" : "SWL Diagnostics & Digital Signatures"}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
          {t.compare.title}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400">
          {t.compare.subtitle}
        </p>
      </div>

      {/* Freeze Warning Educational Box */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 text-amber-200">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm sm:text-base text-amber-300">
              {t.compare.whyFreezeTitle}
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.compare.whyFreezeDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Dual Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Disc A Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverA(true);
          }}
          onDragLeave={() => setIsDragOverA(false)}
          onDrop={handleFileDropA}
          onClick={() => fileInputARef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
            isDragOverA
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
              : fileA
              ? "border-emerald-500/50 bg-emerald-950/20"
              : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
          }`}
        >
          <input
            ref={fileInputARef}
            type="file"
            accept=".iso"
            className="hidden"
            onChange={handleSelectFileA}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                fileA
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800/80 border border-slate-700/60 text-slate-400"
              }`}
            >
              <Disc3 className={`w-7 h-7 ${fileA ? "animate-spin-slow" : ""}`} />
            </div>

            <div>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {lang === "ro" ? "DISCUL A" : "DISC A"}
                </span>
                <span className="font-bold text-base text-white">
                  {t.compare.discATitle}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {fileA ? fileA.name : t.compare.discASubtitle}
              </p>
            </div>

            {fileA ? (
              <div className="flex items-center space-x-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {(fileA.size / (1024 * 1024)).toFixed(2)} MB • {lang === "ro" ? "Încărcat cu succes" : "Loaded successfully"}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <UploadCloud className="w-4 h-4" />
                <span>{t.compare.dropPrompt}</span>
              </div>
            )}
          </div>
        </div>

        {/* Disc B Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverB(true);
          }}
          onDragLeave={() => setIsDragOverB(false)}
          onDrop={handleFileDropB}
          onClick={() => fileInputBRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
            isDragOverB
              ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
              : fileB
              ? "border-blue-500/50 bg-blue-950/20"
              : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
          }`}
        >
          <input
            ref={fileInputBRef}
            type="file"
            accept=".iso"
            className="hidden"
            onChange={handleSelectFileB}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                fileB
                  ? "bg-blue-500/20 border border-blue-500/40 text-blue-400"
                  : "bg-slate-800/80 border border-slate-700/60 text-slate-400"
              }`}
            >
              <Disc3 className={`w-7 h-7 ${fileB ? "animate-spin-slow" : ""}`} />
            </div>

            <div>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {lang === "ro" ? "DISCUL B" : "DISC B"}
                </span>
                <span className="font-bold text-base text-white">
                  {t.compare.discBTitle}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {fileB ? fileB.name : t.compare.discBSubtitle}
              </p>
            </div>

            {fileB ? (
              <div className="flex items-center space-x-2 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {(fileB.size / (1024 * 1024)).toFixed(2)} MB • {lang === "ro" ? "Încărcat cu succes" : "Loaded successfully"}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <UploadCloud className="w-4 h-4" />
                <span>{t.compare.dropPrompt}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action / Trigger Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {fileA && fileB && (
          <button
            onClick={() => runComparison(fileA, fileB)}
            disabled={isComparing}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isComparing ? "animate-spin" : ""}`} />
            <span>{isComparing ? t.compare.comparing : t.compare.startCompareBtn}</span>
          </button>
        )}

        {(fileA || fileB) && (
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-medium text-sm transition-all"
          >
            {t.compare.resetBtn}
          </button>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-center space-x-3">
          <XCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Results Section */}
      {compareResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Verdict Banner - Direct Answer: DA / NU EROARE */}
          <div
            className={`rounded-2xl border p-6 transition-all ${
              compareResult.verdict.verdictBadge === "SAFE"
                ? "border-emerald-500/50 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-emerald-950/30 shadow-2xl shadow-emerald-500/10"
                : compareResult.verdict.verdictBadge === "WARNING"
                ? "border-amber-500/50 bg-gradient-to-br from-amber-950/60 via-slate-950 to-amber-950/30 shadow-2xl shadow-amber-500/10"
                : "border-rose-500/60 bg-gradient-to-br from-rose-950/60 via-slate-950 to-rose-950/40 shadow-2xl shadow-rose-500/20"
            }`}
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg ${
                    compareResult.verdict.verdictBadge === "SAFE"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20"
                      : compareResult.verdict.verdictBadge === "WARNING"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-amber-500/20"
                      : "bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-rose-500/20 animate-pulse"
                  }`}
                >
                  {compareResult.verdict.verdictBadge === "SAFE" ? (
                    <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
                  ) : compareResult.verdict.verdictBadge === "WARNING" ? (
                    <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" />
                  ) : (
                    <XCircle className="w-8 h-8 sm:w-10 sm:h-10" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                        compareResult.verdict.verdictBadge === "SAFE"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : compareResult.verdict.verdictBadge === "WARNING"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-rose-500/30 text-rose-200 border-rose-500/50"
                      }`}
                    >
                      {compareResult.verdict.willCauseError
                        ? "VA DA EROARE PE MAȘINĂ ✗"
                        : "GARANTAT 0 ERORI — SIGUR PENTRU CD ✓"}
                    </span>

                    {compareResult.verdict.errorTypeExpected && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/50">
                        {compareResult.verdict.errorTypeExpected}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {compareResult.verdict.verdictTitle}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-200">
                    {compareResult.verdict.verdictSubtitle}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              {onSendToStudio && compareResult.isoB.previewRgbBase64 && (
                <button
                  onClick={() => onSendToStudio(compareResult.isoB.previewRgbBase64 || undefined)}
                  className="w-full lg:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shrink-0 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{t.compare.loadInStudio}</span>
                </button>
              )}
            </div>

            {/* Advice and Actionable Next Step */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="text-slate-300 flex items-start space-x-2">
                <span className="font-bold text-white shrink-0">Ce trebuie să faci:</span>
                <span>{compareResult.verdict.actionableAdvice}</span>
              </div>
            </div>
          </div>

          {/* 6-Point Hardware Safety Checklist Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>
                    {lang === "ro"
                      ? "Checklist de Siguranță Hardware RNS 510 (6 din 6 puncte critice)"
                      : "RNS 510 Hardware Safety Checklist (6 critical points)"}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === "ro"
                    ? "Fiecare verificare de mai jos răspunde direct dacă unitatea va accepta discul sau va afișa eroare"
                    : "Each check below confirms whether the unit will accept the disc or throw an error"}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {compareResult.verdict.checklist.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                    item.status === "FAIL"
                      ? "bg-rose-950/20"
                      : item.status === "WARN"
                      ? "bg-amber-950/10"
                      : "hover:bg-slate-800/20"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white">{item.name}</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                          item.status === "PASS"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : item.status === "WARN"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/30 font-extrabold"
                        }`}
                      >
                        {item.verdictLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      <span className="text-slate-500 font-mono mr-1">Valoare:</span>
                      <span className="font-mono text-slate-300">{item.targetValue}</span>
                    </p>
                  </div>

                  <div className="md:text-right shrink-0">
                    <span
                      className={`text-xs ${
                        item.status === "FAIL"
                          ? "text-rose-400 font-bold"
                          : item.status === "WARN"
                          ? "text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      {item.riskDescription}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Core Technical Comparison Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                  <span>
                    {lang === "ro"
                      ? "Matrice de Comparare Side-by-Side (Referință vs Custom)"
                      : "Side-by-Side Comparison Matrix (Reference vs Target)"}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === "ro"
                    ? "Verificarea fiecărui parametru critic necesar pentru a trece de bootloader fără freeze"
                    : "Validating each critical parameter required to pass the bootloader without freezing"}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {/* Row 1: Semnătură VERSION.TXT (The exact freeze cause!) */}
              <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-4 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">
                      {t.compare.swlSignatureCard}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      CRITIC
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {lang === "ro"
                      ? "Verificat de binarul SWL.FLI. Dacă hash-ul diferă de 59c8, ecranul îngheață!"
                      : "Validated by SWL.FLI binary. If hash differs from 59c8, screen freezes!"}
                  </p>
                </div>

                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Disc A (Referință)</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        compareResult.isoA.versionSignatureValid
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {compareResult.isoA.versionSignatureValid ? "VALID (#CRC16:59c8)" : "TAMPERED"}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 truncate">
                    {compareResult.isoA.versionCrcDeclared
                      ? `#CRC16:${compareResult.isoA.versionCrcDeclared}`
                      : "Lipsă semnătură"}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {compareResult.isoA.versionText?.split("\n")[0] || "—"}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Disc B (De Verificat)</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        compareResult.isoB.versionSignatureValid
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {compareResult.isoB.versionSignatureValid ? "VALID (#CRC16:59c8)" : "INVALID (RISC FREEZE)"}
                    </span>
                  </div>
                  <div
                    className={`font-mono text-[11px] truncate ${
                      compareResult.isoB.versionSignatureValid ? "text-slate-300" : "text-rose-400 font-bold"
                    }`}
                  >
                    {compareResult.isoB.versionCrcDeclared
                      ? `#CRC16:${compareResult.isoB.versionCrcDeclared}`
                      : "Lipsă semnătură"}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {compareResult.isoB.versionText?.split("\n")[0] || "—"}
                  </div>
                </div>
              </div>

              {/* Row 2: BLSCRIPT.CFG Title (Safe personalization!) */}
              <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-4 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">
                      {t.compare.blscriptCard}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      SIGUR
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {t.compare.blscriptSafeHint}
                  </p>
                </div>

                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
                  <span className="text-slate-400 font-semibold text-xs block">Disc A:</span>
                  <div className="font-mono text-xs text-slate-200">
                    {compareResult.isoA.blscriptTitle || "—"}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
                  <span className="text-slate-400 font-semibold text-xs block">Disc B:</span>
                  <div className="font-mono text-xs text-cyan-300 font-semibold">
                    {compareResult.isoB.blscriptTitle || "—"}
                  </div>
                </div>
              </div>

              {/* Row 3: ECUORDER.TXT & CRC.16 */}
              <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-4 space-y-1">
                  <span className="font-bold text-white text-sm">
                    {t.compare.ecuorderCard}
                  </span>
                  <p className="text-xs text-slate-400">
                    {lang === "ro"
                      ? "Partiția 15 (STRATA_UPDATE 15). Mărimea declarată trebuie să fie identică cu LOGO.FLI."
                      : "Partition 15 (STRATA_UPDATE 15). Declared size must equal LOGO.FLI size."}
                  </p>
                </div>

                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Dimensiune:</span>
                    <span className="font-mono text-slate-200">
                      {compareResult.isoA.ecuorderDeclaredSize?.toLocaleString()} bytes
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Suma CRC.16:</span>
                    <span
                      className={`font-mono font-bold ${
                        compareResult.isoA.crc16Valid ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {compareResult.isoA.crc16FileVal || "—"}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Dimensiune:</span>
                    <span className="font-mono text-slate-200">
                      {compareResult.isoB.ecuorderDeclaredSize?.toLocaleString()} bytes
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Suma CRC.16:</span>
                    <span
                      className={`font-mono font-bold ${
                        compareResult.isoB.crc16Valid ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {compareResult.isoB.crc16FileVal || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 4: LOGO.FLI Integrity & Screen Previews */}
              <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-4 space-y-1">
                  <span className="font-bold text-white text-sm">
                    {t.compare.logoCard}
                  </span>
                  <p className="text-xs text-slate-400">
                    {lang === "ro"
                      ? "Format 800×480 RGB555 nativ. Fără purici verzi, bit 15 la 0."
                      : "Native 800×480 RGB555 format. Zero green noise, bit 15 at 0."}
                  </p>
                </div>

                {/* Disc A Logo Preview & Specs */}
                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Disc A Logo</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        compareResult.isoA.isPerfectLogo
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {compareResult.isoA.isPerfectLogo ? "100% PERFECT" : "AVERTISMENT"}
                    </span>
                  </div>

                  {compareResult.isoA.previewRgbBase64 ? (
                    <div className="relative aspect-[800/480] w-full rounded-lg overflow-hidden border border-slate-800 bg-black">
                      <img
                        src={compareResult.isoA.previewRgbBase64}
                        alt="Disc A Extracted Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[800/480] w-full rounded-lg border border-slate-800 bg-slate-900/40 flex items-center justify-center text-xs text-slate-500">
                      Nicio imagine extrasă
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 flex justify-between">
                    <span>Purici: {compareResult.isoA.greenNoisePixels}</span>
                    <span>Bit 15: {compareResult.isoA.bit15Errors}</span>
                    <span>CRC1: {compareResult.isoA.crc1Val}</span>
                  </div>
                </div>

                {/* Disc B Logo Preview & Specs */}
                <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Disc B Logo</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        compareResult.isoB.isPerfectLogo
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {compareResult.isoB.isPerfectLogo ? "100% PERFECT" : "AVERTISMENT"}
                    </span>
                  </div>

                  {compareResult.isoB.previewRgbBase64 ? (
                    <div className="relative aspect-[800/480] w-full rounded-lg overflow-hidden border border-slate-800 bg-black">
                      <img
                        src={compareResult.isoB.previewRgbBase64}
                        alt="Disc B Extracted Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[800/480] w-full rounded-lg border border-slate-800 bg-slate-900/40 flex items-center justify-center text-xs text-slate-500">
                      Nicio imagine extrasă
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 flex justify-between">
                    <span>Purici: {compareResult.isoB.greenNoisePixels}</span>
                    <span>Bit 15: {compareResult.isoB.bit15Errors}</span>
                    <span>CRC1: {compareResult.isoB.crc1Val}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Deep Raw Files Inspector */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full p-4 flex items-center justify-between text-left text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/40 transition-colors"
            >
              <span className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-blue-400" />
                <span>
                  {lang === "ro"
                    ? "Inspecție Detaliată a Fișierelor Brute (VERSION.TXT / BLSCRIPT.CFG / ECUORDER.TXT)"
                    : "Detailed Inspection of Raw Text Files (VERSION.TXT / BLSCRIPT.CFG / ECUORDER.TXT)"}
                </span>
              </span>
              {showTechnicalDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="p-4 sm:p-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 font-mono text-xs">
                {/* Disc A Raw Files */}
                <div className="space-y-4">
                  <h4 className="font-bold text-emerald-400 border-b border-slate-800 pb-1">
                    Disc A: {compareResult.isoA.fileName}
                  </h4>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-sans font-bold">VERSION.TXT:</span>
                    <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 whitespace-pre-wrap overflow-x-auto text-[11px]">
                      {compareResult.isoA.versionText || "(Lipsă fișier)"}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-sans font-bold">ECUORDER.TXT:</span>
                    <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 whitespace-pre-wrap overflow-x-auto text-[11px]">
                      {compareResult.isoA.ecuorderContent || "(Lipsă fișier)"}
                    </pre>
                  </div>
                </div>

                {/* Disc B Raw Files */}
                <div className="space-y-4">
                  <h4 className="font-bold text-blue-400 border-b border-slate-800 pb-1">
                    Disc B: {compareResult.isoB.fileName}
                  </h4>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-sans font-bold">VERSION.TXT:</span>
                    <pre
                      className={`p-3 rounded-lg bg-slate-900 border whitespace-pre-wrap overflow-x-auto text-[11px] ${
                        compareResult.isoB.versionSignatureValid
                          ? "border-slate-800 text-slate-300"
                          : "border-rose-500/50 text-rose-300 bg-rose-950/20"
                      }`}
                    >
                      {compareResult.isoB.versionText || "(Lipsă fișier)"}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-sans font-bold">ECUORDER.TXT:</span>
                    <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 whitespace-pre-wrap overflow-x-auto text-[11px]">
                      {compareResult.isoB.ecuorderContent || "(Lipsă fișier)"}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
