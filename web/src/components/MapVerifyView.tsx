"use client";

import React, { useState, useRef } from "react";
import {
  Language,
  ReconResult,
  ManifestData,
  VerifyDiffResult,
  IsoScanResult,
  ZipScanResult,
} from "@/types";
import { translations } from "@/lib/translations";
import {
  formatBytes,
  analyzeFolderStructure,
  generateManifest,
  verifyFolderAgainstManifest,
  compareFolderTrees,
  scanIsoFile,
  scanZipFile,
  streamHashSha256,
} from "@/lib/mapVerifyEngine";
import {
  Map,
  FolderTree,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Search,
  Key,
  Archive,
  Disc3,
  Layers,
  ShieldAlert,
  ArrowLeftRight,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Copy,
  Check,
} from "lucide-react";

interface MapVerifyViewProps {
  lang: Language;
}

type SubTab = "recon" | "manifest" | "compare" | "iso" | "hasher" | "archive" | "card";

export const MapVerifyView: React.FC<MapVerifyViewProps> = ({ lang }) => {
  const t = translations[lang];
  const tm = t.mapverify;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("recon");
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);

  // Drag and drop states
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string }>({
    done: 0,
    total: 0,
    label: "",
  });
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Recon state
  const [reconFiles, setReconFiles] = useState<File[]>([]);
  const [reconResult, setReconResult] = useState<ReconResult | null>(null);

  // Manifest state
  const [manifestFiles, setManifestFiles] = useState<File[]>([]);
  const [generatedManifest, setGeneratedManifest] = useState<ManifestData | null>(null);
  const [uploadedManifest, setUploadedManifest] = useState<ManifestData | null>(null);
  const [manifestVerifyResult, setManifestVerifyResult] = useState<VerifyDiffResult | null>(null);
  const [manifestQuick, setManifestQuick] = useState<boolean>(false);

  // Compare state
  const [compareFilesA, setCompareFilesA] = useState<File[]>([]);
  const [compareFilesB, setCompareFilesB] = useState<File[]>([]);
  const [compareQuick, setCompareQuick] = useState<boolean>(false);
  const [compareResult, setCompareResult] = useState<VerifyDiffResult | null>(null);

  // ISO state
  const [isoFile, setIsoFile] = useState<File | null>(null);
  const [isoResult, setIsoResult] = useState<IsoScanResult | null>(null);
  const [isoError, setIsoError] = useState<string | null>(null);

  // Hasher state
  const [hashTargetFile, setHashTargetFile] = useState<File | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [expectedHash, setExpectedHash] = useState<string>("");
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  // Archive state
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [zipResult, setZipResult] = useState<ZipScanResult | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  // Hidden input refs
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const folderAInputRef = useRef<HTMLInputElement | null>(null);
  const folderBInputRef = useRef<HTMLInputElement | null>(null);
  const manifestFileInputRef = useRef<HTMLInputElement | null>(null);
  const isoInputRef = useRef<HTMLInputElement | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  const cancelCurrentTask = () => {
    cancelRef.current.cancelled = true;
    setIsProcessing(false);
  };

  // --------------------------------------------------------------------------
  // RECON HANDLERS
  // --------------------------------------------------------------------------
  const handleReconFolder = async (files: File[]) => {
    if (files.length === 0) return;
    setReconFiles(files);
    setIsProcessing(true);
    setProgress({ done: 0, total: files.length, label: tm.scanning });
    cancelRef.current.cancelled = false;

    try {
      const res = await analyzeFolderStructure(files);
      setReconResult(res);
    } catch (err: any) {
      alert(`Recon Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // MANIFEST HANDLERS
  // --------------------------------------------------------------------------
  const handleGenerateManifest = async () => {
    if (reconFiles.length === 0) {
      alert(lang === "ro" ? "Selectează mai întâi un folder de hărți" : "Please select a folder first");
      return;
    }
    setIsProcessing(true);
    cancelRef.current.cancelled = false;

    try {
      const mf = await generateManifest(
        reconFiles,
        "sha256",
        (done, total, cur) => {
          setProgress({ done, total, label: `[${done}/${total}] ${cur}` });
        },
        cancelRef.current
      );
      setGeneratedManifest(mf);
    } catch (err: any) {
      alert(`Manifest Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadManifestJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed.files) {
          throw new Error("Invalid manifest: missing 'files' object");
        }
        setUploadedManifest(parsed);
      } catch (err: any) {
        alert(`Invalid JSON Manifest: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleRunVerifyAgainstManifest = async () => {
    const mf = uploadedManifest || generatedManifest;
    if (!mf) {
      alert(lang === "ro" ? "Încarcă un fișier manifest.json" : "Please upload a manifest.json file");
      return;
    }
    if (reconFiles.length === 0) {
      alert(lang === "ro" ? "Selectează folderul de verificat" : "Please select folder to verify");
      return;
    }

    setIsProcessing(true);
    cancelRef.current.cancelled = false;

    try {
      const res = await verifyFolderAgainstManifest(
        reconFiles,
        mf,
        manifestQuick,
        (done, total, cur) => {
          setProgress({ done, total, label: `Verifying: ${cur}` });
        },
        cancelRef.current
      );
      setManifestVerifyResult(res);
    } catch (err: any) {
      alert(`Verification Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // COMPARE HANDLERS
  // --------------------------------------------------------------------------
  const handleRunCompare = async () => {
    if (compareFilesA.length === 0 || compareFilesB.length === 0) {
      alert(
        lang === "ro"
          ? "Selectează ambele foldere (A și B) pentru comparație"
          : "Please select both Folder A and Folder B"
      );
      return;
    }

    setIsProcessing(true);
    cancelRef.current.cancelled = false;

    try {
      const res = await compareFolderTrees(
        compareFilesA,
        compareFilesB,
        compareQuick,
        (done, total, cur) => {
          setProgress({ done, total, label: `Comparing: ${cur}` });
        },
        cancelRef.current
      );
      setCompareResult(res);
    } catch (err: any) {
      alert(`Compare Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // ISO SCAN HANDLERS
  // --------------------------------------------------------------------------
  const handleScanIso = async (file: File) => {
    setIsoFile(file);
    setIsoError(null);
    setIsoResult(null);
    setIsProcessing(true);
    setProgress({ done: 0, total: 100, label: "Scanning ISO Primary Volume Descriptor..." });

    try {
      const res = await scanIsoFile(file);
      setIsoResult(res);
    } catch (err: any) {
      setIsoError(err.message || "Failed to parse ISO");
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // HASHER HANDLERS
  // --------------------------------------------------------------------------
  const handleHashFile = async (file: File) => {
    setHashTargetFile(file);
    setComputedHash(null);
    setIsProcessing(true);
    cancelRef.current.cancelled = false;

    try {
      const hash = await streamHashSha256(
        file,
        (done, total) => {
          const pct = Math.floor((done / total) * 100);
          setProgress({
            done,
            total,
            label: `Hashing ${file.name}: ${formatBytes(done)} / ${formatBytes(total)} (${pct}%)`,
          });
        },
        cancelRef.current
      );
      setComputedHash(hash);
    } catch (err: any) {
      alert(`Hash error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // ZIP SCAN HANDLERS
  // --------------------------------------------------------------------------
  const handleScanZip = async (file: File) => {
    setArchiveFile(file);
    setZipError(null);
    setZipResult(null);
    setIsProcessing(true);
    setProgress({ done: 0, total: 100, label: "Inspecting ZIP Central Directory..." });

    try {
      const res = await scanZipFile(file);
      setZipResult(res);
    } catch (err: any) {
      setZipError(err.message || "Failed to inspect ZIP archive");
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT HELPERS
  // --------------------------------------------------------------------------
  const downloadTextFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReconMarkdown = () => {
    if (!reconResult) return;
    let md = `# RNS 510 Map Source Reconnaissance Report\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Root Folder:** ${reconResult.rootName}\n`;
    md += `**Total Files:** ${reconResult.totalFiles.toLocaleString()}\n`;
    md += `**Total Size:** ${formatBytes(reconResult.totalBytes)}\n`;
    md += `**Structural Fingerprint:** \`${reconResult.fingerprint}\`\n\n`;
    md += `## Structural Risk Flags\n`;
    md += `- FAT32 4 GiB Limit: ${reconResult.flags.fat32Limit ? "⚠️ VIOLATION" : "✅ OK"}\n`;
    md += `- Long Paths (>240 chars): ${reconResult.flags.longPaths ? "⚠️ RISK" : "✅ OK"}\n`;
    md += `- Case Collisions: ${reconResult.flags.caseCollisions ? "⚠️ DETECTED" : "✅ OK"}\n`;
    md += `- Non-ASCII Characters: ${reconResult.flags.nonAscii ? "⚠️ DETECTED" : "✅ OK"}\n\n`;
    md += `## Largest Files\n`;
    reconResult.largestFiles.forEach((f, idx) => {
      md += `${idx + 1}. \`${f.path}\` (${formatBytes(f.size)})\n`;
    });
    downloadTextFile(md, `recon_${reconResult.rootName}.md`, "text/markdown");
  };

  const exportReconJson = () => {
    if (!reconResult) return;
    const jsonStr = JSON.stringify(reconResult, null, 2);
    downloadTextFile(jsonStr, `recon_${reconResult.rootName}.json`, "application/json");
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-fade-in">
      {/* Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Map className="w-6 h-6" />
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {tm.title}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">{tm.subtitle}</p>
        </div>

        {/* Global Progress Bar */}
        {isProcessing && (
          <div className="flex items-center space-x-3 bg-slate-900 border border-blue-500/40 rounded-xl px-4 py-2 shrink-0 animate-pulse">
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            <div className="text-xs">
              <p className="text-blue-300 font-semibold max-w-xs truncate">{progress.label}</p>
            </div>
            <button
              onClick={cancelCurrentTask}
              className="text-xs px-2 py-1 rounded bg-rose-600/30 text-rose-300 hover:bg-rose-600 hover:text-white transition-colors"
            >
              {tm.cancel}
            </button>
          </div>
        )}
      </div>

      {/* Section 0 Honest Operational Limits Callout */}
      <div className="border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg shadow-amber-500/5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                  {tm.disclaimerBadge}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {lang === "ro"
                    ? "Informații de siguranță esențiale înainte de instalare"
                    : "Essential hardware safety context"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                {tm.disclaimerP1}
              </p>
              {showDisclaimer && (
                <div className="pt-2 text-xs text-slate-400 space-y-1 border-t border-slate-800/80 mt-2">
                  <p>• {tm.disclaimerP2}</p>
                  <p>• {tm.disclaimerPrivacy}</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowDisclaimer(!showDisclaimer)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Toggle Details"
          >
            {showDisclaimer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800/80">
        {[
          { id: "recon", label: tm.subtabs.recon, icon: FolderTree },
          { id: "manifest", label: tm.subtabs.manifest, icon: FileCheck2 },
          { id: "compare", label: tm.subtabs.compare, icon: ArrowLeftRight },
          { id: "iso", label: tm.subtabs.iso, icon: Disc3 },
          { id: "hasher", label: tm.subtabs.hasher, icon: Key },
          { id: "archive", label: tm.subtabs.archive, icon: Archive },
          { id: "card", label: tm.subtabs.card, icon: HardDrive },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* SUBTAB 1: RECONNAISSANCE */}
      {/* ==================================================================== */}
      {activeSubTab === "recon" && (
        <div className="space-y-6 animate-fade-in">
          {/* Dropzone for folder */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const items = Array.from(e.dataTransfer.files || []);
              if (items.length > 0) handleReconFolder(items);
            }}
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-all flex flex-col items-center justify-center bg-slate-900/40 relative ${
              isDragOver
                ? "border-blue-500 bg-blue-500/10 scale-[0.99]"
                : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
            }`}
          >
            {/* Native Directory Picker input */}
            <input
              ref={folderInputRef}
              type="file"
              /* @ts-ignore */
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleReconFolder(files);
              }}
            />

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center mb-3">
              <FolderTree className="w-7 h-7 text-blue-400" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
              {tm.dropFolderTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-4">
              {tm.dropFolderSubtitle}
            </p>

            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>{tm.btnSelectFolder}</span>
            </button>
          </div>

          {/* Recon Results Display */}
          {reconResult && (
            <div className="space-y-6">
              {/* Stat Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400">{tm.stats.totalFiles}</span>
                  <p className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                    {reconResult.totalFiles.toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400">{tm.stats.totalSize}</span>
                  <p className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                    {formatBytes(reconResult.totalBytes)}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400">{tm.stats.maxDepth}</span>
                  <p className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                    {reconResult.maxDepth} levels
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400">{tm.stats.fingerprint}</span>
                  <p className="text-xs font-mono text-cyan-400 mt-2 truncate select-all" title={reconResult.fingerprint}>
                    {reconResult.fingerprint.slice(0, 16)}...
                  </p>
                </div>
              </div>

              {/* Risk Flags & Structural Heuristics Banner */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>{tm.flags.title}</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  {/* FAT32 4 GiB Check */}
                  <div
                    className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                      reconResult.flags.fat32Limit
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {reconResult.flags.fat32Limit ? (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {reconResult.flags.fat32Limit
                          ? tm.flags.fat32Warn
                          : "FAT32 4 GiB Safe: All files under 4 GiB"}
                      </p>
                      {reconResult.flags.fat32Violations.length > 0 && (
                        <p className="mt-1 opacity-80">
                          {reconResult.flags.fat32Violations.map((v) => `${v.path} (${formatBytes(v.size)})`).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Long Paths Check */}
                  <div
                    className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                      reconResult.flags.longPaths
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {reconResult.flags.longPaths ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {reconResult.flags.longPaths ? tm.flags.longPathWarn : "Path Lengths: All paths <= 240 chars"}
                      </p>
                    </div>
                  </div>

                  {/* Case Collisions Check */}
                  <div
                    className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                      reconResult.flags.caseCollisions
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {reconResult.flags.caseCollisions ? (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {reconResult.flags.caseCollisions ? tm.flags.caseWarn : "No Case Collisions detected"}
                      </p>
                    </div>
                  </div>

                  {/* ASCII & ISO9660 Check */}
                  <div
                    className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                      reconResult.flags.nonAscii
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {reconResult.flags.nonAscii ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {reconResult.flags.nonAscii ? tm.flags.nonAsciiWarn : "Character Set: Clean ASCII compliant"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extension Histogram & Largest Files Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* File Extension Histogram */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>File Types & Extensions</span>
                  </h4>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {Object.entries(reconResult.extHistogram)
                      .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
                      .map(([ext, data]) => {
                        const pct = reconResult.totalBytes > 0 ? (data.totalBytes / reconResult.totalBytes) * 100 : 0;
                        return (
                          <div key={ext} className="text-xs space-y-1">
                            <div className="flex justify-between text-slate-300">
                              <span className="font-mono font-semibold text-blue-300">{ext}</span>
                              <span className="text-slate-400">
                                {data.count} files • {formatBytes(data.totalBytes)} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                style={{ width: `${Math.max(2, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Largest Files Table */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span>Top Largest Files</span>
                  </h4>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
                    {reconResult.largestFiles.slice(0, 10).map((file, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3"
                      >
                        <span className="font-mono text-slate-300 truncate" title={file.path}>
                          {file.path}
                        </span>
                        <span className="font-semibold text-cyan-400 shrink-0">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Export & Manifest */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={exportReconMarkdown}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center space-x-2 transition-all border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{tm.exportMd}</span>
                </button>

                <button
                  onClick={exportReconJson}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center space-x-2 transition-all border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{tm.exportJson}</span>
                </button>

                <button
                  onClick={() => {
                    setActiveSubTab("manifest");
                    handleGenerateManifest();
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-blue-600/30 ml-auto"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>{tm.manifest.btnGenerate}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 2: MANIFEST & VERIFY */}
      {/* ==================================================================== */}
      {activeSubTab === "manifest" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box A: Generate Manifest */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-blue-400" />
                <span>{tm.manifest.createTitle}</span>
              </h3>
              <p className="text-xs text-slate-400">{tm.manifest.createDesc}</p>

              {reconFiles.length > 0 ? (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <span className="text-slate-400">Selected Source: </span>
                  <span className="font-semibold text-white">{reconResult?.rootName || "Folder"}</span>
                  <span className="text-slate-400 ml-2">({reconFiles.length} files)</span>
                </div>
              ) : (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-dashed border-slate-800 text-xs text-slate-500 text-center">
                  Select a folder in the Recon tab first
                </div>
              )}

              <button
                onClick={handleGenerateManifest}
                disabled={isProcessing || reconFiles.length === 0}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>{tm.manifest.btnGenerate}</span>
              </button>

              {generatedManifest && (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Manifest Ready ({Object.keys(generatedManifest.files).length} files)</span>
                    </span>
                    <button
                      onClick={() =>
                        downloadTextFile(
                          JSON.stringify(generatedManifest, null, 2),
                          `manifest_${generatedManifest.root_name}.json`,
                          "application/json"
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{tm.manifest.btnDownload}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Box B: Verify against Manifest */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Search className="w-5 h-5 text-indigo-400" />
                <span>{tm.manifest.verifyTitle}</span>
              </h3>

              {/* Upload Manifest File */}
              <input
                ref={manifestFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleUploadManifestJson(e.target.files[0]);
                }}
              />

              <div
                onClick={() => manifestFileInputRef.current?.click()}
                className="p-4 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl text-center cursor-pointer bg-slate-950/40 text-xs text-slate-400 hover:text-white transition-all flex flex-col items-center justify-center space-y-1"
              >
                <Upload className="w-5 h-5 text-indigo-400" />
                <span className="font-semibold text-slate-300">
                  {uploadedManifest
                    ? `Loaded: manifest_${uploadedManifest.root_name}.json (${uploadedManifest.total_files} files)`
                    : tm.manifest.dropManifest}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  id="chkManifestQuick"
                  checked={manifestQuick}
                  onChange={(e) => setManifestQuick(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="chkManifestQuick" className="cursor-pointer select-none">
                  {tm.manifest.quickCheck}
                </label>
              </div>

              <button
                onClick={handleRunVerifyAgainstManifest}
                disabled={isProcessing || (!uploadedManifest && !generatedManifest) || reconFiles.length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>{tm.manifest.btnVerify}</span>
              </button>
            </div>
          </div>

          {/* Verification Results Table */}
          {manifestVerifyResult && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Verification Results</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      manifestVerifyResult.summary.verdict === "PASS"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {manifestVerifyResult.summary.verdict}
                  </span>
                </h4>

                <span className="text-xs text-slate-400">
                  {manifestVerifyResult.summary.matchCount} / {manifestVerifyResult.summary.totalFiles} matched
                </span>
              </div>

              {manifestVerifyResult.summary.problemCount > 0 ? (
                <div className="space-y-2 text-xs">
                  {manifestVerifyResult.missing.map((p) => (
                    <div key={p} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                      [MISSING]: {p}
                    </div>
                  ))}
                  {manifestVerifyResult.hashMismatch.map((m) => (
                    <div key={m.path} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                      [HASH MISMATCH]: {m.path}
                    </div>
                  ))}
                  {manifestVerifyResult.sizeMismatch.map((s) => (
                    <div key={s.path} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                      [SIZE MISMATCH]: {s.path} (Expected: {formatBytes(s.manifestSize)}, Actual: {formatBytes(s.actualSize)})
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>100% Match! All files in target folder match the reference manifest exactly.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 3: DIRECT COMPARE */}
      {/* ==================================================================== */}
      {activeSubTab === "compare" && (
        <div className="space-y-6 animate-fade-in">
          {/* Removable Media Eject Notice */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start space-x-3 text-xs text-blue-200">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-300">{tm.compare.ejectNoticeTitle}</p>
              <p className="mt-0.5 leading-relaxed">{tm.compare.ejectNoticeText}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Folder A Picker */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FolderTree className="w-5 h-5 text-blue-400" />
                <span>{tm.compare.folderA}</span>
              </h3>

              <input
                ref={folderAInputRef}
                type="file"
                /* @ts-ignore */
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={(e) => setCompareFilesA(Array.from(e.target.files || []))}
              />

              <button
                onClick={() => folderAInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all border border-slate-700 flex items-center justify-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {compareFilesA.length > 0 ? `Selected A (${compareFilesA.length} files)` : tm.btnSelectFolder}
                </span>
              </button>
            </div>

            {/* Folder B Picker */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <span>{tm.compare.folderB}</span>
              </h3>

              <input
                ref={folderBInputRef}
                type="file"
                /* @ts-ignore */
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={(e) => setCompareFilesB(Array.from(e.target.files || []))}
              />

              <button
                onClick={() => folderBInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all border border-slate-700 flex items-center justify-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {compareFilesB.length > 0 ? `Selected B (${compareFilesB.length} files)` : tm.btnSelectFolder}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <input
                type="checkbox"
                id="chkCompareQuick"
                checked={compareQuick}
                onChange={(e) => setCompareQuick(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0"
              />
              <label htmlFor="chkCompareQuick" className="cursor-pointer select-none">
                {tm.manifest.quickCheck}
              </label>
            </div>

            <button
              onClick={handleRunCompare}
              disabled={isProcessing || compareFilesA.length === 0 || compareFilesB.length === 0}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center space-x-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{tm.compare.btnCompare}</span>
            </button>
          </div>

          {/* Compare Results Display */}
          {compareResult && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Comparison Verdict</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      compareResult.summary.verdict === "PASS"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {compareResult.summary.verdict}
                  </span>
                </h4>
              </div>

              {compareResult.summary.problemCount === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>100% Identical! Both folder trees match perfectly in structure and content.</span>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {compareResult.missing.map((p) => (
                    <div key={p} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                      [MISSING IN B]: {p}
                    </div>
                  ))}
                  {compareResult.extra.map((p) => (
                    <div key={p} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      [EXTRA IN B]: {p}
                    </div>
                  ))}
                  {compareResult.hashMismatch.map((m) => (
                    <div key={m.path} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                      [CONTENT DIFFERENCE]: {m.path}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 4: ISO SCAN */}
      {/* ==================================================================== */}
      {activeSubTab === "iso" && (
        <div className="space-y-6 animate-fade-in">
          <input
            ref={isoInputRef}
            type="file"
            accept=".iso"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleScanIso(e.target.files[0]);
            }}
          />

          <div
            onClick={() => isoInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center bg-slate-900/40"
          >
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
              <Disc3 className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">{tm.iso.title}</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-4">{tm.iso.desc}</p>
            <button className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-cyan-600/30 flex items-center space-x-2">
              <Disc3 className="w-4 h-4" />
              <span>{isoFile ? isoFile.name : tm.iso.dropIso}</span>
            </button>
          </div>

          {isoError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{isoError}</span>
            </div>
          )}

          {isoResult && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>ISO Volume Verification</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      isoResult.isTruncated
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {isoResult.isTruncated ? "TRUNCATED" : "VALID"}
                  </span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Volume Label:</span>
                  <p className="font-bold text-white mt-1">{isoResult.volumeLabel || "[UNLABELLED]"}</p>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400">{tm.iso.declaredSize}:</span>
                  <p className="font-bold text-white mt-1">{formatBytes(isoResult.declaredVolumeSize)}</p>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400">{tm.iso.actualSize}:</span>
                  <p className="font-bold text-white mt-1">{formatBytes(isoResult.fileSize)}</p>
                </div>
              </div>

              {isoResult.isTruncated ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                  <p className="font-bold flex items-center space-x-1.5">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>{tm.iso.truncatedAlert}</span>
                  </p>
                  <p>Missing bytes: {formatBytes(isoResult.truncatedBytesMissing || 0)}. The file was cut short.</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{tm.iso.validAlert}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 5: HASHER */}
      {/* ==================================================================== */}
      {activeSubTab === "hasher" && (
        <div className="space-y-6 animate-fade-in">
          <input
            ref={singleFileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleHashFile(e.target.files[0]);
            }}
          />

          <div
            onClick={() => singleFileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center bg-slate-900/40"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
              <Key className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">{tm.hasher.title}</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-4">{tm.hasher.dropFile}</p>
            <button className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>{hashTargetFile ? hashTargetFile.name : tm.btnSelectFiles}</span>
            </button>
          </div>

          {computedHash && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-semibold">Calculated SHA-256 Hash:</span>
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={computedHash}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-400 select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(computedHash);
                      setCopiedHash(true);
                      setTimeout(() => setCopiedHash(false), 2000);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Copy Hash"
                  >
                    {copiedHash ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 font-semibold">{tm.hasher.expectedHash}:</span>
                <input
                  type="text"
                  value={expectedHash}
                  onChange={(e) => setExpectedHash(e.target.value.trim().toLowerCase())}
                  placeholder="Paste expected SHA-256 checksum here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white mt-1 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {expectedHash && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                    expectedHash === computedHash.toLowerCase()
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {expectedHash === computedHash.toLowerCase() ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold">{tm.hasher.matchOk}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span className="font-bold">{tm.hasher.matchFail}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 6: ARCHIVE CRC */}
      {/* ==================================================================== */}
      {activeSubTab === "archive" && (
        <div className="space-y-6 animate-fade-in">
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleScanZip(e.target.files[0]);
            }}
          />

          <div
            onClick={() => zipInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center bg-slate-900/40"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
              <Archive className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">{tm.archive.title}</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-4">{tm.archive.dropZip}</p>
            <button className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-amber-600/30 flex items-center space-x-2">
              <Archive className="w-4 h-4" />
              <span>{archiveFile ? archiveFile.name : tm.btnSelectFiles}</span>
            </button>
          </div>

          {zipError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{zipError}</span>
            </div>
          )}

          {zipResult && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Archive Central Directory</span>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    CRC32 VALID
                  </span>
                </h4>
                <span className="text-xs text-slate-400">
                  {zipResult.totalMembers} members • Uncompressed: {formatBytes(zipResult.totalUncompressedSize)}
                </span>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 text-xs font-mono">
                {zipResult.members.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-slate-300"
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-amber-400 shrink-0">CRC: {m.crc32}</span>
                    <span className="text-slate-400 shrink-0">{formatBytes(m.uncompressedSize)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB 7: SD CARD ADVISOR */}
      {/* ==================================================================== */}
      {activeSubTab === "card" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-blue-400" />
              <span>{tm.card.title}</span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">FAT32 File System Requirement</p>
                  <p className="text-slate-400 mt-1">{tm.card.fat32Note}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Recommended Media Quality</p>
                  <p className="text-slate-400 mt-1">{tm.card.speedNote}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3">
                <Key className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Counterfeit Media & Fake Capacity Detection</p>
                  <p className="text-slate-400 mt-1">{tm.card.cliTestNote}</p>
                  <div className="mt-2 p-2.5 rounded-lg bg-black/60 border border-slate-800 font-mono text-xs text-cyan-300 select-all">
                    verify_map.bat
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
