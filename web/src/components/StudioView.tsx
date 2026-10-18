"use client";

import React, { useState, useRef, useEffect } from "react";
import { FitMode, DisplayMode, Diagnostics, GenerationResult, Language } from "@/types";
import { translations } from "@/lib/translations";
import { simulateRns510Hardware } from "@/lib/rgb555Simulator";
import { BezelSimulator } from "@/components/BezelSimulator";
import { DiagnosticBadge } from "@/components/DiagnosticBadge";
import { GenerationModal } from "@/components/GenerationModal";
import { encodeRgb555Rle, buildFliData } from "@/lib/rns510Core";
import {
  Upload,
  Image as ImageIcon,
  RotateCw,
  FlipHorizontal,
  Sun,
  Contrast,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Disc3,
  RefreshCw,
} from "lucide-react";

interface StudioViewProps {
  lang: Language;
  presetSvgToLoad?: string | null;
  onClearPreset?: () => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  lang,
  presetSvgToLoad,
  onClearPreset,
}) => {
  const t = translations[lang];

  // Simulator Canvas Refs
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const origCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image Source
  const [currentImageElement, setCurrentImageElement] = useState<HTMLImageElement | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Settings
  const [fitMode, setFitMode] = useState<FitMode>("pad");
  const [cleanBlack, setCleanBlack] = useState<boolean>(true);
  const [brightness, setBrightness] = useState<number>(0); // -50 to 50
  const [contrast, setContrast] = useState<number>(0);     // -50 to 50
  const [rotation, setRotation] = useState<number>(0);     // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);

  // Display Settings
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cockpit");
  const [showCrtGrid, setShowCrtGrid] = useState<boolean>(false);
  const [showBacklightGlow, setShowBacklightGlow] = useState<boolean>(true);

  // Real-time Diagnostics
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  // Generation Modal & API
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<number>(0);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  // Load Preset if provided from Presets Tab
  useEffect(() => {
    if (presetSvgToLoad) {
      loadSvgStringToImage(presetSvgToLoad);
      if (onClearPreset) onClearPreset();
    }
  }, [presetSvgToLoad]);

  // Default initial image: Default to Volkswagen R Performance badge on startup
  useEffect(() => {
    if (!currentImageElement && !presetSvgToLoad) {
      // Default to high-res SVG preset on launch
      import("@/lib/presets").then(({ PRESET_LOGOS }) => {
        loadSvgStringToImage(PRESET_LOGOS[0].svgData);
      });
    }
  }, []);

  const loadSvgStringToImage = (svgString: string) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      setCurrentImageElement(img);
      // Create a dummy file for generation
      fetch(url)
        .then((res) => res.blob())
        .then((b) => {
          const f = new File([b], "preset_logo.png", { type: "image/png" });
          setCurrentFile(f);
        });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const isImageFile = (file: File) => {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    return /\.(png|jpe?g|bmp|webp|svg|gif|tiff?|ico)$/i.test(file.name);
  };

  const handleFileUpload = (file: File) => {
    if (!isImageFile(file)) return;
    setCurrentFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        setCurrentImageElement(img);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Re-run simulation whenever source image or adjustment options change
  useEffect(() => {
    if (!currentImageElement || !simCanvasRef.current) return;

    try {
      const res = simulateRns510Hardware(currentImageElement, {
        fitMode,
        cleanBlack,
        brightness,
        contrast,
        rotation,
        flipH,
      });

      // Transfer simulated pixels to displayed canvas
      const simTarget = simCanvasRef.current;
      const simCtx = simTarget.getContext("2d");
      if (simCtx) {
        simCtx.clearRect(0, 0, 800, 480);
        simCtx.drawImage(res.simulatedCanvas, 0, 0);
      }

      // Transfer original composite to displayed original canvas if mounted
      if (origCanvasRef.current) {
        const origTarget = origCanvasRef.current;
        const origCtx = origTarget.getContext("2d");
        if (origCtx) {
          origCtx.clearRect(0, 0, 800, 480);
          origCtx.drawImage(res.originalCanvas, 0, 0);
        }
      }

      setDiagnostics(res.diagnostics);
    } catch (e) {
      console.error("Simulation error:", e);
    }
  }, [currentImageElement, fitMode, cleanBlack, brightness, contrast, rotation, flipH, displayMode]);

  // Handle ISO Generation via Next.js API
  const handleGenerateIso = async () => {
    if (!simCanvasRef.current) return;

    setIsModalOpen(true);
    setIsGenerating(true);
    setGenerationStep(0);
    setGenerationResult(null);

    // Simulate animated progress steps
    const timer1 = setTimeout(() => setGenerationStep(1), 500);
    const timer2 = setTimeout(() => setGenerationStep(2), 1200);
    const timer3 = setTimeout(() => setGenerationStep(3), 1900);

    try {
      // Convert the currently simulated/rendered canvas directly to PNG Blob!
      // This ensures exact WYSIWYG matching with all brightness, contrast, rotation and fit adjustments!
      const canvasBlob = await new Promise<Blob | null>((resolve) => {
        simCanvasRef.current?.toBlob((b) => resolve(b), "image/png");
      });

      if (!canvasBlob) {
        throw new Error("Failed to encode canvas image");
      }

      const formData = new FormData();
      formData.append("image", canvasBlob, currentFile?.name || "custom_rns510.png");
      formData.append("fitMode", "pad"); // Canvas is already 800x480
      formData.append("cleanBlack", cleanBlack ? "true" : "false");

      // Generate FLI blob directly from simulated canvas pixels
      const simCanvas = simCanvasRef.current;
      const simCtx = simCanvas.getContext("2d");
      const imgData = simCtx?.getImageData(0, 0, 800, 480);
      if (imgData) {
        const rle = encodeRgb555Rle(imgData.data, 800, 480, cleanBlack);
        const fliData = buildFliData(rle, 800, 480);
        // Copy to standard Uint8Array buffer
        const fliBuffer = new Uint8Array(fliData);
        const fliBlob = new Blob([fliBuffer], { type: "application/octet-stream" });
        formData.append("fli", fliBlob, "LOGO.FLI");
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      setIsGenerating(false);
      setGenerationResult(data);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsGenerating(false);
      setGenerationResult({
        success: false,
        error: err.message || "Failed to generate ISO",
      });
    }
  };

  const handleResetAdjustments = () => {
    setBrightness(0);
    setContrast(0);
    setRotation(0);
    setFlipH(false);
    setFitMode("pad");
    setCleanBlack(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-fade-in">
      {/* Top Head Unit / Screen Simulator */}
      <div className="w-full">
        <BezelSimulator
          canvasRef={simCanvasRef}
          originalCanvasRef={origCanvasRef}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          showCrtGrid={showCrtGrid}
          onToggleCrtGrid={setShowCrtGrid}
          showBacklightGlow={showBacklightGlow}
          onToggleBacklightGlow={setShowBacklightGlow}
        />
      </div>

      {/* Real-time Diagnostics Bar */}
      <DiagnosticBadge diagnostics={diagnostics} lang={lang} />

      {/* Main Studio Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1: Image Upload & Dropzone */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-white font-bold text-sm mb-3">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              <span>{t.studio.selectFile}</span>
            </div>

            {/* Drop Zone */}
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
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                isDragOver
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.bmp,.webp,.svg,.gif"
                className="hidden"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                  e.target.value = "";
                }}
              />
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {t.studio.uploadTitle}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {t.studio.uploadSubtitle}
              </p>
            </div>
          </div>

          {/* Current File Preview Info */}
          {currentFile && (
            <div className="mt-3 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-black border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                  {currentImageElement ? (
                    <img
                      src={currentImageElement.src}
                      alt="Source"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {currentFile.name}
                  </p>
                  <p className="text-[10px] text-emerald-400">
                    {currentImageElement?.naturalWidth || 800} × {currentImageElement?.naturalHeight || 480} px
                  </p>
                </div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-cyan-400 hover:underline font-medium shrink-0 ml-2"
              >
                {t.studio.changeImage}
              </button>
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Status:</span>
            <span className="text-emerald-400 font-medium">
              {currentFile ? "Imagine Încărcată pe Ecran ✓" : "Preset Activ"}
            </span>
          </div>
        </div>

        {/* Col 2: Image Sizing & Anti-Noise Filter */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center space-x-2 text-white font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>{t.studio.controlsTitle}</span>
          </div>

          {/* Fit Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {t.studio.fitModeLabel}
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(["pad", "crop", "stretch"] as FitMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFitMode(mode)}
                  className={`py-2 px-2 rounded-lg font-medium capitalize border transition-all text-center ${
                    fitMode === mode
                      ? "bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {mode === "pad"
                    ? "Pad (000 Bars)"
                    : mode === "crop"
                    ? "Crop & Fill"
                    : "Stretch"}
                </button>
              ))}
            </div>
          </div>

          {/* Anti-Noise Toggle */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t.studio.antiNoiseLabel}</span>
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanBlack}
                  onChange={(e) => setCleanBlack(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t.studio.antiNoiseDesc}
            </p>
          </div>
        </div>

        {/* Col 3: Visual Adjustments & Generate Button */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-sm">
                Fine-Tuning Adjustments
              </span>
              <button
                onClick={handleResetAdjustments}
                className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1"
                title="Reset all sliders"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t.studio.resetAdjustments}</span>
              </button>
            </div>

            {/* Brightness Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center space-x-1">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.studio.brightness}</span>
                </span>
                <span className="font-mono text-slate-400">{brightness > 0 ? `+${brightness}` : brightness}%</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Contrast Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center space-x-1">
                  <Contrast className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t.studio.contrast}</span>
                </span>
                <span className="font-mono text-slate-400">{contrast > 0 ? `+${contrast}` : contrast}%</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Rotation & Flip */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                <span>{t.studio.rotate} ({rotation}°)</span>
              </button>

              <button
                onClick={() => setFlipH(!flipH)}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  flipH
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5 text-blue-400" />
                <span>{t.studio.flipH}</span>
              </button>
            </div>
          </div>

          {/* GENERATE ISO BUTTON */}
          <div className="pt-4">
            <button
              onClick={handleGenerateIso}
              disabled={isGenerating}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 font-extrabold text-sm sm:text-base text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2.5 cursor-pointer"
            >
              <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
              <span>{t.studio.generateBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Generation Stepper / Download Modal */}
      <GenerationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isLoading={isGenerating}
        progressStep={generationStep}
        result={generationResult}
        lang={lang}
      />
    </div>
  );
};
