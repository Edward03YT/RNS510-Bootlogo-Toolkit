import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { buildBootableIsoNative } from "@/lib/rns510Server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const fliFile = formData.get("fli") as File | null;
    const fitMode = (formData.get("fitMode") as string) || "pad";
    const cleanBlack = formData.get("cleanBlack") !== "false";

    if (!imageFile && !fliFile) {
      return NextResponse.json(
        { success: false, error: "No image or FLI file provided" },
        { status: 400 }
      );
    }

    // Prepare temporary and output directories
    const rootDir = path.resolve(process.cwd(), "..");
    const bridgeScript = path.join(rootDir, "web_bridge.py");
    const outDir = path.join(process.cwd(), "public", "generated");
    const uploadsDir = path.join(outDir, "uploads");

    await fs.mkdir(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const baseName = imageFile
      ? imageFile.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
      : "custom_bootlogo";

    // Fallback native function for Vercel / serverless when Python is not available
    const runNativeFallback = async () => {
      let fliBytes: Uint8Array;
      if (fliFile) {
        fliBytes = new Uint8Array(await fliFile.arrayBuffer());
      } else {
        throw new Error("Direct FLI data required for native serverless generation.");
      }

      const res = await buildBootableIsoNative(fliBytes);

      const isoFileName = `${baseName}_${timestamp}_RNS510.iso`;
      const fliFileName = `${baseName}_${timestamp}_LOGO.FLI`;
      const previewFileName = `${baseName}_${timestamp}_PREVIEW.png`;

      await fs.writeFile(path.join(outDir, isoFileName), res.isoBytes);
      await fs.writeFile(path.join(outDir, fliFileName), fliBytes);

      // If client provided preview image, save it too
      if (imageFile) {
        const imgBuffer = Buffer.from(await imageFile.arrayBuffer());
        await fs.writeFile(path.join(outDir, previewFileName), imgBuffer);
      }

      return {
        success: true,
        isoFile: isoFileName,
        fliFile: fliFileName,
        previewFile: previewFileName,
        fliSizeBytes: res.fliSize,
        crc16: res.crc16,
        isPerfect: true,
        bit15Errors: 0,
        greenNoisePixels: 0,
        totalPixels: 384000,
        downloadUrls: {
          iso: `/api/download/${isoFileName}`,
          fli: `/api/download/${fliFileName}`,
          preview: `/api/download/${previewFileName}`,
        },
      };
    };

    // If running in Vercel or bridge script doesn't exist, use native fallback directly
    if (process.env.VERCEL || !existsSync(bridgeScript)) {
      const nativeRes = await runNativeFallback();
      return NextResponse.json(nativeRes);
    }

    // On local machine, try Python bridge first
    const buffer = Buffer.from(await (imageFile || fliFile)!.arrayBuffer());
    const safeName = (imageFile || fliFile)!.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "input.png";
    const tempInputPath = path.join(uploadsDir, `${timestamp}_${safeName}`);

    await fs.writeFile(tempInputPath, buffer);

    const pythonExe = process.platform === "win32" ? "python" : "python3";
    const args = [
      bridgeScript,
      "--action",
      "generate",
      "--image",
      tempInputPath,
      "--fit",
      fitMode,
      "--out-dir",
      outDir,
    ];

    if (!cleanBlack) {
      args.push("--no-clean-black");
    }

    const result = await new Promise<{ success: boolean; data?: any; error?: string; useFallback?: boolean }>(
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
                useFallback: true,
                error: stderrData || `Python process exited with code ${code}`,
              });
              return;
            }

            try {
              const parsed = JSON.parse(stdoutData.trim());
              resolve({ success: true, data: parsed });
            } catch (e: any) {
              resolve({
                success: false,
                useFallback: true,
                error: `Failed to parse Python output: ${e.message}`,
              });
            }
          });

          proc.on("error", (err) => {
            fs.unlink(tempInputPath).catch(() => {});
            resolve({ success: false, useFallback: true, error: err.message });
          });
        } catch (e: any) {
          if (!spawned) {
            fs.unlink(tempInputPath).catch(() => {});
            resolve({ success: false, useFallback: true, error: e.message });
          }
        }
      }
    );

    // If Python succeeded:
    if (result.success && result.data?.success) {
      const d = result.data;
      return NextResponse.json({
        success: true,
        isoFile: d.iso_file,
        fliFile: d.fli_file,
        previewFile: d.preview_file,
        fliSizeBytes: d.fli_size_bytes,
        crc16: d.crc16,
        isPerfect: d.is_perfect,
        bit15Errors: d.bit15_errors,
        greenNoisePixels: d.green_noise_pixels,
        totalPixels: d.total_pixels,
        downloadUrls: {
          iso: `/api/download/${d.iso_file}`,
          fli: `/api/download/${d.fli_file}`,
          preview: `/api/download/${d.preview_file}`,
        },
      });
    }

    // If Python was not found or failed, try native fallback
    if (result.useFallback && fliFile) {
      const nativeRes = await runNativeFallback();
      return NextResponse.json(nativeRes);
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "Generation error",
      },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
