import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export interface PdfEmbeddedImage {
  width: number;
  height: number;
  rgbFlate: Buffer;
  alphaFlate?: Buffer;
}

let cachedOfficialLogo: PdfEmbeddedImage | null | undefined;

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decodifica um arquivo PNG RGBA/RGB (8 bits, não entrelaçado) usando apenas `node:zlib`,
 * reduzindo proporcionalmente para `targetSize` (ex.: 180px) para manter o PDF leve e nítido.
 */
export function decodePngToPdfImage(
  pngBytes: Buffer,
  targetSize = 180
): PdfEmbeddedImage | null {
  if (pngBytes.length < 33) return null;
  const sig = "89504e470d0a1a0a";
  if (pngBytes.subarray(0, 8).toString("hex") !== sig) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= pngBytes.length) {
    const length = pngBytes.readUInt32BE(offset);
    const type = pngBytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > pngBytes.length) break;

    if (type === "IHDR" && length >= 13) {
      width = pngBytes.readUInt32BE(dataStart);
      height = pngBytes.readUInt32BE(dataStart + 4);
      bitDepth = pngBytes[dataStart + 8];
      colorType = pngBytes[dataStart + 9];
    } else if (type === "IDAT") {
      idatChunks.push(pngBytes.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4; // +4 CRC
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8) return null;
  if (colorType !== 6 && colorType !== 2) return null; // 6=RGBA, 2=RGB

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const raw = Buffer.alloc(height * stride);

  let inPos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = inflated[inPos++];
    const rowStart = y * stride;
    const prevRowStart = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const val = inflated[inPos++] ?? 0;
      const a = x >= channels ? raw[rowStart + x - channels] : 0;
      const b = y > 0 ? raw[prevRowStart + x] : 0;
      const c = y > 0 && x >= channels ? raw[prevRowStart + x - channels] : 0;

      let recon = val;
      if (filterType === 1) recon = (val + a) & 0xff;
      else if (filterType === 2) recon = (val + b) & 0xff;
      else if (filterType === 3) recon = (val + ((a + b) >> 1)) & 0xff;
      else if (filterType === 4) recon = (val + paethPredictor(a, b, c)) & 0xff;

      raw[rowStart + x] = recon;
    }
  }

  // Reduz proporcionalmente (box sampling) para PDF rápido e nítido
  const outW = Math.min(width, targetSize);
  const outH = Math.max(1, Math.round((height * outW) / width));
  const rgb = Buffer.alloc(outW * outH * 3);
  const alpha = channels === 4 ? Buffer.alloc(outW * outH) : null;

  for (let oy = 0; oy < outH; oy++) {
    const sy0 = Math.floor((oy * height) / outH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((oy + 1) * height) / outH));
    for (let ox = 0; ox < outW; ox++) {
      const sx0 = Math.floor((ox * width) / outW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((ox + 1) * width) / outW));
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let count = 0;

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const idx = (sy * width + sx) * channels;
          rSum += raw[idx];
          gSum += raw[idx + 1];
          bSum += raw[idx + 2];
          if (channels === 4) aSum += raw[idx + 3];
          count += 1;
        }
      }

      const outIdx = (oy * outW + ox) * 3;
      rgb[outIdx] = Math.round(rSum / count);
      rgb[outIdx + 1] = Math.round(gSum / count);
      rgb[outIdx + 2] = Math.round(bSum / count);
      if (alpha) {
        alpha[oy * outW + ox] = Math.round(aSum / count);
      }
    }
  }

  return {
    width: outW,
    height: outH,
    rgbFlate: zlib.deflateSync(rgb),
    alphaFlate: alpha ? zlib.deflateSync(alpha) : undefined,
  };
}

export function getOfficialArqVerticeLogoForPdf(): PdfEmbeddedImage | null {
  if (cachedOfficialLogo !== undefined) return cachedOfficialLogo;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (!fs.existsSync(logoPath)) {
      cachedOfficialLogo = null;
      return null;
    }
    const pngBytes = fs.readFileSync(logoPath);
    cachedOfficialLogo = decodePngToPdfImage(pngBytes, 180);
    return cachedOfficialLogo;
  } catch {
    cachedOfficialLogo = null;
    return null;
  }
}
