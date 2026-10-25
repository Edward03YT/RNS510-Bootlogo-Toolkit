export type FitMode = "pad" | "crop" | "stretch";

export type Language = "ro" | "en";

export type DisplayMode = "cockpit" | "frameless" | "split";

export interface Diagnostics {
  width: number;
  height: number;
  totalPixels: number;
  expectedPixels: number;
  bit15Errors: number;
  greenNoisePixels: number;
  isPerfect: boolean;
  crc1Valid?: boolean;
  crc2Valid?: boolean;
  crc1Val?: string;
  crc2Val?: string;
  sourceType?: string;
  magicValid?: boolean;
  ecuInfo?: {
    crc_file?: string;
    crc_calc?: string;
    crc_valid?: boolean;
  };
}

export interface GenerationResult {
  success: boolean;
  isoFile?: string;
  fliFile?: string;
  previewFile?: string;
  fliSizeBytes?: number;
  crc16?: string;
  isPerfect?: boolean;
  bit15Errors?: number;
  greenNoisePixels?: number;
  totalPixels?: number;
  error?: string;
}

export interface VerificationResult {
  success: boolean;
  sourceType?: string;
  width?: number;
  height?: number;
  totalPixels?: number;
  expectedPixels?: number;
  magicValid?: boolean;
  crc1Valid?: boolean;
  crc2Valid?: boolean;
  crc1Val?: string;
  crc2Val?: string;
  bit15Errors?: number;
  greenNoisePixels?: number;
  isPerfect?: boolean;
  ecuInfo?: {
    crc_file?: string;
    crc_calc?: string;
    crc_valid?: boolean;
  };
  previewFile?: string;
  previewUrl?: string | null;
  error?: string;
}

export interface PresetLogo {
  id: string;
  name: string;
  subtitle: string;
  brand: "vw" | "gti" | "rline" | "skoda" | "seat" | "custom";
  svgData: string;
}

export type { IsoAnalysis, IsoCompareResult } from "@/lib/isoParser";
