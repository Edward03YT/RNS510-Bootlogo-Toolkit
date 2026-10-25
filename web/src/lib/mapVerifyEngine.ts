/**
 * Client-Side Map Source Verifier Engine
 * Implements high-speed client-side folder reconnaissance, streaming cryptographic hashing,
 * manifest generation/verification, ISO PVD inspection, and zip Central Directory analysis.
 */

import {
  ReconResult,
  ManifestData,
  VerifyDiffResult,
  IsoScanResult,
  ZipScanResult,
  ZipMemberInfo,
} from "@/types";

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function maskPath(p: string): string {
  if (!p) return "";
  let clean = p.replace(/\\/g, "/");
  clean = clean.replace(/^[A-Za-z]:\/(?:Users|Home)\/[^\/]+/i, ".../<user>");
  clean = clean.replace(/^\/(?:Users|home)\/[^\/]+/i, ".../<user>");
  return clean;
}

// ----------------------------------------------------------------------------
// Lightweight Streaming SHA-256 Implementation for Chunked Browser Hashing
// ----------------------------------------------------------------------------

class Sha256Incremental {
  private h0 = 0x6a09e667;
  private h1 = 0xbb67ae85;
  private h2 = 0x3c6ef372;
  private h3 = 0xa54ff53a;
  private h4 = 0x510e527f;
  private h5 = 0x9b05688c;
  private h6 = 0x1f83d9ab;
  private h7 = 0x5be0cd19;

  private buffer = new Uint8Array(64);
  private bufferLength = 0;
  private totalBytesHashed = 0;

  private static K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  private static rotr(n: number, x: number): number {
    return (x >>> n) | (x << (32 - n));
  }

  private processBlock(block: Uint8Array): void {
    const W = new Uint32Array(64);
    for (let t = 0; t < 16; t++) {
      W[t] =
        (block[t * 4] << 24) |
        (block[t * 4 + 1] << 16) |
        (block[t * 4 + 2] << 8) |
        block[t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 =
        Sha256Incremental.rotr(7, W[t - 15]) ^
        Sha256Incremental.rotr(18, W[t - 15]) ^
        (W[t - 15] >>> 3);
      const s1 =
        Sha256Incremental.rotr(17, W[t - 2]) ^
        Sha256Incremental.rotr(19, W[t - 2]) ^
        (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = this.h0;
    let b = this.h1;
    let c = this.h2;
    let d = this.h3;
    let e = this.h4;
    let f = this.h5;
    let g = this.h6;
    let h = this.h7;

    for (let t = 0; t < 64; t++) {
      const S1 =
        Sha256Incremental.rotr(6, e) ^
        Sha256Incremental.rotr(11, e) ^
        Sha256Incremental.rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + Sha256Incremental.K[t] + W[t]) | 0;
      const S0 =
        Sha256Incremental.rotr(2, a) ^
        Sha256Incremental.rotr(13, a) ^
        Sha256Incremental.rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.h0 = (this.h0 + a) | 0;
    this.h1 = (this.h1 + b) | 0;
    this.h2 = (this.h2 + c) | 0;
    this.h3 = (this.h3 + d) | 0;
    this.h4 = (this.h4 + e) | 0;
    this.h5 = (this.h5 + f) | 0;
    this.h6 = (this.h6 + g) | 0;
    this.h7 = (this.h7 + h) | 0;
  }

  public update(chunk: Uint8Array): void {
    let offset = 0;
    const len = chunk.length;
    this.totalBytesHashed += len;

    if (this.bufferLength > 0) {
      const needed = 64 - this.bufferLength;
      if (len >= needed) {
        this.buffer.set(chunk.subarray(0, needed), this.bufferLength);
        this.processBlock(this.buffer);
        this.bufferLength = 0;
        offset = needed;
      } else {
        this.buffer.set(chunk, this.bufferLength);
        this.bufferLength += len;
        return;
      }
    }

    while (offset + 64 <= len) {
      this.processBlock(chunk.subarray(offset, offset + 64));
      offset += 64;
    }

    if (offset < len) {
      this.buffer.set(chunk.subarray(offset), 0);
      this.bufferLength = len - offset;
    }
  }

  public digestHex(): string {
    const bitLength = this.totalBytesHashed * 8;
    this.buffer[this.bufferLength++] = 0x80;

    if (this.bufferLength > 56) {
      for (let i = this.bufferLength; i < 64; i++) {
        this.buffer[i] = 0;
      }
      this.processBlock(this.buffer);
      this.bufferLength = 0;
    }

    for (let i = this.bufferLength; i < 56; i++) {
      this.buffer[i] = 0;
    }

    const highBits = Math.floor(bitLength / 0x100000000);
    const lowBits = bitLength >>> 0;

    this.buffer[56] = (highBits >>> 24) & 0xff;
    this.buffer[57] = (highBits >>> 16) & 0xff;
    this.buffer[58] = (highBits >>> 8) & 0xff;
    this.buffer[59] = highBits & 0xff;
    this.buffer[60] = (lowBits >>> 24) & 0xff;
    this.buffer[61] = (lowBits >>> 16) & 0xff;
    this.buffer[62] = (lowBits >>> 8) & 0xff;
    this.buffer[63] = lowBits & 0xff;

    this.processBlock(this.buffer);

    const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
    return (
      toHex(this.h0) +
      toHex(this.h1) +
      toHex(this.h2) +
      toHex(this.h3) +
      toHex(this.h4) +
      toHex(this.h5) +
      toHex(this.h6) +
      toHex(this.h7)
    );
  }
}

/**
 * Stream a file in 2 MiB chunks and calculate SHA-256 without memory limits.
 */
export async function streamHashSha256(
  file: File,
  onProgress?: (doneBytes: number, totalBytes: number) => void,
  cancelRef?: { cancelled: boolean }
): Promise<string> {
  const CHUNK_SIZE = 2 * 1024 * 1024;
  const hasher = new Sha256Incremental();
  let offset = 0;
  const total = file.size;

  while (offset < total) {
    if (cancelRef?.cancelled) {
      throw new Error("Operation cancelled by user");
    }

    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, total));
    const arrayBuffer = await slice.arrayBuffer();
    hasher.update(new Uint8Array(arrayBuffer));
    offset += arrayBuffer.byteLength;

    if (onProgress) {
      onProgress(offset, total);
    }

    // Let the event loop breathe for UI responsiveness
    if (offset < total) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return hasher.digestHex();
}

/**
 * Extract relative path from a File object.
 */
export function getRelativeFilePath(file: File): string {
  const rel = file.webkitRelativePath || (file as any).path || file.name;
  const parts = rel.replace(/\\/g, "/").split("/");
  if (parts.length > 1) {
    return parts.slice(1).join("/");
  }
  return parts[0];
}

/**
 * Perform structure reconnaissance on a list of files.
 */
export async function analyzeFolderStructure(files: File[]): Promise<ReconResult> {
  let rootName = "Map_Source";
  if (files.length > 0 && files[0].webkitRelativePath) {
    rootName = files[0].webkitRelativePath.split("/")[0] || rootName;
  }

  let totalBytes = 0;
  let maxDepth = 1;
  const extHistogram: Record<string, { count: number; totalBytes: number }> = {};
  const largestFiles: Array<{ path: string; size: number }> = [];
  const zeroByteFiles: string[] = [];
  const manifestCandidates: Array<{ path: string; size: number; preview?: string }> = [];

  const fat32Violations: Array<{ path: string; size: number }> = [];
  const longPathViolations: Array<{ path: string; length: number }> = [];
  const caseMap = new Map<string, string[]>();
  const nonAsciiPaths: string[] = [];
  let nonIsoChars = false;

  const isoValidRegex = /^[A-Z0-9_.\-\/]+$/;
  const FAT32_LIMIT = 4294967296; // 4 GiB

  for (const f of files) {
    const rel = getRelativeFilePath(f);
    const size = f.size;
    totalBytes += size;

    const depth = rel.split("/").length;
    if (depth > maxDepth) maxDepth = depth;

    // Extension histogram
    const dotIdx = rel.lastIndexOf(".");
    const ext = dotIdx !== -1 ? rel.slice(dotIdx).toLowerCase() : "[no_ext]";
    if (!extHistogram[ext]) {
      extHistogram[ext] = { count: 0, totalBytes: 0 };
    }
    extHistogram[ext].count += 1;
    extHistogram[ext].totalBytes += size;

    // Largest files
    largestFiles.push({ path: rel, size });

    // Zero-byte files
    if (size === 0) {
      zeroByteFiles.push(rel);
    }

    // Manifest candidates
    const baseName = rel.split("/").pop()?.toLowerCase() || "";
    if (
      baseName.includes("manifest") ||
      baseName.includes("checksum") ||
      baseName.includes("md5") ||
      baseName.includes("sha") ||
      baseName.endsWith(".sfv") ||
      baseName.endsWith(".nfo")
    ) {
      manifestCandidates.push({ path: rel, size });
    }

    // Flags
    if (size >= FAT32_LIMIT) {
      fat32Violations.push({ path: rel, size });
    }
    if (rel.length > 240) {
      longPathViolations.push({ path: rel, length: rel.length });
    }

    const lowerRel = rel.toLowerCase();
    if (!caseMap.has(lowerRel)) {
      caseMap.set(lowerRel, []);
    }
    caseMap.get(lowerRel)!.push(rel);

    // ASCII check
    if (/[^\x00-\x7F]/.test(rel)) {
      nonAsciiPaths.push(rel);
    }

    // ISO9660 check
    if (!isoValidRegex.test(rel.toUpperCase())) {
      nonIsoChars = true;
    }
  }

  // Sort largest files descending
  largestFiles.sort((a, b) => b.size - a.size);
  const topLargest = largestFiles.slice(0, 20);

  // Case collisions
  const caseCollisionGroups: Array<{ normalized: string; paths: string[] }> = [];
  for (const [norm, group] of caseMap.entries()) {
    if (group.length > 1) {
      caseCollisionGroups.push({ normalized: norm, paths: group });
    }
  }

  // Compute stable structural fingerprint
  const fingerprintItems = files
    .map((f) => `${getRelativeFilePath(f)}:${f.size}`)
    .sort()
    .join("\n");
  const fpHasher = new Sha256Incremental();
  fpHasher.update(new TextEncoder().encode(fingerprintItems));
  const fingerprint = fpHasher.digestHex();

  return {
    rootName,
    totalFiles: files.length,
    totalBytes,
    maxDepth,
    extHistogram,
    largestFiles: topLargest,
    zeroByteFiles,
    manifestCandidates,
    flags: {
      fat32Limit: fat32Violations.length > 0,
      fat32Violations,
      longPaths: longPathViolations.length > 0,
      longPathViolations,
      caseCollisions: caseCollisionGroups.length > 0,
      caseCollisionGroups,
      nonAscii: nonAsciiPaths.length > 0,
      nonAsciiPaths,
      nonIsoChars,
    },
    fingerprint,
  };
}

/**
 * Generate a standard JSON manifest from an array of File objects.
 */
export async function generateManifest(
  files: File[],
  algo: "sha256" = "sha256",
  onProgress?: (done: number, total: number, curFile: string) => void,
  cancelRef?: { cancelled: boolean }
): Promise<ManifestData> {
  let rootName = "Map_Source";
  if (files.length > 0 && files[0].webkitRelativePath) {
    rootName = files[0].webkitRelativePath.split("/")[0] || rootName;
  }

  const manifestFiles: Record<string, { size: number; hash: string }> = {};
  let totalBytes = 0;

  for (let i = 0; i < files.length; i++) {
    if (cancelRef?.cancelled) {
      throw new Error("Manifest generation cancelled");
    }

    const f = files[i];
    const rel = getRelativeFilePath(f);
    totalBytes += f.size;

    if (onProgress) {
      onProgress(i, files.length, rel);
    }

    const hash = await streamHashSha256(f, undefined, cancelRef);
    manifestFiles[rel] = { size: f.size, hash };
  }

  if (onProgress) {
    onProgress(files.length, files.length, "Completed");
  }

  return {
    tool: "mapverify",
    version: "0.1.0",
    created: new Date().toISOString(),
    algo,
    root_name: rootName,
    total_files: files.length,
    total_bytes: totalBytes,
    files: manifestFiles,
  };
}

/**
 * Verify a folder against a reference manifest.
 */
export async function verifyFolderAgainstManifest(
  files: File[],
  manifest: ManifestData,
  quick: boolean = false,
  onProgress?: (done: number, total: number, curFile: string) => void,
  cancelRef?: { cancelled: boolean }
): Promise<VerifyDiffResult> {
  const localMap = new Map<string, File>();
  for (const f of files) {
    localMap.set(getRelativeFilePath(f), f);
  }

  const ok: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  const sizeMismatch: Array<{ path: string; manifestSize: number; actualSize: number }> = [];
  const hashMismatch: Array<{ path: string; manifestHash: string; actualHash: string }> = [];
  const unreadable: Array<{ path: string; error: string }> = [];

  const manifestKeys = Object.keys(manifest.files || {});
  let processed = 0;

  for (const rel of manifestKeys) {
    if (cancelRef?.cancelled) throw new Error("Verification cancelled");
    processed++;
    if (onProgress) onProgress(processed, manifestKeys.length, rel);

    const expected = manifest.files[rel];
    const localFile = localMap.get(rel);

    if (!localFile) {
      missing.push(rel);
      continue;
    }

    if (localFile.size !== expected.size) {
      sizeMismatch.push({
        path: rel,
        manifestSize: expected.size,
        actualSize: localFile.size,
      });
      continue;
    }

    if (quick) {
      ok.push(rel);
    } else {
      try {
        const actualHash = await streamHashSha256(localFile, undefined, cancelRef);
        if (actualHash.toLowerCase() !== expected.hash.toLowerCase()) {
          hashMismatch.push({
            path: rel,
            manifestHash: expected.hash,
            actualHash,
          });
        } else {
          ok.push(rel);
        }
      } catch (err: any) {
        unreadable.push({ path: rel, error: err.message || "Failed to hash" });
      }
    }
  }

  // Check for extra files
  for (const rel of localMap.keys()) {
    if (!manifest.files[rel]) {
      extra.push(rel);
    }
  }

  const problemCount = missing.length + sizeMismatch.length + hashMismatch.length + unreadable.length;
  let verdict: "PASS" | "FAIL" | "WARN" = "PASS";
  if (problemCount > 0) {
    verdict = "FAIL";
  } else if (extra.length > 0) {
    verdict = "WARN";
  }

  return {
    ok,
    missing,
    extra,
    sizeMismatch,
    hashMismatch,
    unreadable,
    summary: {
      totalFiles: manifestKeys.length,
      matchCount: ok.length,
      problemCount,
      verdict,
    },
  };
}

/**
 * Compare two folder trees directly.
 */
export async function compareFolderTrees(
  filesA: File[],
  filesB: File[],
  quick: boolean = false,
  onProgress?: (done: number, total: number, curFile: string) => void,
  cancelRef?: { cancelled: boolean }
): Promise<VerifyDiffResult> {
  const mapA = new Map<string, File>();
  for (const f of filesA) mapA.set(getRelativeFilePath(f), f);

  const mapB = new Map<string, File>();
  for (const f of filesB) mapB.set(getRelativeFilePath(f), f);

  const ok: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  const sizeMismatch: Array<{ path: string; manifestSize: number; actualSize: number }> = [];
  const hashMismatch: Array<{ path: string; manifestHash: string; actualHash: string }> = [];
  const unreadable: Array<{ path: string; error: string }> = [];

  const allKeysA = Array.from(mapA.keys());
  let count = 0;

  for (const rel of allKeysA) {
    if (cancelRef?.cancelled) throw new Error("Comparison cancelled");
    count++;
    if (onProgress) onProgress(count, allKeysA.length, rel);

    const fileA = mapA.get(rel)!;
    const fileB = mapB.get(rel);

    if (!fileB) {
      missing.push(rel);
      continue;
    }

    if (fileA.size !== fileB.size) {
      sizeMismatch.push({
        path: rel,
        manifestSize: fileA.size,
        actualSize: fileB.size,
      });
      continue;
    }

    if (quick) {
      ok.push(rel);
    } else {
      try {
        const hashA = await streamHashSha256(fileA, undefined, cancelRef);
        const hashB = await streamHashSha256(fileB, undefined, cancelRef);
        if (hashA !== hashB) {
          hashMismatch.push({
            path: rel,
            manifestHash: hashA,
            actualHash: hashB,
          });
        } else {
          ok.push(rel);
        }
      } catch (e: any) {
        unreadable.push({ path: rel, error: e.message || "Read error" });
      }
    }
  }

  for (const rel of mapB.keys()) {
    if (!mapA.has(rel)) {
      extra.push(rel);
    }
  }

  const problemCount = missing.length + sizeMismatch.length + hashMismatch.length + unreadable.length;
  let verdict: "PASS" | "FAIL" | "WARN" = "PASS";
  if (problemCount > 0) {
    verdict = "FAIL";
  } else if (extra.length > 0) {
    verdict = "WARN";
  }

  return {
    ok,
    missing,
    extra,
    sizeMismatch,
    hashMismatch,
    unreadable,
    summary: {
      totalFiles: allKeysA.length,
      matchCount: ok.length,
      problemCount,
      verdict,
    },
  };
}

/**
 * Scan an ISO file directly in browser: reads Sector 16 (PVD) to extract volume size and detect truncated downloads.
 */
export async function scanIsoFile(file: File): Promise<IsoScanResult> {
  const PVD_OFFSET = 16 * 2048; // 32768
  if (file.size < PVD_OFFSET + 2048) {
    throw new Error("File is smaller than ISO 9660 Primary Volume Descriptor offset (32 KiB)");
  }

  const slice = file.slice(PVD_OFFSET, PVD_OFFSET + 2048);
  const buf = await slice.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  // Check magic "CD001"
  const magic = String.fromCharCode(...bytes.subarray(1, 6));
  if (magic !== "CD001") {
    throw new Error(`Invalid ISO 9660 volume identifier: expected 'CD001', got '${magic}'`);
  }

  const systemId = String.fromCharCode(...bytes.subarray(8, 40)).trim();
  const volumeLabel = String.fromCharCode(...bytes.subarray(40, 72)).trim();

  // Volume space size (sector count) is stored at offset 80 (32-bit LE)
  const sectorCount = view.getUint32(80, true);
  const declaredVolumeSize = sectorCount * 2048;

  const isTruncated = file.size < declaredVolumeSize;
  const truncatedBytesMissing = isTruncated ? declaredVolumeSize - file.size : 0;

  return {
    fileName: file.name,
    fileSize: file.size,
    declaredVolumeSize,
    isTruncated,
    volumeLabel,
    systemId,
    totalFiles: 0,
    totalDirs: 0,
    truncatedBytesMissing,
    filesList: [],
  };
}

/**
 * Scan a ZIP file Central Directory to verify member list and CRCs without full extraction.
 */
export async function scanZipFile(file: File): Promise<ZipScanResult> {
  const fileSize = file.size;
  if (fileSize < 22) {
    throw new Error("File is too small to be a valid ZIP archive");
  }

  // Look for End of Central Directory Record (EOCD signature 0x06054b50) in last 64 KiB
  const readSize = Math.min(fileSize, 65536);
  const tailSlice = file.slice(fileSize - readSize, fileSize);
  const tailBuf = await tailSlice.arrayBuffer();
  const tailView = new DataView(tailBuf);

  let eocdOffsetInTail = -1;
  for (let i = readSize - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      eocdOffsetInTail = i;
      break;
    }
  }

  if (eocdOffsetInTail === -1) {
    throw new Error("End of Central Directory record not found (corrupted or non-standard ZIP archive)");
  }

  const totalMembers = tailView.getUint16(eocdOffsetInTail + 10, true);
  const cdSize = tailView.getUint32(eocdOffsetInTail + 12, true);
  const cdOffset = tailView.getUint32(eocdOffsetInTail + 16, true);

  if (cdOffset + cdSize > fileSize) {
    throw new Error("Central Directory offset exceeds file size (truncated ZIP archive)");
  }

  // Read Central Directory
  const cdSlice = file.slice(cdOffset, cdOffset + cdSize);
  const cdBuf = await cdSlice.arrayBuffer();
  const cdView = new DataView(cdBuf);

  const members: ZipMemberInfo[] = [];
  let p = 0;
  let totalUncompressedSize = 0;

  while (p + 46 <= cdSize) {
    const sig = cdView.getUint32(p, true);
    if (sig !== 0x02014b50) break; // Central directory file header signature

    const crc32Val = cdView.getUint32(p + 16, true).toString(16).padStart(8, "0");
    const compSize = cdView.getUint32(p + 20, true);
    const uncompSize = cdView.getUint32(p + 24, true);
    const nameLen = cdView.getUint16(p + 28, true);
    const extraLen = cdView.getUint16(p + 30, true);
    const commentLen = cdView.getUint16(p + 32, true);

    const nameBytes = new Uint8Array(cdBuf, p + 46, nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);

    members.push({
      name,
      compressedSize: compSize,
      uncompressedSize: uncompSize,
      crc32: crc32Val,
    });

    totalUncompressedSize += uncompSize;
    p += 46 + nameLen + extraLen + commentLen;
  }

  return {
    fileName: file.name,
    fileSize,
    totalMembers: members.length,
    totalUncompressedSize,
    members,
    isValidZip: true,
  };
}
