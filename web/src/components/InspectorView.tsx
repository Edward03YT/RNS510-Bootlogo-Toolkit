"use client";

import React, { useState, useRef } from "react";
import { VerificationResult, Language } from "@/types";
import { translations } from "@/lib/translations";
import {
  ShieldCheck,
  AlertTriangle,
  Upload,
  CheckCircle2,
  XCircle,
  FileCode,
  Disc3,
  Wrench,
  Search,
} from "lucide-react";

interface InspectorViewProps {
  lang: Language;
  onFixInStudio?: (imageUrl: string) => void;
}

export const InspectorView: React.FC<InspectorViewProps> = ({
  lang,
  onFixInStudio,
}) => {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setSelectedFileName(file.name);
    setIsAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/verify", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setIsAnalyzing(false);
      setResult(data);
    } catch (err: any) {
      setIsAnalyzing(false);
      setResult({
        success: false,
        error: err.message || "Failed to inspect file",
      });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white mb-1">
          {t.inspector.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          {t.inspector.subtitle}
        </p>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center bg-slate-900/60 ${
          isDragOver
            ? "border-blue-500 bg-blue-500/10"
            : "border-slate-800 hover:border-slate-700 hover:bg-slate-900"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".iso,.fli,.png,.jpg,.jpeg,.bmp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-blue-500/10">
          <Search className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold text-white mb-1">
          {t.inspector.uploadDrop}
        </h3>
        <p className="text-xs text-slate-400 max-w-md">
          {t.inspector.selectFile} {t.inspector.fileTypesHint}
        </p>

        {selectedFileName && (
          <div className="mt-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-400">
            {selectedFileName}
          </div>
        )}
      </div>

      {/* Analyzing Loading Spinner */}
      {isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Disc3 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h4 className="text-base font-semibold text-white">
            {t.inspector.analyzing}
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            {t.inspector.analyzingSub}
          </p>
        </div>
      )}

      {/* Results View */}
      {!isAnalyzing && result && result.success && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${
              result.isPerfect
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}
          >
            <div className="flex items-center space-x-3">
              {result.isPerfect ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              )}
              <span className="font-bold text-sm">
                {result.isPerfect
                  ? t.inspector.conclusionClean
                  : t.inspector.conclusionWarning}
              </span>
            </div>

            {/* Auto Fix Button if errors detected */}
            {!result.isPerfect && result.previewUrl && onFixInStudio && (
              <button
                onClick={() => onFixInStudio(result.previewUrl!)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/20"
              >
                <Wrench className="w-4 h-4" />
                <span>{t.inspector.fixAndRebuild}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Col: Diagnostic Metrics Table */}
            <div className="lg:col-span-6 space-y-3">
              <h4 className="font-bold text-sm text-white border-b border-slate-800 pb-2">
                {t.inspector.resultsTitle}
              </h4>

              <div className="divide-y divide-slate-800/80 text-xs">
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.sourceType}</span>
                  <span className="font-mono font-bold text-cyan-400 uppercase">
                    {result.sourceType}
                  </span>
                </div>

                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.resolution}</span>
                  <span className="font-mono font-bold text-white">
                    {result.width} × {result.height}
                  </span>
                </div>

                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.totalPixels}</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {result.totalPixels?.toLocaleString()} / {result.expectedPixels?.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.magicHeader}</span>
                  <span
                    className={`font-mono font-bold ${
                      result.magicValid ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {result.magicValid ? t.inspector.magicValid : t.inspector.corrupted}
                  </span>
                </div>

                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.crc1Header}</span>
                  <span
                    className={`font-mono font-bold ${
                      result.crc1Valid ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {result.crc1Val} ({result.crc1Valid ? t.inspector.statusValid : t.inspector.statusInvalid})
                  </span>
                </div>

                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.crc2Data}</span>
                  <span
                    className={`font-mono font-bold ${
                      result.crc2Valid ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {result.crc2Val} ({result.crc2Valid ? t.inspector.statusValid : t.inspector.statusInvalid})
                  </span>
                </div>

                {result.ecuInfo && (
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-400">{t.inspector.ecuorderCrc}</span>
                    <span
                      className={`font-mono font-bold ${
                        result.ecuInfo.crc_valid ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {result.ecuInfo.crc_file} ({result.ecuInfo.crc_valid ? t.inspector.statusValid : t.inspector.statusMismatch})
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.bit15Errors}</span>
                  <span
                    className={`font-mono font-bold ${
                      result.bit15Errors === 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {result.bit15Errors}
                  </span>
                </div>

                <div className="flex justify-between py-2.5">
                  <span className="text-slate-400">{t.inspector.greenNoise}</span>
                  <span
                    className={`font-mono font-bold ${
                      result.greenNoisePixels === 0 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {result.greenNoisePixels}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Col: Extracted Hardware Screen Preview */}
            <div className="lg:col-span-6 space-y-3">
              <h4 className="font-bold text-sm text-white border-b border-slate-800 pb-2">
                {t.inspector.decodedScreenTitle}
              </h4>

              {result.previewUrl && (
                <div className="relative aspect-[800/480] bg-black rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center">
                  <img
                    src={result.previewUrl}
                    alt="Decoded RNS 510 Preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-slate-900/80 backdrop-blur rounded text-[10px] font-mono text-cyan-400 border border-slate-800">
                    {t.inspector.nativeRes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
