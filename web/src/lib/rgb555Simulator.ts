import { FitMode, Diagnostics } from "@/types";

export interface SimulatorOptions {
  fitMode: FitMode;
  cleanBlack: boolean;
  brightness: number; // -50 to 50
  contrast: number;   // -50 to 50
  rotation: number;   // 0, 90, 180, 270
  flipH: boolean;
}

export interface SimulationResult {
  simulatedCanvas: HTMLCanvasElement;
  originalCanvas: HTMLCanvasElement;
  diagnostics: Diagnostics;
}

export function simulateRns510Hardware(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  options: SimulatorOptions
): SimulationResult {
  const targetW = 800;
  const targetH = 480;

  // 1. Create original composite canvas (800x480) with user adjustments
  const origCanvas = document.createElement("canvas");
  origCanvas.width = targetW;
  origCanvas.height = targetH;
  const origCtx = origCanvas.getContext("2d", { willReadFrequently: true });

  if (!origCtx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  // Pure black background (0,0,0)
  origCtx.fillStyle = "#000000";
  origCtx.fillRect(0, 0, targetW, targetH);

  // Apply Brightness & Contrast filter to context
  const bVal = 100 + options.brightness;
  const cVal = 100 + options.contrast;
  origCtx.filter = `brightness(${bVal}%) contrast(${cVal}%)`;

  origCtx.save();

  // Position & transform for rotation and flip
  origCtx.translate(targetW / 2, targetH / 2);
  if (options.rotation !== 0) {
    origCtx.rotate((options.rotation * Math.PI) / 180);
  }
  if (options.flipH) {
    origCtx.scale(-1, 1);
  }

  const rawW = sourceImage instanceof HTMLImageElement ? sourceImage.naturalWidth || sourceImage.width : sourceImage.width;
  const rawH = sourceImage instanceof HTMLImageElement ? sourceImage.naturalHeight || sourceImage.height : sourceImage.height;
  const srcW = rawW > 0 ? rawW : targetW;
  const srcH = rawH > 0 ? rawH : targetH;

  // Determine drawing dimensions based on fitMode
  let drawW = targetW;
  let drawH = targetH;

  if (options.fitMode === "stretch") {
    drawW = targetW;
    drawH = targetH;
  } else if (options.fitMode === "crop") {
    const scale = Math.max(targetW / srcW, targetH / srcH);
    drawW = srcW * scale;
    drawH = srcH * scale;
  } else {
    // "pad"
    const scale = Math.min(targetW / srcW, targetH / srcH);
    drawW = srcW * scale;
    drawH = srcH * scale;
  }

  origCtx.drawImage(
    sourceImage,
    -drawW / 2,
    -drawH / 2,
    drawW,
    drawH
  );

  origCtx.restore();
  origCtx.filter = "none";

  // 2. Read pixels to simulate 15-bit RGB555 DAC & anti-noise filter
  const imgData = origCtx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  const simCanvas = document.createElement("canvas");
  simCanvas.width = targetW;
  simCanvas.height = targetH;
  const simCtx = simCanvas.getContext("2d", { willReadFrequently: true });
  if (!simCtx) {
    throw new Error("Unable to obtain simulation canvas context");
  }

  const simImgData = simCtx.createImageData(targetW, targetH);
  const simData = simImgData.data;

  let greenNoisePixels = 0;
  const totalPixels = targetW * targetH; // 384,000

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    // Alpha blending with pure black
    if (a < 255) {
      const alpha = a / 255;
      r = Math.round(r * alpha);
      g = Math.round(g * alpha);
      b = Math.round(b * alpha);
    }

    let r5 = 0;
    let g5 = 0;
    let b5 = 0;

    if (options.cleanBlack && r < 10 && g < 10 && b < 10) {
      // Clamped to pure black
      r5 = 0;
      g5 = 0;
      b5 = 0;
    } else {
      r5 = (r >> 3) & 0x1f;
      g5 = (g >> 3) & 0x1f;
      b5 = (b >> 3) & 0x1f;

      if (options.cleanBlack && r5 === 0 && b5 === 0 && g5 <= 1) {
        g5 = 0;
      }
    }

    // Diagnostic check for green artifact specks
    if (g5 > 0 && r5 === 0 && b5 === 0 && g5 <= 3) {
      greenNoisePixels++;
    } else if (g5 > r5 + 3 && g5 > b5 + 3 && r5 + g5 + b5 < 18) {
      greenNoisePixels++;
    }

    // Hardware DAC output to 8-bit monitor representation
    const r8 = Math.floor((r5 * 255) / 31);
    const g8 = Math.floor((g5 * 255) / 31);
    const b8 = Math.floor((b5 * 255) / 31);

    simData[i] = r8;
    simData[i + 1] = g8;
    simData[i + 2] = b8;
    simData[i + 3] = 255;
  }

  simCtx.putImageData(simImgData, 0, 0);

  const diagnostics: Diagnostics = {
    width: targetW,
    height: targetH,
    totalPixels,
    expectedPixels: 384000,
    bit15Errors: 0,
    greenNoisePixels,
    isPerfect: greenNoisePixels === 0,
  };

  return {
    simulatedCanvas: simCanvas,
    originalCanvas: origCanvas,
    diagnostics,
  };
}
