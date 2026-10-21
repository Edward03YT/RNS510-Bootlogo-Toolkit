"use client";

import React, { useState, useRef } from "react";
import { DisplayMode, Language } from "@/types";
import { translations } from "@/lib/translations";
import { Eye, Monitor, Columns, Power, Disc, Sparkles } from "lucide-react";

interface BezelSimulatorProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  originalCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  showCrtGrid: boolean;
  onToggleCrtGrid: (show: boolean) => void;
  showBacklightGlow: boolean;
  onToggleBacklightGlow: (show: boolean) => void;
  lang?: Language;
  hasImage?: boolean;
}

export const BezelSimulator: React.FC<BezelSimulatorProps> = ({
  canvasRef,
  originalCanvasRef,
  displayMode,
  onDisplayModeChange,
  showCrtGrid,
  onToggleCrtGrid,
  showBacklightGlow,
  onToggleBacklightGlow,
  lang = "ro",
  hasImage = true,
}) => {
  const t = translations[lang];
  const [splitPos, setSplitPos] = useState<number>(50); // percentage
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSplitPos((x / rect.width) * 100);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Top Controls Toolbar - Mobile Scrollable & Touch-Friendly */}
      <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 mb-3 px-1 sm:px-2">
        <div className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs overflow-x-auto scrollbar-none">
          <button
            onClick={() => onDisplayModeChange("cockpit")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
              displayMode === "cockpit"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Monitor className="w-3.5 h-3.5 shrink-0" />
            <span>{t.bezel.bezelTitle}</span>
          </button>

          <button
            onClick={() => onDisplayModeChange("frameless")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
              displayMode === "frameless"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>{t.bezel.framelessTitle}</span>
          </button>

          <button
            onClick={() => onDisplayModeChange("split")}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
              displayMode === "split"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Columns className="w-3.5 h-3.5 shrink-0" />
            <span>{t.bezel.splitTitle}</span>
          </button>
        </div>

        {/* Visual Filter Toggles */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs overflow-x-auto scrollbar-none self-end sm:self-auto">
          <button
            onClick={() => onToggleCrtGrid(!showCrtGrid)}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border transition-all shrink-0 ${
              showCrtGrid
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 font-medium"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{t.bezel.tftTitle}</span>
          </button>

          <button
            onClick={() => onToggleBacklightGlow(!showBacklightGlow)}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border transition-all shrink-0 ${
              showBacklightGlow
                ? "bg-red-500/10 border-red-500/40 text-red-400 font-medium"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
            <span>{t.bezel.redGlowTitle}</span>
          </button>
        </div>
      </div>

      {/* Screen Container */}
      <div className="w-full flex justify-center py-1 sm:py-2">
        {displayMode === "cockpit" ? (
          /* ================================================================ */
          /* REALISTIC VW RNS 510 HEAD UNIT BEZEL (MOBILE-RESPONSIVE)        */
          /* ================================================================ */
          <div
            className={`relative p-2.5 sm:p-5 md:p-7 rounded-[20px] sm:rounded-[28px] bg-gradient-to-b from-stone-900 via-neutral-900 to-black border-2 border-stone-800 shadow-2xl transition-all max-w-[960px] w-full ${
              showBacklightGlow
                ? "shadow-[0_0_50px_-10px_rgba(239,68,68,0.25)] ring-1 ring-red-500/20"
                : "shadow-black"
            }`}
          >
            {/* Top OEM CD / DVD Slot */}
            <div className="flex items-center justify-between px-2 sm:px-6 pb-2.5 sm:pb-4">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-[9px] sm:text-[10px] tracking-widest uppercase font-extrabold text-stone-500 hidden xs:inline">
                  VOLKSWAGEN
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold text-stone-400 bg-stone-800/80 px-1.5 py-0.5 rounded">
                  RNS 510
                </span>
              </div>

              {/* Slot */}
              <div className="relative flex-1 max-w-[380px] mx-2 sm:mx-4 h-2 sm:h-2.5 bg-black rounded-full border border-stone-800 shadow-inner flex items-center justify-center">
                <div className="w-11/12 h-0.5 bg-stone-950 rounded-full"></div>
              </div>

              <div className="flex items-center space-x-1 sm:space-x-3 text-stone-500">
                <Disc className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                <span className="text-[9px] sm:text-[10px] tracking-wider font-semibold text-stone-500 hidden sm:inline">
                  CD / DVD
                </span>
              </div>
            </div>

            {/* Main Center Console: Left Buttons + Screen + Right Buttons */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-4 md:gap-5">
              {/* Left Button Column */}
              <div className="flex flex-col space-y-1.5 sm:space-y-2.5 md:space-y-3 shrink-0">
                {["RADIO", "MEDIA", "PHONE", "TIM"].map((btn) => (
                  <button
                    key={btn}
                    className={`w-9 sm:w-14 md:w-16 h-6 sm:h-8 md:h-9 rounded sm:rounded-md bg-stone-900/90 border border-stone-800/90 shadow-md text-[8px] sm:text-[10px] md:text-[11px] font-bold tracking-wider transition-all hover:bg-stone-800 active:scale-95 flex items-center justify-center px-0.5 ${
                      showBacklightGlow
                        ? "text-red-500 shadow-red-500/10"
                        : "text-stone-300"
                    }`}
                  >
                    {btn}
                  </button>
                ))}

                {/* Left Rotary Knob (Volume / Power) */}
                <div className="pt-1 sm:pt-2 flex justify-center">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 md:w-13 md:h-13 rounded-full bg-gradient-to-tr from-stone-950 via-stone-800 to-stone-700 p-0.5 sm:p-1 shadow-lg border border-stone-700/80 flex items-center justify-center cursor-pointer hover:rotate-12 transition-transform">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-stone-900 flex items-center justify-center border border-stone-800">
                      <Power
                        className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${
                          showBacklightGlow ? "text-red-500" : "text-stone-400"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Central 800x480 Display with Inset Frame */}
              <div className="relative flex-1 aspect-[800/480] bg-black rounded-lg border sm:border-2 border-stone-950 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden flex items-center justify-center">
                {/* Simulated Canvas */}
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={480}
                  className="w-full h-full object-contain block"
                />

                {/* Empty Standby Overlay when no image is loaded */}
                {!hasImage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-3 sm:p-6 z-20 pointer-events-none">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mb-2 sm:mb-3 text-cyan-400 shadow-lg shadow-blue-500/10">
                      <Disc className="w-5 h-5 sm:w-7 sm:h-7 animate-pulse" />
                    </div>
                    <span className="font-mono text-xs sm:text-sm font-bold text-slate-200 tracking-wider uppercase">
                      {t.bezel.standbyWelcome}
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                      {t.bezel.standbyHint}
                    </span>
                  </div>
                )}

                {/* CRT / LCD Scanline Grid Overlay */}
                {showCrtGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-overlay"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 255, 0, 0.05))",
                      backgroundSize: "100% 3px, 4px 100%",
                    }}
                  />
                )}

                {/* Glass screen reflection glare */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent"></div>
              </div>

              {/* Right Button Column */}
              <div className="flex flex-col space-y-1.5 sm:space-y-2.5 md:space-y-3 shrink-0">
                {["NAV", "TRAFFIC", "SETUP", "MUTE"].map((btn) => (
                  <button
                    key={btn}
                    className={`w-9 sm:w-14 md:w-16 h-6 sm:h-8 md:h-9 rounded sm:rounded-md bg-stone-900/90 border border-stone-800/90 shadow-md text-[8px] sm:text-[10px] md:text-[11px] font-bold tracking-wider transition-all hover:bg-stone-800 active:scale-95 flex items-center justify-center px-0.5 ${
                      showBacklightGlow
                        ? "text-red-500 shadow-red-500/10"
                        : "text-stone-300"
                    }`}
                  >
                    {btn}
                  </button>
                ))}

                {/* Right Rotary Knob (Tune / Browse) */}
                <div className="pt-1 sm:pt-2 flex justify-center">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 md:w-13 md:h-13 rounded-full bg-gradient-to-tr from-stone-950 via-stone-800 to-stone-700 p-0.5 sm:p-1 shadow-lg border border-stone-700/80 flex items-center justify-center cursor-pointer hover:-rotate-12 transition-transform">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-stone-900 flex items-center justify-center border border-stone-800">
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-600"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Panel: Dual SD Card Slot */}
            <div className="flex items-center justify-between px-2 sm:px-6 pt-2 sm:pt-3 mt-1 border-t border-stone-800/60">
              <span className="text-[8px] sm:text-[9px] font-semibold tracking-wider text-stone-500 hidden sm:inline">
                RGB555 15-BIT HARDWARE SIMULATOR
              </span>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <div className="w-5 sm:w-7 h-1 sm:h-1.5 bg-black rounded-sm border border-stone-800"></div>
                <span className="text-[8px] sm:text-[9px] font-bold text-stone-500">SD</span>
              </div>
              <span className="text-[8px] sm:text-[9px] font-semibold tracking-wider text-stone-500">
                800 × 480 WVGA
              </span>
            </div>
          </div>
        ) : displayMode === "frameless" ? (
          /* ================================================================ */
          /* FRAMELESS 800x480 VIEW                                           */
          /* ================================================================ */
          <div className="relative w-full max-w-[840px] aspect-[800/480] bg-black rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={800}
              height={480}
              className="w-full h-full object-contain block"
            />
            {!hasImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-4 z-20 pointer-events-none">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mb-2 text-cyan-400">
                  <Disc className="w-6 h-6 animate-pulse" />
                </div>
                <span className="font-mono text-xs sm:text-sm font-bold text-slate-200">
                  {t.bezel.standbyWelcome}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-xs">
                  {t.bezel.standbyHint}
                </span>
              </div>
            )}
            {showCrtGrid && (
              <div
                className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 255, 0, 0.05))",
                  backgroundSize: "100% 3px, 4px 100%",
                }}
              />
            )}
          </div>
        ) : (
          /* ================================================================ */
          /* HARDWARE SPLIT VIEW (ORIGINAL VS RGB555 SIMULATED)             */
          /* ================================================================ */
          <div
            ref={containerRef}
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => setIsDragging(false)}
            onPointerLeave={() => setIsDragging(false)}
            onPointerMove={handlePointerMove}
            className="relative w-full max-w-[840px] aspect-[800/480] bg-black rounded-xl border border-slate-800 shadow-2xl overflow-hidden select-none cursor-ew-resize"
          >
            {/* Background: Original Composite Canvas */}
            <div className="absolute inset-0 w-full h-full">
              <canvas
                ref={originalCanvasRef}
                width={800}
                height={480}
                className="w-full h-full object-contain block"
              />
              <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 bg-slate-900/90 backdrop-blur px-2 py-1 rounded text-[9px] sm:text-[10px] font-semibold text-slate-300 border border-slate-800">
                {t.bezel.originalLabel}
              </div>
            </div>

            {/* Foreground: RNS 510 Simulated 15-bit RGB555 Canvas (Clipped) */}
            <div
              className="absolute inset-0 w-full h-full overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${splitPos}%)` }}
            >
              <canvas
                ref={canvasRef}
                width={800}
                height={480}
                className="w-full h-full object-contain block"
              />
              {showCrtGrid && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 255, 0, 0.05))",
                    backgroundSize: "100% 3px, 4px 100%",
                  }}
                />
              )}
              <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 bg-blue-900/90 backdrop-blur px-2 py-1 rounded text-[9px] sm:text-[10px] font-semibold text-cyan-300 border border-blue-700/60">
                {t.bezel.simulatedLabel}
              </div>
            </div>

            {/* Draggable Divider Line */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] z-20"
              style={{ left: `${splitPos}%`, transform: "translateX(-50%)" }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-slate-900 shadow-lg flex items-center justify-center text-[10px] font-bold">
                ⇄
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
