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

export type NavTab = "studio" | "presets" | "inspector" | "compare" | "mapverify" | "guide";

export interface ReconResult {
  rootName: string;
  totalFiles: number;
  totalBytes: number;
  maxDepth: number;
  extHistogram: Record<string, { count: number; totalBytes: number }>;
  largestFiles: Array<{ path: string; size: number }>;
  zeroByteFiles: string[];
  manifestCandidates: Array<{ path: string; size: number; preview?: string }>;
  flags: {
    fat32Limit: boolean;
    fat32Violations: Array<{ path: string; size: number }>;
    longPaths: boolean;
    longPathViolations: Array<{ path: string; length: number }>;
    caseCollisions: boolean;
    caseCollisionGroups: Array<{ normalized: string; paths: string[] }>;
    nonAscii: boolean;
    nonAsciiPaths: string[];
    nonIsoChars: boolean;
  };
  fingerprint: string;
}

export interface ManifestData {
  tool: string;
  version: string;
  created: string;
  algo: string;
  root_name: string;
  total_files: number;
  total_bytes: number;
  files: Record<string, { size: number; hash: string }>;
}

export interface VerifyDiffResult {
  ok: string[];
  missing: string[];
  extra: string[];
  sizeMismatch: Array<{ path: string; manifestSize: number; actualSize: number }>;
  hashMismatch: Array<{ path: string; manifestHash: string; actualHash: string }>;
  unreadable: Array<{ path: string; error: string }>;
  summary: {
    totalFiles: number;
    matchCount: number;
    problemCount: number;
    verdict: "PASS" | "FAIL" | "WARN";
  };
}

export interface IsoScanResult {
  fileName: string;
  fileSize: number;
  declaredVolumeSize: number;
  isTruncated: boolean;
  volumeLabel: string;
  systemId: string;
  totalFiles: number;
  totalDirs: number;
  truncatedBytesMissing?: number;
  filesList: Array<{ path: string; size: number; extent: number }>;
}

export interface ZipMemberInfo {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  crc32: string;
}

export interface ZipScanResult {
  fileName: string;
  fileSize: number;
  totalMembers: number;
  totalUncompressedSize: number;
  members: ZipMemberInfo[];
  isValidZip: boolean;
}
