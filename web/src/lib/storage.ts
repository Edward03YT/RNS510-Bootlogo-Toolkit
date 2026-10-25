import path from "path";
import os from "os";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

interface StoredFile {
  buffer: Buffer;
  contentType: string;
  timestamp: number;
}

// In-memory cache to guarantee instant, reliable delivery even in serverless/read-only environments
const memoryStore = new Map<string, StoredFile>();

// Clean up files older than 2 hours to avoid memory leaks
const TTL_MS = 2 * 60 * 60 * 1000;

function cleanupOldFiles(): void {
  const now = Date.now();
  for (const [key, val] of memoryStore.entries()) {
    if (now - val.timestamp > TTL_MS) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Returns a writable directory path for temporary file persistence.
 * Prefers os.tmpdir() in serverless / Vercel environments.
 */
export function getWritableStorageDir(): string {
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.env.NODE_ENV === "production";

  if (isServerless) {
    const tmpOut = path.join(os.tmpdir(), "rns510_generated");
    if (!existsSync(tmpOut)) {
      try {
        mkdirSync(tmpOut, { recursive: true });
      } catch {
        // Ignored if cannot mkdir
      }
    }
    return tmpOut;
  }

  // Local development: try public/generated first, then fallback to os.tmpdir()
  const localOut = path.join(process.cwd(), "public", "generated");
  try {
    if (!existsSync(localOut)) {
      mkdirSync(localOut, { recursive: true });
    }
    return localOut;
  } catch {
    const tmpOut = path.join(os.tmpdir(), "rns510_generated");
    if (!existsSync(tmpOut)) {
      try {
        mkdirSync(tmpOut, { recursive: true });
      } catch {
        // Ignored
      }
    }
    return tmpOut;
  }
}

/**
 * Saves a file into memory store AND attempts to write to disk if possible.
 * Never throws ENOENT/EROFS on read-only environments.
 */
export async function saveGeneratedFile(
  filename: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  cleanupOldFiles();

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const safeFilename = path.basename(filename);

  // 1. Save in memory store
  memoryStore.set(safeFilename, {
    buffer,
    contentType,
    timestamp: Date.now(),
  });

  // 2. Best-effort write to disk
  try {
    const dir = getWritableStorageDir();
    const filePath = path.join(/*turbopackIgnore: true*/ dir, safeFilename);
    await fs.writeFile(/*turbopackIgnore: true*/ filePath, buffer);
    return filePath;
  } catch (e) {
    // If disk write fails (e.g. read-only filesystem), memoryStore still holds the data
    return safeFilename;
  }
}

/**
 * Retrieves a file by filename from memory store, os.tmpdir(), or public/generated.
 */
export async function getGeneratedFile(
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const safeFilename = path.basename(filename);

  // 1. Check in-memory store
  const inMemory = memoryStore.get(safeFilename);
  if (inMemory) {
    return {
      buffer: inMemory.buffer,
      contentType: inMemory.contentType,
    };
  }

  // 2. Check candidate directories on disk
  const candidates = [
    path.join(os.tmpdir(), "rns510_generated", safeFilename),
    path.join(process.cwd(), "public", "generated", safeFilename),
    path.join(process.cwd(), "web", "public", "generated", safeFilename),
  ];

  for (const c of candidates) {
    try {
      if (existsSync(/*turbopackIgnore: true*/ c)) {
        const buffer = await fs.readFile(/*turbopackIgnore: true*/ c);
        let contentType = "application/octet-stream";
        if (safeFilename.endsWith(".png")) contentType = "image/png";
        else if (safeFilename.endsWith(".iso")) contentType = "application/x-iso9660-image";
        else if (safeFilename.endsWith(".fli")) contentType = "application/octet-stream";

        return { buffer, contentType };
      }
    } catch {
      // Continue checking next
    }
  }

  return null;
}
