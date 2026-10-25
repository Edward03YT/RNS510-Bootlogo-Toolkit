import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { buildIso9660, IsoFile } from "./iso9660";
import { crc16Xmodem } from "./rns510Core";

export async function findTemplateDir(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "public", "template_swl"),
    path.join(process.cwd(), "template_swl"),
    path.resolve(process.cwd(), "..", "template_swl"),
    path.join(process.cwd(), "web", "public", "template_swl"),
    path.join(process.cwd(), "web", "template_swl"),
  ];

  for (const c of candidates) {
    if (
      existsSync(/*turbopackIgnore: true*/ c) &&
      existsSync(/*turbopackIgnore: true*/ path.join(c, "BLSCRIPT.CFG")) &&
      existsSync(/*turbopackIgnore: true*/ path.join(c, "VERSION.TXT")) &&
      existsSync(/*turbopackIgnore: true*/ path.join(c, "SWL", "SILVER_1", "RNSMIDEC", "SWL", "SWL.FLI"))
    ) {
      return c;
    }
  }

  throw new Error("Could not find template_swl directory with required files");
}

export async function buildBootableIsoNative(
  fliBytes: Uint8Array
): Promise<{ isoBytes: Uint8Array; crc16: string; fliSize: number }> {
  const fliSize = fliBytes.length;
  const ecuOrderStr =
    `SHOW_SCREEN 0 1 SWL_SCREEN_VERSION\r\n` +
    `STRATA_UPDATE 15 ${fliSize} /cddos/WA/LOGO.FLI\r\n` +
    `RESTART_SYSTEM\r\n` +
    `FINISHED_DOWNLOAD\r\n`;

  const ecuOrderBytes = new TextEncoder().encode(ecuOrderStr);
  const crc16Num = crc16Xmodem(ecuOrderBytes);
  const crc16Str = crc16Num.toString(16).padStart(4, "0");
  const crc16Bytes = new TextEncoder().encode(crc16Str);

  const tplDir = await findTemplateDir();

  const blscriptBytes = await fs.readFile(path.join(tplDir, "BLSCRIPT.CFG"));
  const versionBytes = await fs.readFile(path.join(tplDir, "VERSION.TXT"));
  const swlFliBytes = await fs.readFile(
    path.join(tplDir, "SWL", "SILVER_1", "RNSMIDEC", "SWL", "SWL.FLI")
  );

  let dirInfBytes = new TextEncoder().encode("\r\n");
  const dirInfPath = path.join(tplDir, "DIR.INF");
  if (existsSync(dirInfPath)) {
    dirInfBytes = await fs.readFile(dirInfPath);
  }

  const files: IsoFile[] = [
    { path: "/BLSCRIPT.CFG;1", data: blscriptBytes },
    { path: "/CRC.16;1", data: crc16Bytes },
    { path: "/DIR.INF;1", data: dirInfBytes },
    { path: "/ECUORDER.TXT;1", data: ecuOrderBytes },
    { path: "/VERSION.TXT;1", data: versionBytes },
    { path: "/WA/LOGO.FLI;1", data: fliBytes },
    { path: "/SWL/SILVER_1/RNSMIDEC/SWL/SWL.FLI;1", data: swlFliBytes },
  ];

  const isoBytes = buildIso9660(files, "SWL_LOGO", "Win32");

  return {
    isoBytes,
    crc16: crc16Str,
    fliSize,
  };
}
