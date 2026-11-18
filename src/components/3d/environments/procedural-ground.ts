import * as THREE from "three";

export type GroundPresetId = "studio" | "concrete" | "grass" | "wood" | "basalt";

export interface GroundPresetMeta {
  id: GroundPresetId;
  label: string;
  shortLabel: string;
  swatch: string;
  defaultScale: number;
  roughness: number;
  metalness: number;
}

export const GROUND_PRESETS: GroundPresetMeta[] = [
  {
    id: "studio",
    label: "Estúdio Infinito (Shadow Catcher)",
    shortLabel: "Estúdio",
    swatch: "#E7E5E4",
    defaultScale: 6,
    roughness: 0.92,
    metalness: 0.0,
  },
  {
    id: "concrete",
    label: "Concreto Arquitetônico Queimado",
    shortLabel: "Concreto",
    swatch: "#9CA3AF",
    defaultScale: 10,
    roughness: 0.72,
    metalness: 0.04,
  },
  {
    id: "grass",
    label: "Grama Natural / Paisagismo",
    shortLabel: "Grama",
    swatch: "#4D7C0F",
    defaultScale: 14,
    roughness: 0.94,
    metalness: 0.0,
  },
  {
    id: "wood",
    label: "Deck de Madeira Nobre",
    shortLabel: "Madeira",
    swatch: "#92400E",
    defaultScale: 10,
    roughness: 0.48,
    metalness: 0.02,
  },
  {
    id: "basalt",
    label: "Pedra Basalto / Calçamento",
    shortLabel: "Basalto",
    swatch: "#44403C",
    defaultScale: 12,
    roughness: 0.82,
    metalness: 0.05,
  },
];

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2D(xi, yi);
  const b = hash2D(xi + 1, yi);
  const c = hash2D(xi, yi + 1);
  const d = hash2D(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return value;
}

function buildNormalFromHeight(
  height: Float32Array,
  size: number,
  strength: number
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;

      const nx = -dx;
      const ny = -dy;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createRadialAlphaTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, half * 0.25, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.65, "rgba(255,255,255,0.85)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralGroundMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function buildProceduralGroundTextures(
  preset: GroundPresetId,
  repeatCount: number
): ProceduralGroundMaps {
  const size = 1024;
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext("2d")!;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext("2d")!;

  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const pIdx = idx * 4;
      const nx = (x / size) * 8;
      const ny = (y / size) * 8;

      let r = 225;
      let g = 223;
      let b = 219;
      let rough = 220;
      let h = 0.5;

      if (preset === "studio") {
        const micro = fbm(nx * 2.5, ny * 2.5, 3);
        const tone = Math.round(234 + (micro - 0.5) * 10);
        r = tone;
        g = tone - 1;
        b = tone - 3;
        rough = 235;
        h = 0.5 + (micro - 0.5) * 0.08;
      } else if (preset === "concrete") {
        const base = fbm(nx * 1.8, ny * 1.8, 4);
        const pore = hash2D(x, y) > 0.96 ? -0.25 : 0;
        const seam = x % 256 < 3 || y % 256 < 3 ? -0.18 : 0;
        const val = Math.max(0, Math.min(1, 0.58 + (base - 0.5) * 0.28 + pore + seam));
        const rgb = Math.round(val * 215);
        r = rgb + 4;
        g = rgb + 3;
        b = rgb;
        rough = Math.round(165 + (1 - base) * 65 + (seam < 0 ? 35 : 0));
        h = val;
      } else if (preset === "grass") {
        const macro = fbm(nx * 1.4, ny * 1.4, 4);
        const blade = valueNoise(x * 0.25, y * 0.25);
        const mix = macro * 0.65 + blade * 0.35;
        r = Math.round(62 + mix * 48);
        g = Math.round(98 + mix * 58);
        b = Math.round(38 + mix * 28);
        rough = Math.round(220 + (1 - blade) * 30);
        h = mix;
      } else if (preset === "wood") {
        const plankW = 128;
        const plankIdx = Math.floor(x / plankW);
        const inPlankX = x % plankW;
        const jointY = (y + plankIdx * 340) % 512;
        const isGap = inPlankX < 3 || jointY < 3;
        const grain = fbm(nx * 6 + plankIdx * 3.1, ny * 0.45, 4);
        const toneOffset = ((plankIdx * 19) % 24) - 12;
        if (isGap) {
          r = 42;
          g = 28;
          b = 18;
          rough = 240;
          h = 0.1;
        } else {
          r = Math.max(40, Math.min(220, Math.round(138 + grain * 44 + toneOffset)));
          g = Math.max(30, Math.min(180, Math.round(88 + grain * 32 + toneOffset * 0.7)));
          b = Math.max(20, Math.min(140, Math.round(52 + grain * 20 + toneOffset * 0.4)));
          rough = Math.round(105 + (1 - grain) * 55);
          h = 0.45 + grain * 0.4;
        }
      } else if (preset === "basalt") {
        const cell = fbm(nx * 3.2, ny * 3.2, 4);
        const speckle = hash2D(x * 1.3, y * 1.3);
        const val = Math.max(0, Math.min(1, 0.34 + cell * 0.26 + (speckle - 0.5) * 0.14));
        const rgb = Math.round(val * 175);
        r = rgb + 3;
        g = rgb + 2;
        b = rgb + 5;
        rough = Math.round(185 + (1 - cell) * 55);
        h = val;
      }

      aImg.data[pIdx] = r;
      aImg.data[pIdx + 1] = g;
      aImg.data[pIdx + 2] = b;
      aImg.data[pIdx + 3] = 255;

      rImg.data[pIdx] = rough;
      rImg.data[pIdx + 1] = rough;
      rImg.data[pIdx + 2] = rough;
      rImg.data[pIdx + 3] = 255;

      height[idx] = h;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatCount, repeatCount);
  map.anisotropy = 8;
  map.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeatCount, repeatCount);
  roughnessMap.anisotropy = 8;
  roughnessMap.needsUpdate = true;

  const normalStrength = preset === "studio" ? 0.6 : preset === "basalt" ? 4.2 : 2.8;
  const normalMap = buildNormalFromHeight(height, size, normalStrength);
  normalMap.repeat.set(repeatCount, repeatCount);

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}
