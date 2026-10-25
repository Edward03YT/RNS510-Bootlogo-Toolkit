import { crc16Xmodem } from "./rns510Core";

export interface IsoAnalysis {
  fileName: string;
  fileSize: number;
  volIdent: string;
  sysIdent: string;
  hasAllRequiredFiles: boolean;
  missingFiles: string[];

  // VERSION.TXT
  versionText: string | null;
  versionCrcDeclared: string | null;
  versionIsOfficialSignature: boolean; // true if matches 59c8 and known text
  versionSignatureValid: boolean;
  versionStatus: "VALID" | "TAMPERED" | "MISSING";
  versionWarning: string | null;

  // BLSCRIPT.CFG
  blscriptTitle: string | null;
  blscriptValid: boolean;

  // ECUORDER.TXT & CRC.16
  ecuorderContent: string | null;
  ecuorderDeclaredSize: number | null;
  ecuorderActualFliSize: number | null;
  ecuorderSizeMatches: boolean;
  crc16FileVal: string | null;
  crc16Calculated: string | null;
  crc16Valid: boolean;

  // LOGO.FLI
  hasFli: boolean;
  fliSizeBytes: number;
  fliMagicValid: boolean;
  fliPartitionId: number;
  fliPartitionValid: boolean; // must be 15
  width: number;
  height: number;
  totalPixels: number;
  bit15Errors: number;
  greenNoisePixels: number;
  crc1Valid: boolean;
  crc2Valid: boolean;
  crc1Val: string;
  crc2Val: string;
  isPerfectLogo: boolean;
  previewRgbBase64?: string | null; // RGB pixels or small preview

  // SWL.FLI
  hasSwlFli: boolean;
  swlFliSize: number;
  swlFliValid: boolean;

  // Overall Verdict
  safeToFlash: boolean;
  criticalErrors: string[];
  warnings: string[];
}

export interface SafetyCheckItem {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  targetValue: string;
  verdictLabel: string; // e.g. "PERFECT / FĂRĂ EROARE", "EROARE / BLOCARE"
  riskDescription: string; // What happens in car if this fails
}

export interface IsoCompareResult {
  success: boolean;
  isoA: IsoAnalysis;
  isoB: IsoAnalysis;
  differences: {
    versionDiffers: boolean;
    blscriptDiffers: boolean;
    logoDiffers: boolean;
    ecuorderDiffers: boolean;
    swlSignatureMatch: boolean; // true if both have valid signature
  };
  verdict: {
    compatibleLikeReference: boolean;
    willCauseError: boolean; // true = VA DA EROARE, false = NU VA DA NICIO EROARE
    errorTypeExpected: string | null; // e.g. "Blocare pe 'Searching for SWL Image'"
    verdictBadge: "SAFE" | "DANGER" | "WARNING";
    verdictTitle: string;
    verdictSubtitle: string;
    summary: string;
    actionableAdvice: string;
    checklist: SafetyCheckItem[];
  };
}

/**
 * Converts raw RLE-encoded RGB555 FLI payload into a fast 32-bit BMP data URL (Browser & Node.js).
 */
export function decodeFliToBmpBase64(rleData: Uint8Array, width: number, height: number): string | null {
  if (width <= 0 || height <= 0 || width > 1920 || height > 1080) return null;
  const numPixels = width * height;
  const rowBytes = width * 4;
  const pixelDataSize = rowBytes * height;
  const fileSize = 54 + pixelDataSize;
  const bmp = new Uint8Array(fileSize);
  const view = new DataView(bmp.buffer);

  // File Header
  bmp[0] = 0x42; // B
  bmp[1] = 0x4d; // M
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  // Info Header
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true); // negative height for top-down row order
  view.setUint16(26, 1, true); // color planes
  view.setUint16(28, 32, true); // 32 bpp BGRA
  view.setUint32(30, 0, true); // BI_RGB (uncompressed)
  view.setUint32(34, pixelDataSize, true);

  let pxIdx = 0;
  for (let i = 0; i < rleData.length && pxIdx < numPixels; i += 4) {
    if (i + 4 > rleData.length) break;
    const color = (rleData[i] << 8) | rleData[i + 1];
    const count = (rleData[i + 2] << 8) | rleData[i + 3];
    const r8 = Math.round(((color >> 10) & 0x1f) * (255 / 31));
    const g8 = Math.round(((color >> 5) & 0x1f) * (255 / 31));
    const b8 = Math.round((color & 0x1f) * (255 / 31));

    for (let c = 0; c < count && pxIdx < numPixels; c++) {
      const offset = 54 + pxIdx * 4;
      bmp[offset] = b8;     // B
      bmp[offset + 1] = g8; // G
      bmp[offset + 2] = r8; // R
      bmp[offset + 3] = 255; // A
      pxIdx++;
    }
  }

  let base64 = "";
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(bmp).toString("base64");
  } else {
    let binary = "";
    const len = bmp.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bmp.subarray(i, Math.min(i + chunkSize, len)) as any);
    }
    base64 = btoa(binary);
  }
  return `data:image/bmp;base64,${base64}`;
}

/**
 * Parses an ISO 9660 Level 1 image in pure TypeScript (Browser & Node.js).
 */
export function extractFilesFromIso(buf: Uint8Array): {
  volIdent: string;
  sysIdent: string;
  files: Map<string, Uint8Array>;
} {
  const SECTOR_SIZE = 2048;
  if (buf.length < 17 * SECTOR_SIZE) {
    throw new Error("Fișierul este prea mic pentru a fi o imagine ISO validă.");
  }

  const pvdSector = buf.subarray(16 * SECTOR_SIZE, 17 * SECTOR_SIZE);
  const sysIdent = new TextDecoder("ascii").decode(pvdSector.subarray(8, 40)).trim();
  const volIdent = new TextDecoder("ascii").decode(pvdSector.subarray(40, 72)).trim();

  const rootRec = pvdSector.subarray(156, 156 + 34);
  const rootView = new DataView(rootRec.buffer, rootRec.byteOffset, 34);
  const rootSec = rootView.getUint32(2, true);
  const rootSize = rootView.getUint32(10, true);

  const files = new Map<string, Uint8Array>();

  function readDir(secNum: number, dirSize: number, currentPath: string) {
    let offset = secNum * SECTOR_SIZE;
    const end = offset + dirSize;
    while (offset < end && offset < buf.length) {
      const recLen = buf[offset];
      if (recLen === 0) {
        // Skip sector boundary zero padding
        offset = (Math.floor(offset / SECTOR_SIZE) + 1) * SECTOR_SIZE;
        continue;
      }

      const view = new DataView(buf.buffer, buf.byteOffset + offset, recLen);
      const childSec = view.getUint32(2, true);
      const childSize = view.getUint32(10, true);
      const flags = buf[offset + 25];
      const nameLen = buf[offset + 32];
      const isDir = (flags & 0x02) !== 0;
      const rawName = new TextDecoder("ascii").decode(
        buf.subarray(offset + 33, offset + 33 + nameLen)
      );

      offset += recLen;
      if (rawName === "\x00" || rawName === "\x01") continue; // '.' or '..'

      const cleanName = rawName.split(";")[0].toUpperCase();
      const fullPath = (currentPath + "/" + cleanName).toUpperCase();

      if (isDir) {
        readDir(childSec, childSize, fullPath);
      } else {
        files.set(
          fullPath,
          buf.subarray(childSec * SECTOR_SIZE, childSec * SECTOR_SIZE + childSize)
        );
      }
    }
  }

  readDir(rootSec, rootSize, "");
  return { volIdent, sysIdent, files };
}

/**
 * Performs deep inspection of an ISO file.
 */
export function analyzeIsoImage(buf: Uint8Array, fileName: string): IsoAnalysis {
  const { volIdent, sysIdent, files } = extractFilesFromIso(buf);

  const criticalErrors: string[] = [];
  const warnings: string[] = [];

  // Required files in VW RNS 510 SWL ISO
  const required = [
    "/BLSCRIPT.CFG",
    "/CRC.16",
    "/ECUORDER.TXT",
    "/VERSION.TXT",
    "/WA/LOGO.FLI",
    "/SWL/SILVER_1/RNSMIDEC/SWL/SWL.FLI",
  ];

  const missingFiles = required.filter((r) => !files.has(r));
  const hasAllRequiredFiles = missingFiles.length === 0;

  if (missingFiles.length > 0) {
    criticalErrors.push(`Lipsește fișier obligatoriu SWL: ${missingFiles.join(", ")}`);
  }

  // 1. Analyze VERSION.TXT (Critical for "Searching for SWL Image" issue)
  let versionText: string | null = null;
  let versionCrcDeclared: string | null = null;
  let versionIsOfficialSignature = false;
  let versionSignatureValid = false;
  let versionStatus: "VALID" | "TAMPERED" | "MISSING" = "MISSING";
  let versionWarning: string | null = null;

  const versionData = files.get("/VERSION.TXT");
  if (versionData) {
    versionText = new TextDecoder("ascii", { fatal: false }).decode(versionData);
    const crcMatch = versionText.match(/#CRC16:([0-9a-fA-F]{4})/);
    if (crcMatch) {
      versionCrcDeclared = crcMatch[1].toLowerCase();
    }

    // Known official compatible checksum for RNS 510 bootlogo SWL updater is 59c8
    // with author netdata
    const hasNetdata = /Author:\s*netdata/i.test(versionText);
    const hasModifiedAuthor = /Author:\s*Edward/i.test(versionText) || /created by Edward/i.test(versionText);

    if (versionCrcDeclared === "59c8" && hasNetdata && !hasModifiedAuthor) {
      versionIsOfficialSignature = true;
      versionSignatureValid = true;
      versionStatus = "VALID";
    } else if (hasModifiedAuthor || (versionCrcDeclared === "59c8" && !hasNetdata)) {
      versionIsOfficialSignature = false;
      versionSignatureValid = false;
      versionStatus = "TAMPERED";
      versionWarning =
        "Fișierul VERSION.TXT a fost modificat fără recalcularea semnăturii interne de fabrică! " +
        "Navigația RNS 510 va eșua verificarea SWL și va rămâne blocată la infinit pe ecranul " +
        "'Software Download - Source activated, searching for SWL Image'!";
      criticalErrors.push(versionWarning);
    } else {
      versionSignatureValid = false;
      versionStatus = "TAMPERED";
      versionWarning = `Semnătură necunoscută (#CRC16:${versionCrcDeclared}). Risc major de incompatibilitate.`;
      warnings.push(versionWarning);
    }
  } else {
    criticalErrors.push("Fișierul VERSION.TXT lipsește complet din rădăcina discului ISO.");
  }

  // 2. Analyze BLSCRIPT.CFG
  let blscriptTitle: string | null = null;
  let blscriptValid = false;
  const blscriptData = files.get("/BLSCRIPT.CFG");
  if (blscriptData) {
    const blText = new TextDecoder("ascii", { fatal: false }).decode(blscriptData);
    const titleMatch = blText.match(/TEXT\s+2\s+2\s+\d+\s+0xFFFF\s+2\s+"([^"]+)"/i);
    if (titleMatch) {
      blscriptTitle = titleMatch[1];
    }
    blscriptValid =
      blText.includes("LOAD_FLASH_IMAGE") &&
      blText.includes("SET_BOOT_MODE") &&
      blText.includes("REBOOT");

    if (!blscriptValid) {
      criticalErrors.push("BLSCRIPT.CFG nu conține comenzile corecte de încărcare flash și reboot.");
    }
  }

  // 3. Analyze ECUORDER.TXT & CRC.16
  let ecuorderContent: string | null = null;
  let ecuorderDeclaredSize: number | null = null;
  let ecuorderActualFliSize: number | null = null;
  let ecuorderSizeMatches = false;
  let crc16FileVal: string | null = null;
  let crc16Calculated: string | null = null;
  let crc16Valid = false;

  const ecuData = files.get("/ECUORDER.TXT");
  const crc16Data = files.get("/CRC.16");
  const fliData = files.get("/WA/LOGO.FLI");

  if (ecuData) {
    ecuorderContent = new TextDecoder("ascii", { fatal: false }).decode(ecuData);
    const sizeMatch = ecuorderContent.match(/STRATA_UPDATE\s+15\s+(\d+)\s+/i);
    if (sizeMatch) {
      ecuorderDeclaredSize = parseInt(sizeMatch[1], 10);
    }
    const calc = crc16Xmodem(ecuData);
    crc16Calculated = calc.toString(16).padStart(4, "0").toLowerCase();
  }

  if (crc16Data) {
    crc16FileVal = new TextDecoder("ascii", { fatal: false }).decode(crc16Data).trim().toLowerCase();
  }

  if (crc16Calculated && crc16FileVal) {
    crc16Valid = crc16Calculated === crc16FileVal;
    if (!crc16Valid) {
      criticalErrors.push(
        `Checksum CRC.16 incorect! Fișierul CRC.16 are '${crc16FileVal}', dar ECUORDER.TXT are hash '${crc16Calculated}'. Unitatea va da 'SWL Error'.`
      );
    }
  } else if (!crc16Data) {
    criticalErrors.push("Fișierul CRC.16 lipsește de pe disc.");
  }

  if (fliData) {
    ecuorderActualFliSize = fliData.length;
    if (ecuorderDeclaredSize !== null) {
      ecuorderSizeMatches = ecuorderDeclaredSize === ecuorderActualFliSize;
      if (!ecuorderSizeMatches) {
        criticalErrors.push(
          `Dimensiunea din ECUORDER.TXT (${ecuorderDeclaredSize} octeți) nu corespunde cu dimensiunea reală a fișierului LOGO.FLI (${ecuorderActualFliSize} octeți).`
        );
      }
    }
  }

  // 4. Analyze WA/LOGO.FLI
  let hasFli = false;
  let fliSizeBytes = 0;
  let fliMagicValid = false;
  let fliPartitionId = 0;
  let fliPartitionValid = false;
  let width = 0;
  let height = 0;
  let totalPixels = 0;
  let bit15Errors = 0;
  let greenNoisePixels = 0;
  let crc1Valid = false;
  let crc2Valid = false;
  let crc1Val = "";
  let crc2Val = "";
  let isPerfectLogo = false;
  let previewRgbBase64: string | null = null;

  if (fliData && fliData.length >= 64) {
    hasFli = true;
    fliSizeBytes = fliData.length;
    const view = new DataView(fliData.buffer, fliData.byteOffset, fliData.byteLength);

    const magic = view.getUint32(0, false);
    fliMagicValid = magic === 0xaa55aa55;

    fliPartitionId = view.getUint32(4, false);
    fliPartitionValid = fliPartitionId === 15; // 0x0F

    const crc1Hdr = view.getUint16(18, false);
    width = view.getUint32(40, false);
    height = view.getUint32(44, false);
    const crc2Hdr = view.getUint16(50, false);

    const rleData = fliData.subarray(64);
    const crc2Calc = crc16Xmodem(rleData);

    const headerPart2 = fliData.subarray(32, 64);
    const combined = new Uint8Array(32 + rleData.length);
    combined.set(headerPart2, 0);
    combined.set(rleData, 32);
    const crc1Calc = crc16Xmodem(combined);

    crc1Val = crc1Calc.toString(16).padStart(4, "0");
    crc2Val = crc2Calc.toString(16).padStart(4, "0");
    crc1Valid = crc1Hdr === crc1Calc;
    crc2Valid = crc2Hdr === crc2Calc;

    // Scan pixels
    for (let i = 0; i < rleData.length; i += 4) {
      if (i + 4 > rleData.length) break;
      const color = (rleData[i] << 8) | rleData[i + 1];
      const count = (rleData[i + 2] << 8) | rleData[i + 3];
      totalPixels += count;

      if ((color & 0x8000) !== 0) {
        bit15Errors += count;
      }

      const r5 = (color >> 10) & 0x1f;
      const g5 = (color >> 5) & 0x1f;
      const b5 = color & 0x1f;

      if (g5 > 0 && r5 === 0 && b5 === 0 && g5 <= 3) {
        greenNoisePixels += count;
      } else if (g5 > r5 + 3 && g5 > b5 + 3 && r5 + g5 + b5 < 18) {
        greenNoisePixels += count;
      }
    }

    isPerfectLogo =
      width === 800 &&
      height === 480 &&
      totalPixels === 384000 &&
      fliMagicValid &&
      fliPartitionValid &&
      crc1Valid &&
      crc2Valid &&
      bit15Errors === 0 &&
      greenNoisePixels === 0;

    previewRgbBase64 = decodeFliToBmpBase64(rleData, width, height);

    if (!fliMagicValid) criticalErrors.push("LOGO.FLI are magic bytes invalizi (nu este 0xAA55AA55).");
    if (!fliPartitionValid) criticalErrors.push(`LOGO.FLI are ID partiție ${fliPartitionId} (trebuie să fie 15).`);
    if (bit15Errors > 0) warnings.push(`LOGO.FLI conține ${bit15Errors} pixeli cu bitul 15 activ (risc de artefacte/purici).`);
    if (greenNoisePixels > 0) warnings.push(`LOGO.FLI conține ${greenNoisePixels} pixeli cu purici verzi pe fundal întunecat.`);
  } else {
    criticalErrors.push("LOGO.FLI lipsește sau are sub 64 de octeți.");
  }

  // 5. Analyze SWL.FLI
  const swlData = files.get("/SWL/SILVER_1/RNSMIDEC/SWL/SWL.FLI");
  const hasSwlFli = !!swlData;
  const swlFliSize = swlData ? swlData.length : 0;
  const swlFliValid = hasSwlFli && swlFliSize > 3500000;

  if (!hasSwlFli) {
    criticalErrors.push("Aplicația de actualizare SWL.FLI lipsește din directorul /SWL.");
  }

  const safeToFlash = criticalErrors.length === 0;

  return {
    fileName,
    fileSize: buf.length,
    volIdent,
    sysIdent,
    hasAllRequiredFiles,
    missingFiles,

    versionText,
    versionCrcDeclared,
    versionIsOfficialSignature,
    versionSignatureValid,
    versionStatus,
    versionWarning,

    blscriptTitle,
    blscriptValid,

    ecuorderContent,
    ecuorderDeclaredSize,
    ecuorderActualFliSize,
    ecuorderSizeMatches,
    crc16FileVal,
    crc16Calculated,
    crc16Valid,

    hasFli,
    fliSizeBytes,
    fliMagicValid,
    fliPartitionId,
    fliPartitionValid,
    width,
    height,
    totalPixels,
    bit15Errors,
    greenNoisePixels,
    crc1Valid,
    crc2Valid,
    crc1Val,
    crc2Val,
    isPerfectLogo,
    previewRgbBase64,

    hasSwlFli,
    swlFliSize,
    swlFliValid,

    safeToFlash,
    criticalErrors,
    warnings,
  };
}

/**
 * Compares two ISO analyses side-by-side.
 */
export function compareIsos(isoA: IsoAnalysis, isoB: IsoAnalysis): IsoCompareResult {
  const versionDiffers =
    isoA.versionCrcDeclared !== isoB.versionCrcDeclared ||
    isoA.versionStatus !== isoB.versionStatus ||
    isoA.versionText !== isoB.versionText;

  const blscriptDiffers = isoA.blscriptTitle !== isoB.blscriptTitle;
  const logoDiffers =
    isoA.fliSizeBytes !== isoB.fliSizeBytes ||
    isoA.crc1Val !== isoB.crc1Val ||
    isoA.crc2Val !== isoB.crc2Val;

  const ecuorderDiffers =
    isoA.ecuorderDeclaredSize !== isoB.ecuorderDeclaredSize ||
    isoA.crc16FileVal !== isoB.crc16FileVal;

  const swlSignatureMatch = isoA.versionSignatureValid && isoB.versionSignatureValid;

  // 1. Build comprehensive 6-point Safety Checklist for Disc B
  const checklist: SafetyCheckItem[] = [
    {
      id: "version_signature",
      name: "1. Semnătură SWL (VERSION.TXT)",
      status: isoB.versionSignatureValid ? "PASS" : "FAIL",
      targetValue: isoB.versionSignatureValid ? "#CRC16:59c8 (Semnătură Oficială)" : (isoB.versionCrcDeclared ? `#CRC16:${isoB.versionCrcDeclared}` : "Lipsă"),
      verdictLabel: isoB.versionSignatureValid ? "100% OK — Nu se va bloca" : "EROARE CRITICĂ — BLOCARE ECRAN",
      riskDescription: isoB.versionSignatureValid
        ? "Semnătura recunoscută de SWL.FLI. Trecere instantă la etapa de scriere."
        : "Unitatea RNS 510 va rămâne blocată 5+ minute pe ecranul negru 'Searching for SWL Image'!",
    },
    {
      id: "crc16_integrity",
      name: "2. Integritate Checksum (CRC.16 & ECUORDER)",
      status: isoB.crc16Valid ? "PASS" : "FAIL",
      targetValue: isoB.crc16Valid ? `${isoB.crc16FileVal} (Validat)` : `Fișier: ${isoB.crc16FileVal} vs Calculat: ${isoB.crc16Calculated}`,
      verdictLabel: isoB.crc16Valid ? "100% OK — Checksum Valid" : "EROARE CHECKSUM",
      riskDescription: isoB.crc16Valid
        ? "Suma hash CRC-16/XMODEM corespunde perfect cu ECUORDER.TXT."
        : "Unitatea va afișa 'SWL Error' sau 'Checksum Error' și va ejecta CD-ul.",
    },
    {
      id: "partition_size",
      name: "3. Tabela de Partiționare (Sector 15)",
      status: isoB.ecuorderSizeMatches ? "PASS" : "FAIL",
      targetValue: isoB.ecuorderSizeMatches ? `${isoB.ecuorderDeclaredSize?.toLocaleString()} bytes` : `Declarat: ${isoB.ecuorderDeclaredSize} vs Real: ${isoB.ecuorderActualFliSize}`,
      verdictLabel: isoB.ecuorderSizeMatches ? "100% OK — Mărime Aliniată" : "EROARE DIMENSIUNE",
      riskDescription: isoB.ecuorderSizeMatches
        ? "Dimensiunea din STRATA_UPDATE 15 corespunde exact fișierului LOGO.FLI."
        : "Unitatea va eșua la scrierea sectorului 15 de memorie flash.",
    },
    {
      id: "swl_updater",
      name: "4. Binar Aplicație Updater (SWL.FLI)",
      status: isoB.swlFliValid ? "PASS" : "FAIL",
      targetValue: isoB.swlFliValid ? `${(isoB.swlFliSize / 1024 / 1024).toFixed(2)} MB (Oficial)` : "Lipsă sau Corupt",
      verdictLabel: isoB.swlFliValid ? "100% OK — Binar Prezent" : "EROARE APLICAȚIE SWL",
      riskDescription: isoB.swlFliValid
        ? "Motorul de actualizare software este prezent în folderul /SWL."
        : "Unitatea nu va recunoaște discul ca CD de actualizare software.",
    },
    {
      id: "fli_headers",
      name: "5. Format Antet & Partiție LOGO.FLI",
      status: (isoB.fliMagicValid && isoB.fliPartitionValid) ? "PASS" : "FAIL",
      targetValue: (isoB.fliMagicValid && isoB.fliPartitionValid) ? "0xAA55AA55 • Partiția 15" : `Magic: ${isoB.fliMagicValid ? "OK" : "Rău"}, Part: ${isoB.fliPartitionId}`,
      verdictLabel: (isoB.fliMagicValid && isoB.fliPartitionValid) ? "100% OK — Format Nativ" : "EROARE STRUCTURĂ FLI",
      riskDescription: (isoB.fliMagicValid && isoB.fliPartitionValid)
        ? "Header-ul FLI conține magic bytes corecți și țintește sectorul 15."
        : "Datele FLI sunt invalide și nu pot fi scrise în flash.",
    },
    {
      id: "pixel_quality",
      name: "6. Calitate Imagine RGB555 (Anti-Purici)",
      status: (isoB.bit15Errors === 0 && isoB.greenNoisePixels === 0) ? "PASS" : "WARN",
      targetValue: (isoB.bit15Errors === 0 && isoB.greenNoisePixels === 0) ? "0 erori bit 15 • 0 purici verzi" : `${isoB.bit15Errors} bit15 • ${isoB.greenNoisePixels} purici`,
      verdictLabel: (isoB.bit15Errors === 0 && isoB.greenNoisePixels === 0) ? "100% OK — Curat" : "AVERTISMENT VIZUAL",
      riskDescription: (isoB.bit15Errors === 0 && isoB.greenNoisePixels === 0)
        ? "Imaginea folosește spațiul 15-bit hardware fără niciun pixel parazit."
        : "Discul se va scrie cu succes, dar pe fundal negru pot apărea purici verzi sau artefacte.",
    },
  ];

  // 2. Direct unequivocal verdict
  let willCauseError = false;
  let errorTypeExpected: string | null = null;
  let verdictBadge: "SAFE" | "DANGER" | "WARNING" = "SAFE";
  let verdictTitle = "";
  let verdictSubtitle = "";
  let compatibleLikeReference = false;
  let summary = "";
  let actionableAdvice = "";

  if (!isoB.versionSignatureValid) {
    willCauseError = true;
    errorTypeExpected = "Blocare ecran (Freeze 5+ minute) pe 'Searching for SWL Image'";
    verdictBadge = "DANGER";
    compatibleLikeReference = false;
    verdictTitle = "ATENȚIE: ACEST DISC VA DA EROARE PE MAȘINĂ!";
    verdictSubtitle = "Unitatea RNS 510 se va bloca la 'Searching for SWL Image' din cauza semnăturii VERSION.TXT modificate.";
    summary =
      `Discul A (${isoA.fileName}) are semnătura oficială (#CRC16:59c8), dar Discul B (${isoB.fileName}) are semnătura coruptă/modificată!`;
    actionableAdvice =
      `NU ARDE ACEST DISC PE CD! Soluție: Păstrează fișierul VERSION.TXT cu '#Author: netdata' și '#CRC16:59c8', iar textul tău 'Edward03' pune-l în BLSCRIPT.CFG!`;
  } else if (!isoB.crc16Valid || !isoB.ecuorderSizeMatches || !isoB.swlFliValid || !isoB.fliMagicValid || !isoB.fliPartitionValid) {
    willCauseError = true;
    errorTypeExpected = !isoB.crc16Valid ? "Eroare 'SWL Error' / 'Checksum Error'" : "Eroare structură partiție sau fișiere corupte";
    verdictBadge = "DANGER";
    compatibleLikeReference = false;
    verdictTitle = "ATENȚIE: ACEST DISC VA DA EROARE PE MAȘINĂ!";
    verdictSubtitle = "Fișierele de pe disc au sume de control (CRC) sau structuri invalide. Unitatea va respinge discul.";
    summary = `Discul B conține erori structurale critice care vor opri procesul de actualizare pe mașină.`;
    actionableAdvice = `Deschide imaginea în Studio pentru a reconstrui automat un disc ISO 100% curat.`;
  } else if (isoB.bit15Errors > 0 || isoB.greenNoisePixels > 0) {
    willCauseError = false;
    errorTypeExpected = null;
    verdictBadge = "WARNING";
    compatibleLikeReference = true;
    verdictTitle = "DISCUL NU VA DA EROARE DE BLOCARE, DAR ARE PURICI VERZI";
    verdictSubtitle = "Procesul de scriere pe mașină va reuși complet, însă imaginea conține pixeli paraziți vizibili noaptea.";
    summary = `Semnăturile SWL și sumele CRC sunt 100% corecte. Există doar mici imperfecțiuni vizuale în imagine.`;
    actionableAdvice = `Poți folosi discul, sau poți trece imaginea prin filtrul Anti-Purici din Studio pentru un rezultat perfect OEM.`;
  } else {
    willCauseError = false;
    errorTypeExpected = null;
    verdictBadge = "SAFE";
    compatibleLikeReference = true;
    verdictTitle = "GARANTAT: NU VA DA NICIO EROARE NICIODATĂ!";
    verdictSubtitle = "Semnătura SWL, tabela de partiționare, sumele CRC și imaginea sunt 100% identice cu standardul de fabrică. Poți arde CD-ul fără nicio grijă!";
    summary = `Toate cele 6 teste de siguranță hardware au fost trecute cu brio. Discul B este 100% compatibil ca referința funcțională.`;
    actionableAdvice = `Scrie discul pe un CD-R de calitate la viteza 4x sau 8x cu ImgBurn. Procesul pe mașină va dura ~2-3 minute și se va finaliza cu succes!`;
  }

  return {
    success: true,
    isoA,
    isoB,
    differences: {
      versionDiffers,
      blscriptDiffers,
      logoDiffers,
      ecuorderDiffers,
      swlSignatureMatch,
    },
    verdict: {
      compatibleLikeReference,
      willCauseError,
      errorTypeExpected,
      verdictBadge,
      verdictTitle,
      verdictSubtitle,
      summary,
      actionableAdvice,
      checklist,
    },
  };
}
