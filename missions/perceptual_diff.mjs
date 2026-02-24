/**
 * Perceptual screenshot comparison — pure JS, zero dependencies.
 *
 * Decodes PNG to raw pixels (handles all standard filter types),
 * then compares 16x16 blocks. Returns a change ratio that's
 * robust against CRT flicker, cursor blink, and compression jitter.
 */

import zlib from "zlib";
import fs from "fs";

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(b64) {
  const buf = Buffer.from(b64, "base64");
  let offset = 8; // skip PNG signature
  let width, height, colorType;
  const idatChunks = [];

  while (offset < buf.length) {
    const chunkLen = buf.readUInt32BE(offset);
    const chunkType = buf.toString("ascii", offset + 4, offset + 8);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLen);

    if (chunkType === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      colorType = chunkData[9];
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
    offset += 12 + chunkLen;
  }

  if (!width || !height) throw new Error("Invalid PNG: missing IHDR");

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const rowBytes = width * bpp;
  const stride = 1 + rowBytes;
  const pixels = Buffer.alloc(width * height * bpp);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    const srcOff = y * stride + 1;
    const dstOff = y * rowBytes;

    for (let x = 0; x < rowBytes; x++) {
      const filt = raw[srcOff + x];
      const a = x >= bpp ? pixels[dstOff + x - bpp] : 0;
      const b = y > 0 ? pixels[dstOff - rowBytes + x] : 0;
      const c = (x >= bpp && y > 0) ? pixels[dstOff - rowBytes + x - bpp] : 0;

      let val;
      switch (filter) {
        case 0: val = filt; break;
        case 1: val = (filt + a) & 0xFF; break;
        case 2: val = (filt + b) & 0xFF; break;
        case 3: val = (filt + ((a + b) >> 1)) & 0xFF; break;
        case 4: val = (filt + paethPredictor(a, b, c)) & 0xFF; break;
        default: val = filt;
      }
      pixels[dstOff + x] = val;
    }
  }

  return { pixels, width, height, bpp };
}

/**
 * Compare two PNG screenshots using block-based perceptual analysis.
 *
 * @param {string} b64a - base64-encoded PNG
 * @param {string} b64b - base64-encoded PNG
 * @param {object} opts
 * @param {number} opts.blockSize    - pixel block size (default 16)
 * @param {number} opts.blockThresh  - per-block avg channel diff to count as "changed" (default 8)
 * @param {number} opts.changeThresh - fraction of blocks that must differ to call "changed" (default 0.03)
 * @returns {{ changed: boolean, ratio: number, changedBlocks: number, totalBlocks: number, detail: string }}
 */
export function compareScreenshots(b64a, b64b, opts = {}) {
  const blockSize = opts.blockSize || 16;
  const blockThresh = opts.blockThresh ?? 3;
  const changeThresh = opts.changeThresh ?? 0.01;

  if (!b64a || !b64b) return { changed: true, ratio: 1.0, changedBlocks: 0, totalBlocks: 0, detail: "missing screenshot" };

  let imgA, imgB;
  try {
    imgA = decodePng(b64a);
    imgB = decodePng(b64b);
  } catch (e) {
    return { changed: true, ratio: 1.0, changedBlocks: 0, totalBlocks: 0, detail: "decode error: " + e.message };
  }

  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return { changed: true, ratio: 1.0, changedBlocks: 0, totalBlocks: 0, detail: "dimension mismatch" };
  }

  const { width, height, bpp } = imgA;
  const channels = Math.min(bpp, 3); // compare RGB only, skip alpha
  const blocksX = Math.ceil(width / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  const totalBlocks = blocksX * blocksY;
  let changedBlocks = 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let totalDiff = 0;
      let pixelCount = 0;

      const yStart = by * blockSize;
      const yEnd = Math.min(yStart + blockSize, height);
      const xStart = bx * blockSize;
      const xEnd = Math.min(xStart + blockSize, width);

      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const off = (y * width + x) * bpp;
          for (let c = 0; c < channels; c++) {
            totalDiff += Math.abs(imgA.pixels[off + c] - imgB.pixels[off + c]);
          }
          pixelCount++;
        }
      }

      if (pixelCount > 0 && (totalDiff / (pixelCount * channels)) > blockThresh) {
        changedBlocks++;
      }
    }
  }

  const ratio = changedBlocks / totalBlocks;
  const changed = ratio > changeThresh;
  const pct = (ratio * 100).toFixed(1);
  const detail = `${changedBlocks}/${totalBlocks} blocks differ (${pct}%)`;

  return { changed, ratio, changedBlocks, totalBlocks, detail };
}

/**
 * Compare a live screenshot (base64) against a reference PNG file on disk.
 * Returns { matches, ratio, detail } where matches=true means the screens
 * are structurally similar (same screen), using inverted logic from
 * compareScreenshots: low block diff ratio = match.
 *
 * @param {string} liveB64 - base64-encoded PNG from a live screenshot
 * @param {string} refPath - absolute path to reference PNG file
 * @param {object} opts
 * @param {number} opts.blockSize    - pixel block size (default 16)
 * @param {number} opts.blockThresh  - per-block avg channel diff to count as "changed" (default 6)
 * @param {number} opts.matchThresh  - max fraction of changed blocks to still count as matching (default 0.25)
 * @returns {{ matches: boolean, ratio: number, detail: string }}
 */
export function compareToReference(liveB64, refPath, opts = {}) {
  const blockSize = opts.blockSize || 16;
  const blockThresh = opts.blockThresh ?? 6;
  const matchThresh = opts.matchThresh ?? 0.25;

  if (!liveB64) return { matches: false, ratio: 1.0, detail: "missing live screenshot" };
  if (!fs.existsSync(refPath)) return { matches: false, ratio: 1.0, detail: `reference not found: ${refPath}` };

  const refBuf = fs.readFileSync(refPath);
  const refB64 = refBuf.toString("base64");

  let imgLive, imgRef;
  try {
    imgLive = decodePng(liveB64);
    imgRef = decodePng(refB64);
  } catch (e) {
    return { matches: false, ratio: 1.0, detail: "decode error: " + e.message };
  }

  if (imgLive.width !== imgRef.width || imgLive.height !== imgRef.height) {
    return { matches: false, ratio: 1.0, detail: `dimension mismatch: live ${imgLive.width}x${imgLive.height} vs ref ${imgRef.width}x${imgRef.height}` };
  }

  const { width, height, bpp } = imgLive;
  const channels = Math.min(bpp, 3);
  const blocksX = Math.ceil(width / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  const totalBlocks = blocksX * blocksY;
  let changedBlocks = 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let totalDiff = 0;
      let pixelCount = 0;
      const yStart = by * blockSize;
      const yEnd = Math.min(yStart + blockSize, height);
      const xStart = bx * blockSize;
      const xEnd = Math.min(xStart + blockSize, width);

      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const off = (y * width + x) * bpp;
          for (let c = 0; c < channels; c++) {
            totalDiff += Math.abs(imgLive.pixels[off + c] - imgRef.pixels[off + c]);
          }
          pixelCount++;
        }
      }
      if (pixelCount > 0 && (totalDiff / (pixelCount * channels)) > blockThresh) {
        changedBlocks++;
      }
    }
  }

  const ratio = changedBlocks / totalBlocks;
  const matches = ratio <= matchThresh;
  const pct = (ratio * 100).toFixed(1);
  const detail = `${changedBlocks}/${totalBlocks} blocks differ (${pct}%)`;
  return { matches, ratio, detail };
}
