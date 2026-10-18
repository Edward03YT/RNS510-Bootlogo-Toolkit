/**
 * Pure TypeScript ISO 9660 Level 1 Image Generator for VW RNS 510 SWL updates.
 * Generates 100% compliant ISO CD-ROM images that can be burned and flashed on RNS 510.
 * Compatible with pycdlib and automotive head units.
 */

export interface IsoFile {
  path: string; // e.g. "/WA/LOGO.FLI;1"
  data: Uint8Array;
}

export function writeUint16Dual(view: DataView, offset: number, val: number): void {
  view.setUint16(offset, val, true);   // Little Endian
  view.setUint16(offset + 2, val, false); // Big Endian
}

export function writeUint32Dual(view: DataView, offset: number, val: number): void {
  view.setUint32(offset, val, true);   // Little Endian
  view.setUint32(offset + 4, val, false); // Big Endian
}

export function formatIsoDate(d: Date): Uint8Array {
  const buf = new Uint8Array(7);
  buf[0] = d.getUTCFullYear() - 1900;
  buf[1] = d.getUTCMonth() + 1;
  buf[2] = d.getUTCDate();
  buf[3] = d.getUTCHours();
  buf[4] = d.getUTCMinutes();
  buf[5] = d.getUTCSeconds();
  buf[6] = 0;
  return buf;
}

export function formatPvdDate(d: Date): string {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = "00";
  return `${y}${m}${day}${h}${min}${s}${ms}\x00`;
}

interface DirNode {
  name: string;
  isDir: boolean;
  parent?: DirNode;
  children: DirNode[];
  data?: Uint8Array;
  sector: number;
  size: number;
  depth: number;
  dirIndex: number;
}

export function buildIso9660(
  files: IsoFile[],
  volIdent: string = "SWL_LOGO",
  sysIdent: string = "Win32"
): Uint8Array {
  const SECTOR_SIZE = 2048;
  const now = new Date();
  const date7 = formatIsoDate(now);

  // 1. Build hierarchy
  const rootNode: DirNode = {
    name: "",
    isDir: true,
    children: [],
    sector: 0,
    size: SECTOR_SIZE,
    depth: 0,
    dirIndex: 1,
  };

  function getOrCreateDir(parts: string[]): DirNode {
    let current = rootNode;
    let depth = 1;
    for (const part of parts) {
      let child = current.children.find((c) => c.isDir && c.name.toUpperCase() === part.toUpperCase());
      if (!child) {
        child = {
          name: part.toUpperCase(),
          isDir: true,
          parent: current,
          children: [],
          sector: 0,
          size: SECTOR_SIZE,
          depth,
          dirIndex: 0,
        };
        current.children.push(child);
      }
      current = child;
      depth++;
    }
    return current;
  }

  // Insert all files
  for (const f of files) {
    const cleanPath = f.path.replace(/^\/+/, "");
    const parts = cleanPath.split("/");
    const fileName = parts.pop()!;
    const dirNode = getOrCreateDir(parts);
    dirNode.children.push({
      name: fileName.toUpperCase(),
      isDir: false,
      parent: dirNode,
      children: [],
      data: f.data,
      sector: 0,
      size: f.data.length,
      depth: dirNode.depth + 1,
      dirIndex: 0,
    });
  }

  // BFS / Level-order traversal of directories for ISO 9660 path table
  const allDirs: DirNode[] = [];
  const queue: DirNode[] = [rootNode];

  while (queue.length > 0) {
    const node = queue.shift()!;
    allDirs.push(node);
    // Sort subdirectories alphabetically before enqueuing
    const subDirs = node.children.filter((c) => c.isDir).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const sd of subDirs) {
      queue.push(sd);
    }
  }

  // Assign 1-based dirIndex
  allDirs.forEach((d, idx) => {
    d.dirIndex = idx + 1;
    // Sort all children in directory alphabetically
    d.children.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  });

  // Sector allocation matching standard pycdlib layout:
  // Sector 16: PVD
  // Sector 17: Terminator
  // Sector 19: L-Path Table
  // Sector 21: M-Path Table
  // Sector 23..23+N: Directory sectors (starting at 23 for root)
  let curDirSector = 23;
  for (const d of allDirs) {
    d.sector = curDirSector;
    curDirSector++;
  }

  // Files start after all directories
  let curFileSector = curDirSector;
  // If pycdlib uses sector 29 for files:
  if (curFileSector < 29) {
    curFileSector = 29;
  }

  function assignFileSectors(dir: DirNode) {
    for (const child of dir.children) {
      if (!child.isDir && child.data) {
        child.sector = curFileSector;
        const sectorsNeeded = Math.ceil(child.data.length / SECTOR_SIZE) || 1;
        curFileSector += sectorsNeeded;
      } else if (child.isDir) {
        assignFileSectors(child);
      }
    }
  }

  assignFileSectors(rootNode);

  const totalSectors = curFileSector;
  const isoBuffer = new Uint8Array(totalSectors * SECTOR_SIZE);

  function getSector(sec: number): Uint8Array {
    return isoBuffer.subarray(sec * SECTOR_SIZE, (sec + 1) * SECTOR_SIZE);
  }

  // --- Sector 16: Primary Volume Descriptor ---
  const pvdSector = getSector(16);
  const pvdView = new DataView(pvdSector.buffer, pvdSector.byteOffset, SECTOR_SIZE);
  pvdSector[0] = 0x01; // Primary Volume Descriptor
  pvdSector.set(new TextEncoder().encode("CD001"), 1);
  pvdSector[6] = 0x01; // Version

  const sysIdBytes = new TextEncoder().encode(sysIdent.padEnd(32, " ").substring(0, 32));
  pvdSector.set(sysIdBytes, 8);

  const volIdBytes = new TextEncoder().encode(volIdent.padEnd(32, " ").substring(0, 32));
  pvdSector.set(volIdBytes, 40);

  writeUint32Dual(pvdView, 80, totalSectors);

  writeUint16Dual(pvdView, 120, 1); // Set Size
  writeUint16Dual(pvdView, 124, 1); // Seq Num
  writeUint16Dual(pvdView, 128, 2048); // Block Size

  // Path Table Size
  let pathTableSize = 0;
  for (const d of allDirs) {
    const nameLen = d === rootNode ? 1 : d.name.length;
    pathTableSize += 8 + nameLen + (nameLen % 2 === 1 ? 1 : 0);
  }
  writeUint32Dual(pvdView, 132, pathTableSize);

  // Sector 19 for L-table, Sector 21 for M-table
  pvdView.setUint32(140, 19, true);  // L-Table
  pvdView.setUint32(148, 21, false); // M-Table

  // Root Directory Record in PVD (34 bytes at offset 156)
  writeDirRecord(pvdSector, 156, rootNode, "\x00", date7, true);

  // Standard PVD filler
  pvdSector.set(new TextEncoder().encode(" ".repeat(128)), 190);
  pvdSector.set(new TextEncoder().encode(" ".repeat(128)), 318);
  pvdSector.set(new TextEncoder().encode(" ".repeat(128)), 446);
  pvdSector.set(new TextEncoder().encode(" ".repeat(128)), 574);
  pvdSector.set(new TextEncoder().encode(" ".repeat(37)), 702);
  pvdSector.set(new TextEncoder().encode(" ".repeat(37)), 739);
  pvdSector.set(new TextEncoder().encode(" ".repeat(37)), 776);

  const pvdDateStr = formatPvdDate(now);
  pvdSector.set(new TextEncoder().encode(pvdDateStr), 813);
  pvdSector.set(new TextEncoder().encode(pvdDateStr), 830);
  pvdSector.set(new TextEncoder().encode("0000000000000000\x00"), 847);
  pvdSector.set(new TextEncoder().encode(pvdDateStr), 864);
  pvdSector[881] = 0x01;

  // --- Sector 17: Terminator ---
  const termSector = getSector(17);
  termSector[0] = 0xff;
  termSector.set(new TextEncoder().encode("CD001"), 1);
  termSector[6] = 0x01;

  // --- Sector 19: L-Path Table ---
  const lPathSector = getSector(19);
  const lPathView = new DataView(lPathSector.buffer, lPathSector.byteOffset, SECTOR_SIZE);
  let lOffset = 0;
  for (const d of allDirs) {
    const isRoot = d === rootNode;
    const nameLen = isRoot ? 1 : d.name.length;
    lPathSector[lOffset] = nameLen;
    lPathSector[lOffset + 1] = 0;
    lPathView.setUint32(lOffset + 2, d.sector, true);
    const parentNum = isRoot ? 1 : d.parent?.dirIndex || 1;
    lPathView.setUint16(lOffset + 6, parentNum, true);
    lOffset += 8;
    if (isRoot) {
      lPathSector[lOffset++] = 0x00;
      lPathSector[lOffset++] = 0x00; // 1-byte name + 1-byte pad
    } else {
      lPathSector.set(new TextEncoder().encode(d.name), lOffset);
      lOffset += nameLen;
      if (nameLen % 2 === 1) {
        lPathSector[lOffset++] = 0x00;
      }
    }
  }

  // --- Sector 21: M-Path Table ---
  const mPathSector = getSector(21);
  const mPathView = new DataView(mPathSector.buffer, mPathSector.byteOffset, SECTOR_SIZE);
  let mOffset = 0;
  for (const d of allDirs) {
    const isRoot = d === rootNode;
    const nameLen = isRoot ? 1 : d.name.length;
    mPathSector[mOffset] = nameLen;
    mPathSector[mOffset + 1] = 0;
    mPathView.setUint32(mOffset + 2, d.sector, false);
    const parentNum = isRoot ? 1 : d.parent?.dirIndex || 1;
    mPathView.setUint16(mOffset + 6, parentNum, false);
    mOffset += 8;
    if (isRoot) {
      mPathSector[mOffset++] = 0x00;
      mPathSector[mOffset++] = 0x00;
    } else {
      mPathSector.set(new TextEncoder().encode(d.name), mOffset);
      mOffset += nameLen;
      if (nameLen % 2 === 1) {
        mPathSector[mOffset++] = 0x00;
      }
    }
  }

  // --- Directory Record Writer ---
  function writeDirRecord(
    sec: Uint8Array,
    offset: number,
    node: DirNode,
    nameOverride: string,
    date: Uint8Array,
    isDir: boolean
  ): number {
    const name = nameOverride !== "" ? nameOverride : node.name;
    const nameBytes = new TextEncoder().encode(name);
    const nameLen = nameBytes.length;
    let recLen = 33 + nameLen;
    if (recLen % 2 === 1) recLen++;

    const view = new DataView(sec.buffer, sec.byteOffset, sec.length);
    sec[offset] = recLen;
    sec[offset + 1] = 0;
    writeUint32Dual(view, offset + 2, node.sector);
    writeUint32Dual(view, offset + 10, node.size);
    sec.set(date, offset + 18);
    sec[offset + 25] = isDir ? 0x02 : 0x00;
    sec[offset + 26] = 0;
    sec[offset + 27] = 0;
    writeUint16Dual(view, offset + 28, 1);
    sec[offset + 32] = nameLen;
    sec.set(nameBytes, offset + 33);
    if (nameLen % 2 === 0) {
      sec[offset + 33 + nameLen] = 0;
    }
    return recLen;
  }

  // Write all directory sectors
  for (const d of allDirs) {
    const sec = getSector(d.sector);
    let off = 0;

    // '.' entry
    const dotLen = writeDirRecord(sec, off, d, "\x00", date7, true);
    off += dotLen;

    // '..' entry
    const parentNode = d.parent || d;
    const dotDotLen = writeDirRecord(sec, off, parentNode, "\x01", date7, true);
    off += dotDotLen;

    // Children entries
    for (const child of d.children) {
      const childLen = writeDirRecord(sec, off, child, "", date7, child.isDir);
      off += childLen;
    }
  }

  // --- Copy File Data into Sectors ---
  function copyFiles(dir: DirNode) {
    for (const child of dir.children) {
      if (!child.isDir && child.data) {
        const fileStart = child.sector * SECTOR_SIZE;
        isoBuffer.set(child.data, fileStart);
      } else if (child.isDir) {
        copyFiles(child);
      }
    }
  }

  copyFiles(rootNode);

  return isoBuffer;
}
