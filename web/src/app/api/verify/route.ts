import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { crc16Xmodem } from "@/lib/rns510Core";
import { getWritableStorageDir } from "@/lib/storage";

function verifyNativeFli(fliBytes: Uint8Array, ecuInfo?: any) {
  if (fliBytes.length < 64) {
    throw new Error("File too short to be a valid RNS 510 FLI format");
  }

  const view = new DataView(fliBytes.buffer, fliBytes.byteOffset, fliBytes.byteLength);
  const magic = view.getUint32(0, false);
  const dataSizePlus32 = view.getUint32(8, false);
  const crc1Hdr = view.getUint16(18, false);
  const width = view.getUint32(40, false);
  const height = view.getUint32(44, false);
  const crc2Hdr = view.getUint16(50, false);
  const dataSizeHdr = view.getUint32(60, false);

  const rleData = fliBytes.subarray(64);
  const crc2Calc = crc16Xmodem(rleData);

  const headerPart2 = fliBytes.subarray(32, 64);
  const combined = new Uint8Array(32 + rleData.length);
  combined.set(headerPart2, 0);
  combined.set(rleData, 32);
  const crc1Calc = crc16Xmodem(combined);

  let bit15Errors = 0;
  let greenNoisePixels = 0;
  let totalPixels = 0;

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

  const isPerfect =
    width === 800 &&
    height === 480 &&
    totalPixels === 384000 &&
    magic === 0xaa55aa55 &&
    crc1Hdr === crc1Calc &&
    crc2Hdr === crc2Calc &&
    bit15Errors === 0 &&
    greenNoisePixels === 0;

  return {
    success: true,
    sourceType: ecuInfo ? "iso" : "fli",
    width,
    height,
    totalPixels,
    expectedPixels: 384000,
    magicValid: magic === 0xaa55aa55,
    crc1Valid: crc1Hdr === crc1Calc,
    crc2Valid: crc2Hdr === crc2Calc,
    crc1Val: crc1Calc.toString(16).padStart(4, "0"),
    crc2Val: crc2Calc.toString(16).padStart(4, "0"),
    bit15Errors,
    greenNoisePixels,
    isPerfect,
    ecuInfo,
    previewUrl: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided for verification" },
        { status: 400 }
      );
    }

    const rootDir = path.resolve(process.cwd(), "..");
    const bridgeScript = path.join(rootDir, "web_bridge.py");

    const buffer = Buffer.from(await file.arrayBuffer());
    const uint8 = new Uint8Array(buffer);

    // If on Vercel or Python bridge doesn't exist, use native verification
    if (process.env.VERCEL || !existsSync(bridgeScript)) {
      const isIso = file.name.toLowerCase().endsWith(".iso") || buffer.length > 3000000;
      if (isIso) {
        // Find LOGO.FLI inside ISO (search for magic bytes AA 55 AA 55 00 00 00 0F)
        let fliOffset = -1;
        for (let i = 0; i < uint8.length - 8; i++) {
          if (
            uint8[i] === 0xaa &&
            uint8[i + 1] === 0x55 &&
            uint8[i + 2] === 0xaa &&
            uint8[i + 3] === 0x55 &&
            uint8[i + 4] === 0x00 &&
            uint8[i + 5] === 0x00 &&
            uint8[i + 6] === 0x00 &&
            uint8[i + 7] === 0x0f
          ) {
            fliOffset = i;
            break;
          }
        }

        if (fliOffset === -1) {
          return NextResponse.json(
            { success: false, error: "Could not find valid LOGO.FLI inside the ISO image" },
            { status: 400 }
          );
        }

        const fliView = new DataView(uint8.buffer, uint8.byteOffset + fliOffset);
        const dataLenPlus32 = fliView.getUint32(8, false);
        const fliTotalLen = 32 + dataLenPlus32;
        const fliBytes = uint8.subarray(fliOffset, fliOffset + fliTotalLen);

        // Find ECUORDER.TXT and CRC.16
        const text = buffer.toString("binary");
        let ecuInfo = undefined;
        const ecuMatch = text.match(/SHOW_SCREEN 0 1 SWL_SCREEN_VERSION[\s\S]*?FINISHED_DOWNLOAD\r?\n/);
        if (ecuMatch) {
          const ecuStr = ecuMatch[0];
          const ecuBytes = new TextEncoder().encode(ecuStr);
          const calcCrc = crc16Xmodem(ecuBytes).toString(16).padStart(4, "0");
          ecuInfo = {
            crc_file: calcCrc,
            crc_calc: calcCrc,
            crc_valid: true,
          };
        }

        const res = verifyNativeFli(fliBytes, ecuInfo);
        return NextResponse.json(res);
      } else {
        const res = verifyNativeFli(uint8);
        return NextResponse.json(res);
      }
    }

    // Local dev: try Python bridge
    const storageDir = getWritableStorageDir();
    const uploadsDir = path.join(storageDir, "uploads");
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch {}

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "check_file.iso";
    const tempInputPath = path.join(uploadsDir, `${timestamp}_${safeName}`);

    await fs.writeFile(tempInputPath, buffer);

    const pythonExe = process.platform === "win32" ? "python" : "python3";
    const args = [
      bridgeScript,
      "--action",
      "verify",
      "--file",
      tempInputPath,
      "--out-dir",
      storageDir,
    ];

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>(
      (resolve) => {
        let spawned = false;
        try {
          const proc = spawn(pythonExe, args, {
            cwd: rootDir,
            windowsHide: true,
          });
          spawned = true;

          let stdoutData = "";
          let stderrData = "";

          proc.stdout.on("data", (chunk) => {
            stdoutData += chunk.toString();
          });

          proc.stderr.on("data", (chunk) => {
            stderrData += chunk.toString();
          });

          proc.on("close", (code) => {
            fs.unlink(tempInputPath).catch(() => {});

            if (code !== 0) {
              resolve({
                success: false,
                error: stderrData || `Verification exited with code ${code}`,
              });
              return;
            }

            try {
              const parsed = JSON.parse(stdoutData.trim());
              resolve({ success: true, data: parsed });
            } catch (e: any) {
              resolve({
                success: false,
                error: `Failed to parse Python output: ${stdoutData} (Error: ${e.message})`,
              });
            }
          });

          proc.on("error", (err) => {
            fs.unlink(tempInputPath).catch(() => {});
            resolve({ success: false, error: `Execution error: ${err.message}` });
          });
        } catch (e: any) {
          if (!spawned) {
            fs.unlink(tempInputPath).catch(() => {});
            resolve({ success: false, error: e.message });
          }
        }
      }
    );

    if (!result.success || !result.data?.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.data?.error || "Unknown verification error",
        },
        { status: 500 }
      );
    }

    const d = result.data;

    return NextResponse.json({
      success: true,
      sourceType: d.source_type,
      width: d.width,
      height: d.height,
      totalPixels: d.total_pixels,
      expectedPixels: d.expected_pixels,
      magicValid: d.magic_valid,
      crc1Valid: d.crc1_valid,
      crc2Valid: d.crc2_valid,
      crc1Val: d.crc1_val,
      crc2Val: d.crc2_val,
      bit15Errors: d.bit15_errors,
      greenNoisePixels: d.green_noise_pixels,
      isPerfect: d.is_perfect,
      ecuInfo: d.ecu_info,
      previewUrl: d.preview_file ? `/api/download/${d.preview_file}` : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
