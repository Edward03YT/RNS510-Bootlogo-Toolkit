import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";


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
    const outDir = path.join(process.cwd(), "public", "generated");
    const uploadsDir = path.join(outDir, "uploads");

    await fs.mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
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
      outDir,
    ];

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>(
      (resolve) => {
        const proc = spawn(pythonExe, args, {
          cwd: rootDir,
          windowsHide: true,
        });

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
      previewUrl: d.preview_file ? `/generated/${d.preview_file}` : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
