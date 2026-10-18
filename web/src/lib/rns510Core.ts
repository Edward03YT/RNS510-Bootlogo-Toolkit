// Pure TypeScript RNS 510 algorithmic core (browser and server compatible)

const CRC16_TABLE = new Uint16Array(256);
for (let b = 0; b < 256; b++) {
  let cur = b << 8;
  for (let i = 0; i < 8; i++) {
    cur = cur & 0x8000 ? ((cur << 1) ^ 0x1021) & 0xffff : (cur << 1) & 0xffff;
  }
  CRC16_TABLE[b] = cur;
}

export function crc16Xmodem(data: Uint8Array, initial: number = 0): number {
  let crc = initial;
  for (let i = 0; i < data.length; i++) {
    crc = CRC16_TABLE[((crc >> 8) ^ data[i]) & 0xff] ^ ((crc << 8) & 0xffff);
  }
  return crc;
}

export function encodeRgb555Rle(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number = 800,
  height: number = 480,
  cleanBlack: boolean = true
): Uint8Array {
  const totalPixels = width * height;
  const rgb555 = new Uint16Array(totalPixels);

  let p = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    let r = rgba[i];
    let g = rgba[i + 1];
    let b = rgba[i + 2];
    const a = rgba[i + 3];

    if (a < 255) {
      const alpha = a / 255;
      r = Math.round(r * alpha);
      g = Math.round(g * alpha);
      b = Math.round(b * alpha);
    }

    let word16 = 0;
    if (cleanBlack && r < 10 && g < 10 && b < 10) {
      word16 = 0;
    } else {
      let r5 = (r >> 3) & 0x1f;
      let g5 = (g >> 3) & 0x1f;
      let b5 = (b >> 3) & 0x1f;
      if (cleanBlack && r5 === 0 && b5 === 0 && g5 <= 1) {
        g5 = 0;
      }
      word16 = (r5 << 10) | (g5 << 5) | b5;
    }
    rgb555[p++] = word16;
  }

  // RLE Compression: [2 bytes: color big-endian] [2 bytes: count big-endian]
  const chunks: number[] = [];
  let curColor = rgb555[0];
  let curCount = 1;

  for (let i = 1; i < totalPixels; i++) {
    const word = rgb555[i];
    if (word === curColor && curCount < 0xffff) {
      curCount++;
    } else {
      chunks.push((curColor >> 8) & 0xff, curColor & 0xff, (curCount >> 8) & 0xff, curCount & 0xff);
      curColor = word;
      curCount = 1;
    }
  }
  chunks.push((curColor >> 8) & 0xff, curColor & 0xff, (curCount >> 8) & 0xff, curCount & 0xff);

  return new Uint8Array(chunks);
}

export function buildFliData(rleData: Uint8Array, width: number = 800, height: number = 480): Uint8Array {
  const dataLen = rleData.length;
  const crc2 = crc16Xmodem(rleData);

  const headerPart2 = new Uint8Array(32);
  const view2 = new DataView(headerPart2.buffer);
  view2.setUint32(0, 0x002a4444, false); // 32-35
  view2.setUint32(4, 0x00021675, false); // 36-39
  view2.setUint32(8, width, false);      // 40-43
  view2.setUint32(12, height, false);    // 44-47
  view2.setUint16(16, 0x0000, false);    // 48-49
  view2.setUint16(18, crc2, false);      // 50-51
  view2.setUint32(20, 0x00000001, false);// 52-55
  view2.setUint32(24, 0x00000000, false);// 56-59
  view2.setUint32(28, dataLen, false);   // 60-63

  // CRC1 is calculated over headerPart2 + rleData
  const combined = new Uint8Array(32 + dataLen);
  combined.set(headerPart2, 0);
  combined.set(rleData, 32);
  const crc1 = crc16Xmodem(combined);

  const headerPart1 = new Uint8Array(32);
  const view1 = new DataView(headerPart1.buffer);
  view1.setUint32(0, 0xaa55aa55, false); // 0-3: Magic
  view1.setUint32(4, 0x0000000f, false); // 4-7: STRATA_UPDATE 15
  view1.setUint32(8, dataLen + 32, false);// 8-11
  view1.setUint32(12, 0x00000000, false);
  view1.setUint16(16, 0x0000, false);
  view1.setUint16(18, crc1, false);      // 18-19: CRC1
  view1.setUint32(20, 0xffffffff, false);
  view1.setUint32(24, 0x00000000, false);
  view1.setUint32(28, 0xffffffff, false);

  const result = new Uint8Array(64 + dataLen);
  result.set(headerPart1, 0);
  result.set(headerPart2, 32);
  result.set(rleData, 64);
  return result;
}
