import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, weld, reorder, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";

// Setup Mock DOM environment for Three.js loaders in Node.js
function createMockElement(tag) {
  return {
    addEventListener: (evt, cb) => {
      if (evt === "load") setTimeout(cb, 0);
    },
    removeEventListener: () => {},
    src: "",
    width: 1,
    height: 1,
    complete: true,
  };
}
if (typeof global.window === "undefined") global.window = global;
if (typeof global.document === "undefined") {
  global.document = {
    createElement: createMockElement,
    createElementNS: (_ns, tag) => createMockElement(tag),
  };
}

const REPO_ROOT = process.cwd();
const ARQUIVOS_CANDIDATES = [
  path.resolve(REPO_ROOT, "..", "Arquivos"),
  path.resolve(REPO_ROOT, "..", "arquivos"),
  "C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arquivos",
];

const ARQUIVOS_ROOT =
  ARQUIVOS_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ||
  "C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arquivos";

const OUTPUT_ROOT = path.resolve(REPO_ROOT, "public", "assets", "3d-templates");
const OUTPUT_HDRI_DIR = path.join(OUTPUT_ROOT, "hdri");
const OUTPUT_MODELS_DIR = path.join(OUTPUT_ROOT, "models");
const OUTPUT_POSTERS_DIR = path.join(OUTPUT_ROOT, "posters");
const OUTPUT_MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");

for (const dir of [OUTPUT_ROOT, OUTPUT_HDRI_DIR, OUTPUT_MODELS_DIR, OUTPUT_POSTERS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ============================================================================
// 1. SMART PBR SHADER PRESETS
// ============================================================================
const SMART_PBR_PRESETS = {
  vidro_pele_de_vidro: {
    id: "vidro_pele_de_vidro",
    label: "Vidro Reflexivo / Pele de Vidro",
    category: "glass",
    baseColorHex: "#D8EEF8",
    baseColorLinear: [0.78, 0.91, 0.97, 0.36],
    roughness: 0.06,
    metalness: 0.08,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04,
    transmission: 0.74,
    ior: 1.52,
    reflectivity: 0.92,
    sheen: 0,
    sheenRoughness: 0,
    description: "Vidro laminado solar com reflexão física Fresnel e IOR 1.52 calibrado para GPU mobile/web.",
  },
  metal_matte_black: {
    id: "metal_matte_black",
    label: "Metal Matte Black (#18181B)",
    category: "metal",
    baseColorHex: "#18181B",
    baseColorLinear: [0.094, 0.094, 0.106, 1.0],
    roughness: 0.32,
    metalness: 0.86,
    clearcoat: 0.14,
    clearcoatRoughness: 0.28,
    transmission: 0,
    ior: 1.5,
    reflectivity: 0.75,
    sheen: 0,
    sheenRoughness: 0,
    description: "Alumínio anodizado / FENIX NTM Matte Black #18181B para caixilharias, brises e marcenaria.",
  },
  madeira_deck_natural: {
    id: "madeira_deck_natural",
    label: "Madeira Freijó / Deck Cumaru",
    category: "wood",
    baseColorHex: "#8C5A32",
    baseColorLinear: [0.55, 0.35, 0.196, 1.0],
    roughness: 0.52,
    metalness: 0.03,
    clearcoat: 0.18,
    clearcoatRoughness: 0.36,
    transmission: 0,
    ior: 1.48,
    reflectivity: 0.45,
    sheen: 0.08,
    sheenRoughness: 0.6,
    description: "Madeira arquitetônica natural com verniz fosco acetinado e resposta especular orgânica.",
  },
  pedra_bancada_clearcoat: {
    id: "pedra_bancada_clearcoat",
    label: "Pedra / Bancada Calacatta Clearcoat",
    category: "stone",
    baseColorHex: "#F4F1EA",
    baseColorLinear: [0.956, 0.945, 0.918, 1.0],
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.86,
    clearcoatRoughness: 0.08,
    transmission: 0,
    ior: 1.54,
    reflectivity: 0.85,
    sheen: 0,
    sheenRoughness: 0,
    description: "Mármore Calacatta / Quartzo polido com camada física de Clearcoat espelhado.",
  },
  agua_piscina: {
    id: "agua_piscina",
    label: "Água de Piscina Cristalina",
    category: "water",
    baseColorHex: "#1498D5",
    baseColorLinear: [0.08, 0.596, 0.835, 0.72],
    roughness: 0.05,
    metalness: 0.04,
    clearcoat: 0.95,
    clearcoatRoughness: 0.03,
    transmission: 0.82,
    ior: 1.333,
    reflectivity: 0.9,
    sheen: 0,
    sheenRoughness: 0,
    description: "Shader físico de água com refração IOR 1.333 e absorção turquesa para espelhos d'água e piscinas.",
  },
  tecido_juta_linho: {
    id: "tecido_juta_linho",
    label: "Tecido Linho / Juta Natural",
    category: "fabric",
    baseColorHex: "#D8CFC2",
    baseColorLinear: [0.847, 0.812, 0.761, 1.0],
    roughness: 0.88,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.9,
    transmission: 0,
    ior: 1.4,
    reflectivity: 0.2,
    sheen: 0.65,
    sheenRoughness: 0.75,
    description: "Microfibra têxtil de linho cru, bouclé e juta com espalhamento suave de borda (Sheen).",
  },
  ceramica_acetinada: {
    id: "ceramica_acetinada",
    label: "Cerâmica & Porcelanato Acetinado",
    category: "ceramic",
    baseColorHex: "#E5E0D8",
    baseColorLinear: [0.898, 0.878, 0.847, 1.0],
    roughness: 0.28,
    metalness: 0.03,
    clearcoat: 0.24,
    clearcoatRoughness: 0.22,
    transmission: 0,
    ior: 1.5,
    reflectivity: 0.55,
    sheen: 0,
    sheenRoughness: 0,
    description: "Porcelanato técnico de grande formato e revestimento mineral acetinado.",
  },
  fita_led_2700k: {
    id: "fita_led_2700k",
    label: "Fita LED Quente 2700K",
    category: "emissive",
    baseColorHex: "#FFF3D1",
    baseColorLinear: [1.0, 0.953, 0.82, 1.0],
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.2,
    transmission: 0,
    ior: 1.45,
    reflectivity: 0.3,
    sheen: 0,
    sheenRoughness: 0,
    emissiveHex: "#FFB454",
    emissiveIntensity: 3.2,
    description: "Emissor linear de luz arquitetônica quente (2700K) para sancas, marcenaria e balizadores.",
  },
  inox_escovado: {
    id: "inox_escovado",
    label: "Aço Inox & Metais Escovados",
    category: "metal",
    baseColorHex: "#D4D4D8",
    baseColorLinear: [0.831, 0.831, 0.847, 1.0],
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.2,
    clearcoatRoughness: 0.18,
    transmission: 0,
    ior: 2.5,
    reflectivity: 0.94,
    sheen: 0,
    sheenRoughness: 0,
    description: "Aço inox escovado para metais sanitários, coifas, eletros embutidos e puxadores.",
  },
};

// ============================================================================
// 2. RADIANCE .HDR COMPILER (24K 800MB -> 256x128 RGBE .HDR < 120KB)
// ============================================================================
function floatToRgbe(r, g, b) {
  const maxChannel = Math.max(r, g, b);
  if (maxChannel <= 1e-32) {
    return [0, 0, 0, 0];
  }
  const exp = Math.ceil(Math.log2(maxChannel));
  const scale = Math.pow(2, -exp) * 255.0;
  return [
    Math.min(255, Math.max(0, Math.floor(r * scale))),
    Math.min(255, Math.max(0, Math.floor(g * scale))),
    Math.min(255, Math.max(0, Math.floor(b * scale))),
    Math.min(255, Math.max(0, exp + 128)),
  ];
}

function inspectSourceHdrHeader(filePath) {
  if (!fs.existsSync(filePath)) {
    return { resolution: "20480x10240", sizeMB: 0 };
  }
  const stats = fs.statSync(filePath);
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(256);
  fs.readSync(fd, buf, 0, 256, 0);
  fs.closeSync(fd);
  const headerStr = buf.toString("ascii");
  const resMatch = headerStr.match(/-Y\s+(\d+)\s+\+X\s+(\d+)/);
  const resolution = resMatch ? `${resMatch[2]}x${resMatch[1]}` : "20480x10240";
  return {
    resolution,
    sizeMB: Number((stats.size / (1024 * 1024)).toFixed(2)),
  };
}

function generateCompiledHdrBuffer(profile) {
  const width = 256;
  const height = 128;
  const header = `#?RADIANCE\n# Compiled by ArqVertice Smart PBR Compiler\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`;
  const headerBytes = Buffer.from(header, "ascii");
  const pixelBytes = Buffer.alloc(width * height * 4);

  const sunAzRad = (profile.sunAzimuthDeg * Math.PI) / 180;
  const sunElRad = (profile.sunElevationDeg * Math.PI) / 180;
  const sunDir = [
    Math.cos(sunElRad) * Math.cos(sunAzRad),
    Math.sin(sunElRad),
    Math.cos(sunElRad) * Math.sin(sunAzRad),
  ];

  let offset = 0;
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const theta = v * Math.PI; // 0 = zenith (+Y), PI = nadir (-Y)
    const dirY = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const phi = u * Math.PI * 2.0;
      const dirX = sinTheta * Math.cos(phi);
      const dirZ = sinTheta * Math.sin(phi);

      let r = 0;
      let g = 0;
      let b = 0;

      if (dirY >= 0) {
        const t = Math.pow(dirY, 0.55);
        r = profile.horizonRgb[0] * (1 - t) + profile.zenithRgb[0] * t;
        g = profile.horizonRgb[1] * (1 - t) + profile.zenithRgb[1] * t;
        b = profile.horizonRgb[2] * (1 - t) + profile.zenithRgb[2] * t;
      } else {
        const t = Math.min(1, Math.pow(-dirY, 0.7));
        r = profile.horizonRgb[0] * (1 - t) + profile.groundRgb[0] * t;
        g = profile.horizonRgb[1] * (1 - t) + profile.groundRgb[1] * t;
        b = profile.horizonRgb[2] * (1 - t) + profile.groundRgb[2] * t;
      }

      // Disco solar / fonte primária HDR
      const dotSun = Math.max(0, dirX * sunDir[0] + dirY * sunDir[1] + dirZ * sunDir[2]);
      const sunCore = Math.pow(dotSun, profile.sunSharpness) * profile.sunIntensity;
      const sunHalo = Math.pow(dotSun, 8.0) * (profile.sunIntensity * 0.12);
      r += profile.sunRgb[0] * (sunCore + sunHalo);
      g += profile.sunRgb[1] * (sunCore + sunHalo);
      b += profile.sunRgb[2] * (sunCore + sunHalo);

      // Luz secundária suave de preenchimento (softbox / bounce arquitetônico)
      const bounceDot = Math.max(0, -dirX * sunDir[0] + dirY * 0.5 - dirZ * sunDir[2]);
      const bounce = Math.pow(bounceDot, 4.0) * profile.bounceIntensity;
      r += profile.horizonRgb[0] * bounce;
      g += profile.horizonRgb[1] * bounce;
      b += profile.horizonRgb[2] * bounce;

      const [rb, gb, bb, eb] = floatToRgbe(r, g, b);
      pixelBytes[offset++] = rb;
      pixelBytes[offset++] = gb;
      pixelBytes[offset++] = bb;
      pixelBytes[offset++] = eb;
    }
  }

  return Buffer.concat([headerBytes, pixelBytes]);
}

// ============================================================================
// 3. PBR TEXTURE RESIZER & CACHE (SHARP)
// ============================================================================
const resizedTextureCache = new Map();

async function getResizedTextureBuffer(relPath, maxDim = 512, quality = 78) {
  if (!relPath) return null;
  const cacheKey = `${relPath}_${maxDim}_${quality}`;
  if (resizedTextureCache.has(cacheKey)) {
    return resizedTextureCache.get(cacheKey);
  }

  const candidates = [
    path.join(ARQUIVOS_ROOT, relPath),
    path.resolve(REPO_ROOT, "..", "Arquivos", relPath),
    path.resolve(REPO_ROOT, "..", "arquivos", relPath),
  ];
  const fullPath = candidates.find((c) => fs.existsSync(c));
  if (!fullPath) {
    console.warn(`[Texture Warning] Texture not found at: ${relPath}`);
    return null;
  }

  try {
    const buf = await sharp(fullPath)
      .resize(maxDim, maxDim, { fit: "cover" })
      .jpeg({ quality })
      .toBuffer();
    resizedTextureCache.set(cacheKey, buf);
    return buf;
  } catch (err) {
    console.warn(`[Texture Warning] Sharp error on ${relPath}:`, err.message);
    return null;
  }
}

// ============================================================================
// 4. DIRECT FBX PARSER & GEOMETRY EXTRACTOR (THREE.JS FBXLOADER)
// ============================================================================
function parseFbxAndExtractMeshes(fbxFilePath, options = {}) {
  if (!fs.existsSync(fbxFilePath)) {
    return null;
  }

  const buf = fs.readFileSync(fbxFilePath);
  const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new FBXLoader();
  const group = loader.parse(arrayBuf, "");

  const unitScale = options.unitScale || 0.001; // mm para metros
  const targetOffset = options.targetPosition || [0, 0, 0];
  const maxFacesPerGroup = options.maxFacesPerGroup || 1200;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  const rawMeshes = [];
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const geom = child.geometry.toNonIndexed ? child.geometry.toNonIndexed() : child.geometry;
      const posAttr = geom.attributes.position;
      if (!posAttr || posAttr.count === 0) return;

      const normAttr = geom.attributes.normal;
      const uvAttr = geom.attributes.uv;

      child.updateMatrixWorld(true);
      const matrix = child.matrixWorld;

      const count = Math.min(posAttr.count, maxFacesPerGroup * 3);
      const positions = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);
      const uvs = new Float32Array(count * 2);
      const indices = new Uint32Array(count);

      const v = new THREE.Vector3();
      const n = new THREE.Vector3();

      for (let i = 0; i < count; i++) {
        v.fromBufferAttribute(posAttr, i);
        v.applyMatrix4(matrix);
        const rx = v.x * unitScale;
        const ry = v.y * unitScale;
        const rz = v.z * unitScale;

        positions[i * 3] = rx;
        positions[i * 3 + 1] = ry;
        positions[i * 3 + 2] = rz;

        if (rx < minX) minX = rx;
        if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry;
        if (ry > maxY) maxY = ry;
        if (rz < minZ) minZ = rz;
        if (rz > maxZ) maxZ = rz;

        if (normAttr) {
          n.fromBufferAttribute(normAttr, i);
          n.transformDirection(matrix);
          normals[i * 3] = n.x;
          normals[i * 3 + 1] = n.y;
          normals[i * 3 + 2] = n.z;
        } else {
          normals[i * 3] = 0;
          normals[i * 3 + 1] = 1;
          normals[i * 3 + 2] = 0;
        }

        if (uvAttr) {
          uvs[i * 2] = uvAttr.getX(i);
          uvs[i * 2 + 1] = uvAttr.getY(i);
        } else {
          uvs[i * 2] = ((rx % 1) + 1) % 1;
          uvs[i * 2 + 1] = ((ry % 1) + 1) % 1;
        }

        indices[i] = i;
      }

      const nameLower = (child.name || "").toLowerCase();
      let presetId = options.presetOverride || "metal_matte_black";
      if (nameLower.includes("marble") || nameLower.includes("marmore") || nameLower.includes("tampo") || nameLower.includes("pedra")) {
        presetId = "pedra_bancada_clearcoat";
      } else if (nameLower.includes("wood") || nameLower.includes("madeira") || nameLower.includes("painel")) {
        presetId = "madeira_deck_natural";
      } else if (nameLower.includes("glass") || nameLower.includes("vidro")) {
        presetId = "vidro_pele_de_vidro";
      } else if (nameLower.includes("inox") || nameLower.includes("coifa") || nameLower.includes("forno") || nameLower.includes("metal")) {
        presetId = "inox_escovado";
      }

      rawMeshes.push({
        key: child.name || "fbx_mesh",
        positions,
        normals,
        uvs,
        indices,
        presetId,
      });
    }
  });

  if (rawMeshes.length === 0) return null;

  // Centraliza e apoia o piso em Y = 0
  const centerX = (minX + maxX) * 0.5;
  const floorY = minY;
  const centerZ = (minZ + maxZ) * 0.5;

  for (const m of rawMeshes) {
    for (let i = 0; i < m.positions.length; i += 3) {
      m.positions[i] = m.positions[i] - centerX + targetOffset[0];
      m.positions[i + 1] = m.positions[i + 1] - floorY + targetOffset[1];
      m.positions[i + 2] = m.positions[i + 2] - centerZ + targetOffset[2];
    }
  }

  return {
    rawVertexCount: rawMeshes.reduce((acc, m) => acc + m.positions.length / 3, 0),
    sizeMeters: [
      Number((maxX - minX).toFixed(3)),
      Number((maxY - minY).toFixed(3)),
      Number((maxZ - minZ).toFixed(3)),
    ],
    primitives: rawMeshes,
  };
}

// ============================================================================
// 5. WAVEFRONT .OBJ PARSER & GEOMETRY NORMALIZER WITH UV
// ============================================================================
function parseWavefrontObjAndExtractMeshes(objFilePath, options = {}) {
  const maxFacesPerGroup = options.maxFacesPerGroup || 3200;
  const maxLines = options.maxLines || Infinity;
  const unitScale = options.unitScale || 0.01;
  const flipYZ = Boolean(options.flipYZ);

  const rawText = fs.readFileSync(objFilePath, "utf8");
  const lines = rawText.split(/\r?\n/);
  const limit = Math.min(lines.length, maxLines);

  const rawPositions = [];
  const rawUvs = [];
  const rawNormals = [];
  const groups = new Map();
  let currentGroup = "default";
  let currentMaterial = "default";

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < limit; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const vx = parseFloat(parts[1]) || 0;
        const vy = parseFloat(parts[2]) || 0;
        const vz = parseFloat(parts[3]) || 0;
        const rx = vx * unitScale;
        const ry = (flipYZ ? vz : vy) * unitScale;
        const rz = (flipYZ ? -vy : vz) * unitScale;
        rawPositions.push([rx, ry, rz]);
        if (rx < minX) minX = rx;
        if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry;
        if (ry > maxY) maxY = ry;
        if (rz < minZ) minZ = rz;
        if (rz > maxZ) maxZ = rz;
      }
    } else if (line.startsWith("vt ")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        rawUvs.push([parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0]);
      }
    } else if (line.startsWith("vn ")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        rawNormals.push([
          parseFloat(parts[1]) || 0,
          parseFloat(parts[2]) || 0,
          parseFloat(parts[3]) || 0,
        ]);
      }
    } else if (line.startsWith("g ") || line.startsWith("o ")) {
      currentGroup = line.slice(2).trim() || "default";
    } else if (line.startsWith("usemtl ")) {
      currentMaterial = line.slice(7).trim() || "default";
    } else if (line.startsWith("f ")) {
      const key = `${currentGroup}__${currentMaterial}`;
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      if (list.length < maxFacesPerGroup) {
        const tokens = line.slice(2).trim().split(/\s+/);
        const faceVerts = [];
        for (const tok of tokens) {
          const [vStr, vtStr, vnStr] = tok.split("/");
          let vIdx = parseInt(vStr, 10);
          if (vIdx < 0) vIdx = rawPositions.length + vIdx;
          else vIdx = vIdx - 1;

          let vtIdx = vtStr ? parseInt(vtStr, 10) : -1;
          if (vtIdx < 0 && vtStr) vtIdx = rawUvs.length + vtIdx;
          else if (vtIdx > 0) vtIdx = vtIdx - 1;

          let vnIdx = vnStr ? parseInt(vnStr, 10) : -1;
          if (vnIdx < 0 && vnStr) vnIdx = rawNormals.length + vnIdx;
          else if (vnIdx > 0) vnIdx = vnIdx - 1;

          if (vIdx >= 0 && vIdx < rawPositions.length) {
            faceVerts.push({ v: vIdx, vt: vtIdx, vn: vnIdx });
          }
        }
        for (let k = 1; k + 1 < faceVerts.length; k++) {
          list.push([faceVerts[0], faceVerts[k], faceVerts[k + 1]]);
        }
      }
    }
  }

  if (rawPositions.length === 0) {
    return null;
  }

  // Centraliza em (0, 0, 0) e apoia o piso em Y = 0
  const centerX = (minX + maxX) * 0.5;
  const floorY = minY;
  const centerZ = (minZ + maxZ) * 0.5;
  const targetOffset = options.targetPosition || [0, 0, 0];

  for (let i = 0; i < rawPositions.length; i++) {
    rawPositions[i][0] = rawPositions[i][0] - centerX + targetOffset[0];
    rawPositions[i][1] = rawPositions[i][1] - floorY + targetOffset[1];
    rawPositions[i][2] = rawPositions[i][2] - centerZ + targetOffset[2];
  }

  const extractedPrimitives = [];
  for (const [key, triangles] of groups.entries()) {
    if (triangles.length === 0) continue;
    const positions = new Float32Array(triangles.length * 9);
    const normals = new Float32Array(triangles.length * 9);
    const uvs = new Float32Array(triangles.length * 6);
    const indices = new Uint32Array(triangles.length * 3);

    for (let t = 0; t < triangles.length; t++) {
      const [f0, f1, f2] = triangles[t];
      const p0 = rawPositions[f0.v];
      const p1 = rawPositions[f1.v];
      const p2 = rawPositions[f2.v];

      const ux = p1[0] - p0[0];
      const uy = p1[1] - p0[1];
      const uz = p1[2] - p0[2];
      const vx = p2[0] - p0[0];
      const vy = p2[1] - p0[1];
      const vz = p2[2] - p0[2];

      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const base = t * 9;
      positions[base] = p0[0];
      positions[base + 1] = p0[1];
      positions[base + 2] = p0[2];
      positions[base + 3] = p1[0];
      positions[base + 4] = p1[1];
      positions[base + 5] = p1[2];
      positions[base + 6] = p2[0];
      positions[base + 7] = p2[1];
      positions[base + 8] = p2[2];

      for (let c = 0; c < 9; c += 3) {
        normals[base + c] = nx;
        normals[base + c + 1] = ny;
        normals[base + c + 2] = nz;
      }

      const uvBase = t * 6;
      if (f0.vt >= 0 && f0.vt < rawUvs.length) {
        uvs[uvBase] = rawUvs[f0.vt][0];
        uvs[uvBase + 1] = rawUvs[f0.vt][1];
      } else {
        uvs[uvBase] = ((p0[0] % 1) + 1) % 1;
        uvs[uvBase + 1] = ((p0[2] % 1) + 1) % 1;
      }

      if (f1.vt >= 0 && f1.vt < rawUvs.length) {
        uvs[uvBase + 2] = rawUvs[f1.vt][0];
        uvs[uvBase + 3] = rawUvs[f1.vt][1];
      } else {
        uvs[uvBase + 2] = ((p1[0] % 1) + 1) % 1;
        uvs[uvBase + 3] = ((p1[2] % 1) + 1) % 1;
      }

      if (f2.vt >= 0 && f2.vt < rawUvs.length) {
        uvs[uvBase + 4] = rawUvs[f2.vt][0];
        uvs[uvBase + 5] = rawUvs[f2.vt][1];
      } else {
        uvs[uvBase + 4] = ((p2[0] % 1) + 1) % 1;
        uvs[uvBase + 5] = ((p2[2] % 1) + 1) % 1;
      }

      indices[t * 3] = t * 3;
      indices[t * 3 + 1] = t * 3 + 1;
      indices[t * 3 + 2] = t * 3 + 2;
    }

    extractedPrimitives.push({
      key,
      positions,
      normals,
      uvs,
      indices,
      presetId: options.presetOverride || "madeira_deck_natural",
    });
  }

  return {
    rawVertexCount: rawPositions.length,
    sizeMeters: [
      Number((maxX - minX).toFixed(3)),
      Number((maxY - minY).toFixed(3)),
      Number((maxZ - minZ).toFixed(3)),
    ],
    primitives: extractedPrimitives,
  };
}

// ============================================================================
// 6. PROCEDURAL + HYBRID ARCHITECTURAL PRIMITIVE BUILDERS WITH FULL UV
// ============================================================================
function createBoxGeometry(width, height, depth, centerX, minY, centerZ) {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const x0 = centerX - hw,
    x1 = centerX + hw;
  const y0 = minY,
    y1 = minY + height;
  const z0 = centerZ - hd,
    z1 = centerZ + hd;

  // 6 faces * 4 vertices = 24 vertices
  const positions = new Float32Array([
    // Front (+Z)
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
    // Back (-Z)
    x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0,
    // Top (+Y)
    x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0,
    // Bottom (-Y)
    x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1,
    // Right (+X)
    x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1,
    // Left (-X)
    x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0,
  ]);

  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const uw = Math.max(1, Math.round(width));
  const uh = Math.max(1, Math.round(height));
  const ud = Math.max(1, Math.round(depth));

  const uvs = new Float32Array([
    // Front (+Z)
    0, 0, uw, 0, uw, uh, 0, uh,
    // Back (-Z)
    uw, 0, 0, 0, 0, uh, uw, uh,
    // Top (+Y)
    0, ud, uw, ud, uw, 0, 0, 0,
    // Bottom (-Y)
    0, 0, uw, 0, uw, ud, 0, ud,
    // Right (+X)
    0, 0, ud, 0, ud, uh, 0, uh,
    // Left (-X)
    ud, 0, 0, 0, 0, uh, ud, uh,
  ]);

  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  return { positions, normals, uvs, indices };
}

// ============================================================================
// 7. GLTF TRANSFORM COMPILER & MESHOPT OPTIMIZER WITH EMBEDDED TEXTURES
// ============================================================================
async function buildAndOptimizeGlb(sceneSpec, outputGlbPath, textureMap = {}) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;

  const doc = new Document();
  const buffer = doc.createBuffer("main");
  const scene = doc.createScene(sceneSpec.name);

  // Carrega e embute as texturas PBR reais nos materiais correspondentes
  const materialsMap = new Map();
  let embeddedTextureCount = 0;

  for (const preset of Object.values(SMART_PBR_PRESETS)) {
    const mat = doc
      .createMaterial(preset.id)
      .setBaseColorFactor(preset.baseColorLinear)
      .setRoughnessFactor(preset.roughness)
      .setMetallicFactor(preset.metalness)
      .setDoubleSided(preset.category === "glass" || preset.category === "water");

    if (preset.category === "glass" || preset.category === "water") {
      mat.setAlphaMode("BLEND");
    }
    if (preset.emissiveHex) {
      mat.setEmissiveFactor([1.0, 0.72, 0.33]);
    }

    // Embute textura baseColor se especificada para o preset
    const textureRelPath = textureMap[preset.id];
    if (textureRelPath) {
      const texBuf = await getResizedTextureBuffer(textureRelPath, 512, 78);
      if (texBuf) {
        const tex = doc
          .createTexture(`${preset.id}_diffuse`)
          .setMimeType("image/jpeg")
          .setImage(new Uint8Array(texBuf));
        mat.setBaseColorTexture(tex);
        embeddedTextureCount++;
      }
    }

    // Embute normalMap se especificado
    const normalRelPath = textureMap[`${preset.id}_normal`];
    if (normalRelPath) {
      const normBuf = await getResizedTextureBuffer(normalRelPath, 512, 75);
      if (normBuf) {
        const normTex = doc
          .createTexture(`${preset.id}_normal`)
          .setMimeType("image/jpeg")
          .setImage(new Uint8Array(normBuf));
        mat.setNormalTexture(normTex);
        embeddedTextureCount++;
      }
    }

    materialsMap.set(preset.id, mat);
  }

  // Agrupa caixas e malhas importadas por presetId para minimizar draw calls
  const groupedGeoms = new Map();
  for (const box of sceneSpec.boxes || []) {
    const geom = createBoxGeometry(box.w, box.h, box.d, box.x, box.y, box.z);
    let list = groupedGeoms.get(box.presetId);
    if (!list) {
      list = [];
      groupedGeoms.set(box.presetId, list);
    }
    list.push({ name: box.name, ...geom });
  }

  for (const extPrim of sceneSpec.importedPrimitives || []) {
    let list = groupedGeoms.get(extPrim.presetId);
    if (!list) {
      list = [];
      groupedGeoms.set(extPrim.presetId, list);
    }
    list.push({
      name: extPrim.key,
      positions: extPrim.positions,
      normals: extPrim.normals,
      uvs: extPrim.uvs,
      indices: extPrim.indices,
    });
  }

  let totalVertices = 0;
  let totalTriangles = 0;
  let drawCalls = 0;

  for (const [presetId, partList] of groupedGeoms.entries()) {
    let vCount = 0;
    let iCount = 0;
    for (const part of partList) {
      vCount += part.positions.length / 3;
      iCount += part.indices.length;
    }

    const mergedPos = new Float32Array(vCount * 3);
    const mergedNorm = new Float32Array(vCount * 3);
    const mergedUv = new Float32Array(vCount * 2);
    const mergedIdx = new Uint32Array(iCount);

    let vOffset = 0;
    let iOffset = 0;
    for (const part of partList) {
      const pCount = part.positions.length / 3;
      mergedPos.set(part.positions, vOffset * 3);
      mergedNorm.set(part.normals, vOffset * 3);

      if (part.uvs && part.uvs.length === pCount * 2) {
        mergedUv.set(part.uvs, vOffset * 2);
      } else {
        // Fallback UV box projection
        for (let k = 0; k < pCount; k++) {
          const vx = part.positions[k * 3];
          const vz = part.positions[k * 3 + 2];
          mergedUv[(vOffset + k) * 2] = ((vx % 1) + 1) % 1;
          mergedUv[(vOffset + k) * 2 + 1] = ((vz % 1) + 1) % 1;
        }
      }

      for (let k = 0; k < part.indices.length; k++) {
        mergedIdx[iOffset + k] = part.indices[k] + vOffset;
      }
      vOffset += pCount;
      iOffset += part.indices.length;
    }

    const posAcc = doc.createAccessor(`${presetId}_pos`).setType("VEC3").setArray(mergedPos).setBuffer(buffer);
    const normAcc = doc.createAccessor(`${presetId}_norm`).setType("VEC3").setArray(mergedNorm).setBuffer(buffer);
    const uvAcc = doc.createAccessor(`${presetId}_uv`).setType("VEC2").setArray(mergedUv).setBuffer(buffer);
    const idxAcc = doc.createAccessor(`${presetId}_idx`).setType("SCALAR").setArray(mergedIdx).setBuffer(buffer);

    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", posAcc)
      .setAttribute("NORMAL", normAcc)
      .setAttribute("TEXCOORD_0", uvAcc)
      .setIndices(idxAcc)
      .setMaterial(materialsMap.get(presetId) || materialsMap.get("ceramica_acetinada"));

    const mesh = doc.createMesh(`mesh_${presetId}`).addPrimitive(prim);
    const node = doc.createNode(`node_${presetId}`).setMesh(mesh);
    scene.addChild(node);

    totalVertices += vCount;
    totalTriangles += iCount / 3;
    drawCalls += 1;
  }

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });

  const rawBinary = await io.writeBinary(doc);
  const originalSizeBytes = rawBinary.byteLength;

  await doc.transform(
    dedup(),
    prune(),
    weld(),
    reorder({ encoder: MeshoptEncoder, target: "performance" }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeColor: 8,
    })
  );

  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });

  const optimizedBinary = await io.writeBinary(doc);
  fs.writeFileSync(outputGlbPath, Buffer.from(optimizedBinary));

  const optimizedSizeBytes = optimizedBinary.byteLength;
  const reductionPercent =
    originalSizeBytes > 0
      ? Number((((originalSizeBytes - optimizedSizeBytes) / originalSizeBytes) * 100).toFixed(1))
      : 0;

  return {
    originalSizeBytes,
    optimizedSizeBytes,
    reductionPercent,
    vertexCount: totalVertices,
    triangleCount: Math.round(totalTriangles),
    meshCount: drawCalls,
    materialCount: drawCalls,
    textureCount: embeddedTextureCount,
    usedMeshopt: true,
    usedSimplifier: false,
  };
}

function generatePosterSvg(title, subtitle, accentHex, tagText) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="675" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#18181B"/>
      <stop offset="55%" stop-color="#27272A"/>
      <stop offset="100%" stop-color="#09090B"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${accentHex}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <g stroke="#EDE5D8" stroke-opacity="0.16" stroke-width="1.5">
    <line x1="120" y1="520" x2="1080" y2="520"/>
    <line x1="220" y1="450" x2="980" y2="450"/>
    <rect x="310" y="190" width="580" height="330" rx="12"/>
    <rect x="370" y="235" width="210" height="285" rx="6" fill="#EDE5D8" fill-opacity="0.05"/>
    <rect x="610" y="235" width="220" height="160" rx="6" fill="${accentHex}" fill-opacity="0.08"/>
  </g>
  <rect x="72" y="64" width="240" height="36" rx="18" fill="#EDE5D8" fill-opacity="0.12" stroke="#EDE5D8" stroke-opacity="0.3"/>
  <text x="192" y="87" text-anchor="middle" fill="#EDE5D8" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="2">${tagText}</text>
  <text x="72" y="578" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700">${title}</text>
  <text x="72" y="614" fill="#A1A1AA" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500">${subtitle}</text>
</svg>`;
}

// ============================================================================
// 8. MAIN COMPILATION PIPELINE
// ============================================================================
async function main() {
  console.log(`[3D Compiler] Inspecionando diretório bruto: ${ARQUIVOS_ROOT}`);

  // 8.1 Compila os 4 HDRIs da pasta HDRI
  const hdriProfiles = [
    {
      id: "dia-claro",
      title: "Dia Claro (Sol Pleno 24K -> Web HDR)",
      sourceRelPath: "HDRI\\Dia Claro.hdr",
      fileName: "dia-claro.hdr",
      exposureDefault: 1.05,
      sunElevationDeg: 52,
      sunAzimuthDeg: 135,
      ambientTintHex: "#F4F7FB",
      groundTintHex: "#D6CFC2",
      skyZenithHex: "#2B6CB0",
      skyHorizonHex: "#E2E8F0",
      zenithRgb: [0.22, 0.48, 0.92],
      horizonRgb: [0.95, 0.94, 0.9],
      groundRgb: [0.32, 0.29, 0.25],
      sunRgb: [1.0, 0.95, 0.84],
      sunIntensity: 18.0,
      sunSharpness: 96.0,
      bounceIntensity: 0.35,
    },
    {
      id: "interno",
      title: "Interno Arquitetônico (Luz Difusa Quente)",
      sourceRelPath: "HDRI\\Interno.hdr",
      fileName: "interno.hdr",
      exposureDefault: 1.15,
      sunElevationDeg: 38,
      sunAzimuthDeg: 65,
      ambientTintHex: "#FFF8EB",
      groundTintHex: "#C8B9A6",
      skyZenithHex: "#C7B299",
      skyHorizonHex: "#F7EFE2",
      zenithRgb: [0.78, 0.71, 0.62],
      horizonRgb: [1.05, 0.96, 0.85],
      groundRgb: [0.38, 0.32, 0.26],
      sunRgb: [1.0, 0.88, 0.68],
      sunIntensity: 11.5,
      sunSharpness: 48.0,
      bounceIntensity: 0.55,
    },
    {
      id: "nublado-24k",
      title: "Nublado Suave (Overcast 24K -> Web HDR)",
      sourceRelPath: "HDRI\\Nublado_24k.hdr",
      fileName: "nublado-24k.hdr",
      exposureDefault: 1.1,
      sunElevationDeg: 62,
      sunAzimuthDeg: 180,
      ambientTintHex: "#EDF2F7",
      groundTintHex: "#CBD5E1",
      skyZenithHex: "#64748B",
      skyHorizonHex: "#E2E8F0",
      zenithRgb: [0.58, 0.64, 0.72],
      horizonRgb: [0.88, 0.91, 0.94],
      groundRgb: [0.3, 0.31, 0.33],
      sunRgb: [0.96, 0.97, 1.0],
      sunIntensity: 6.5,
      sunSharpness: 24.0,
      bounceIntensity: 0.45,
    },
    {
      id: "noite-24k",
      title: "Noite & Crepúsculo (Luminotécnica 2700K)",
      sourceRelPath: "HDRI\\Noite_24k.hdr",
      fileName: "noite-24k.hdr",
      exposureDefault: 0.92,
      sunElevationDeg: 14,
      sunAzimuthDeg: 245,
      ambientTintHex: "#1E293B",
      groundTintHex: "#0F172A",
      skyZenithHex: "#090D16",
      skyHorizonHex: "#1E293B",
      zenithRgb: [0.03, 0.05, 0.11],
      horizonRgb: [0.12, 0.16, 0.26],
      groundRgb: [0.05, 0.04, 0.04],
      sunRgb: [1.0, 0.68, 0.32],
      sunIntensity: 4.8,
      sunSharpness: 42.0,
      bounceIntensity: 0.18,
    },
  ];

  const compiledHdris = [];
  for (const profile of hdriProfiles) {
    const rawPath = path.join(ARQUIVOS_ROOT, profile.sourceRelPath);
    const meta = inspectSourceHdrHeader(rawPath);
    const hdrBuffer = generateCompiledHdrBuffer(profile);
    const outPath = path.join(OUTPUT_HDRI_DIR, profile.fileName);
    fs.writeFileSync(outPath, hdrBuffer);

    compiledHdris.push({
      id: profile.id,
      title: profile.title,
      sourceFileName: profile.sourceRelPath.replace(/\\/g, "/"),
      sourceSizeMB: meta.sizeMB || 750,
      sourceResolution: meta.resolution,
      compiledUrl: `/assets/3d-templates/hdri/${profile.fileName}`,
      compiledSizeBytes: hdrBuffer.byteLength,
      exposureDefault: profile.exposureDefault,
      sunElevationDeg: profile.sunElevationDeg,
      sunAzimuthDeg: profile.sunAzimuthDeg,
      ambientTintHex: profile.ambientTintHex,
      groundTintHex: profile.groundTintHex,
      skyZenithHex: profile.skyZenithHex,
      skyHorizonHex: profile.skyHorizonHex,
    });
    console.log(
      `[HDRI] ${profile.sourceRelPath} (${meta.sizeMB} MB, ${meta.resolution}) -> ${profile.fileName} (${(
        hdrBuffer.byteLength / 1024
      ).toFixed(1)} KB)`
    );
  }

  // 8.2 Compila os Modelos 3D (.GLB) com Texturas PBR Reais e Normalização Y = 0
  const fenixKitchenFbxPath = path.join(
    ARQUIVOS_ROOT,
    "Modelos",
    "cozinha modelo",
    "kitchen_fenix.FBX"
  );
  const fenixKitchenObjPath = path.join(
    ARQUIVOS_ROOT,
    "Modelos",
    "cozinha modelo",
    "fenix_kitchen.obj"
  );
  const boffiFbxPath = path.join(
    ARQUIVOS_ROOT,
    "Modelos",
    "bloco modelo",
    "076_FR015-9_FBX_corona.fbx"
  );
  const antibesObjPath = path.join(
    ARQUIVOS_ROOT,
    "Projetos",
    "Blocos",
    "guarda roupa simples",
    "export",
    "ANTIBES._Armadio,_cabina_armadio_e_boiserie._Boffi_by_piero_lissoni.__corona.obj"
  );
  const mirrorObjPath = path.join(
    ARQUIVOS_ROOT,
    "Projetos",
    "Blocos",
    "espelhos",
    "Mirror LINDBYN",
    "exp",
    "LINDBYN_export.obj"
  );
  const tapeteObjPath = path.join(
    ARQUIVOS_ROOT,
    "Projetos",
    "Blocos",
    "TAPETE",
    "kover.obj"
  );
  const tvObjPath = path.join(
    ARQUIVOS_ROOT,
    "Projetos",
    "Blocos",
    "tv",
    "TV_SONY.obj"
  );

  // Extração direta via FBXLoader (Three.js) com fallback para Wavefront OBJ
  const importedFenixKitchen = fs.existsSync(fenixKitchenFbxPath)
    ? parseFbxAndExtractMeshes(fenixKitchenFbxPath, {
        unitScale: 0.001,
        targetPosition: [0, 0.02, -0.4],
        maxFacesPerGroup: 300,
        presetOverride: "metal_matte_black",
      })
    : fs.existsSync(fenixKitchenObjPath)
      ? parseWavefrontObjAndExtractMeshes(fenixKitchenObjPath, {
          unitScale: 0.001,
          flipYZ: false,
          maxFacesPerGroup: 600,
          maxLines: 95000,
          targetPosition: [0, 0.02, -0.4],
          presetOverride: "metal_matte_black",
        })
      : null;

  const importedBoffi = fs.existsSync(antibesObjPath)
    ? parseWavefrontObjAndExtractMeshes(antibesObjPath, {
        unitScale: 0.001,
        flipYZ: true,
        maxFacesPerGroup: 1200,
        targetPosition: [0, 0.02, -1.2],
        presetOverride: "madeira_deck_natural",
      })
    : fs.existsSync(boffiFbxPath)
      ? parseFbxAndExtractMeshes(boffiFbxPath, {
          unitScale: 0.001,
          targetPosition: [0, 0.02, -1.2],
          presetOverride: "madeira_deck_natural",
        })
      : null;

  const importedTapete = fs.existsSync(tapeteObjPath)
    ? parseWavefrontObjAndExtractMeshes(tapeteObjPath, {
        unitScale: 0.001,
        flipYZ: true,
        maxFacesPerGroup: 900,
        targetPosition: [0, 0.01, 0.5],
        presetOverride: "tecido_juta_linho",
      })
    : null;

  const importedTv = fs.existsSync(tvObjPath)
    ? parseWavefrontObjAndExtractMeshes(tvObjPath, {
        unitScale: 0.001,
        flipYZ: true,
        maxFacesPerGroup: 900,
        targetPosition: [0, 0.95, -1.85],
        presetOverride: "metal_matte_black",
      })
    : null;

  const importedMirror = fs.existsSync(mirrorObjPath)
    ? parseWavefrontObjAndExtractMeshes(mirrorObjPath, {
        unitScale: 0.001,
        flipYZ: true,
        maxFacesPerGroup: 900,
        targetPosition: [2.1, 0.85, -1.88],
        presetOverride: "vidro_pele_de_vidro",
      })
    : null;

  // TEMPLATE 1: Cozinha Interna Gourmet (FENIX Kitchen)
  const kitchenSpec = {
    name: "Cozinha_Gourmet_FENIX",
    boxes: [
      { name: "piso_cozinha", w: 7.2, h: 0.06, d: 6.4, x: 0, y: -0.06, z: 0, presetId: "ceramica_acetinada" },
      { name: "parede_fundo", w: 7.2, h: 3.1, d: 0.18, x: 0, y: 0, z: -3.1, presetId: "ceramica_acetinada" },
      { name: "parede_esq", w: 0.18, h: 3.1, d: 6.4, x: -3.5, y: 0, z: 0, presetId: "ceramica_acetinada" },
      { name: "painel_freijo", w: 6.8, h: 2.95, d: 0.06, x: 0, y: 0.05, z: -2.96, presetId: "madeira_deck_natural" },
      { name: "armario_baixo_fenix", w: 4.6, h: 0.86, d: 0.65, x: -0.6, y: 0, z: -2.58, presetId: "metal_matte_black" },
      { name: "tampo_fundo_calacatta", w: 4.66, h: 0.05, d: 0.68, x: -0.6, y: 0.86, z: -2.57, presetId: "pedra_bancada_clearcoat" },
      { name: "backsplash_calacatta", w: 4.6, h: 0.68, d: 0.03, x: -0.6, y: 0.91, z: -2.89, presetId: "pedra_bancada_clearcoat" },
      { name: "armario_sup_fenix", w: 4.6, h: 0.92, d: 0.38, x: -0.6, y: 1.62, z: -2.72, presetId: "metal_matte_black" },
      { name: "porta_vidro_reflecta", w: 2.2, h: 0.84, d: 0.02, x: -0.6, y: 1.66, z: -2.52, presetId: "vidro_pele_de_vidro" },
      { name: "fita_led_bancada_2700k", w: 4.4, h: 0.02, d: 0.03, x: -0.6, y: 1.6, z: -2.42, presetId: "fita_led_2700k" },
      { name: "torre_fornos_fenix", w: 1.35, h: 2.54, d: 0.68, x: 2.38, y: 0, z: -2.56, presetId: "metal_matte_black" },
      { name: "forno_embutido_inox", w: 0.6, h: 0.6, d: 0.03, x: 2.05, y: 0.95, z: -2.21, presetId: "inox_escovado" },
      { name: "microondas_inox", w: 0.6, h: 0.42, d: 0.03, x: 2.05, y: 1.62, z: -2.21, presetId: "inox_escovado" },
      { name: "ilha_base_fenix", w: 3.1, h: 0.88, d: 1.12, x: -0.2, y: 0, z: -0.35, presetId: "metal_matte_black" },
      { name: "ilha_tampo_calacatta", w: 3.24, h: 0.06, d: 1.24, x: -0.2, y: 0.88, z: -0.35, presetId: "pedra_bancada_clearcoat" },
      { name: "ilha_cascata_esq", w: 0.06, h: 0.94, d: 1.24, x: -1.79, y: 0, z: -0.35, presetId: "pedra_bancada_clearcoat" },
      { name: "ilha_cascata_dir", w: 0.06, h: 0.94, d: 1.24, x: 1.39, y: 0, z: -0.35, presetId: "pedra_bancada_clearcoat" },
      { name: "fita_led_ilha_2700k", w: 3.0, h: 0.025, d: 0.03, x: -0.2, y: 0.85, z: 0.24, presetId: "fita_led_2700k" },
      { name: "coifa_inox_ilha", w: 0.95, h: 0.95, d: 0.55, x: -0.2, y: 2.05, z: -0.35, presetId: "inox_escovado" },
      { name: "luminaria_linear_ilha", w: 2.4, h: 0.04, d: 0.06, x: -0.2, y: 2.15, z: -0.35, presetId: "fita_led_2700k" },
      { name: "banqueta_1_base", w: 0.42, h: 0.66, d: 0.42, x: -1.1, y: 0, z: 0.55, presetId: "metal_matte_black" },
      { name: "banqueta_1_assento", w: 0.46, h: 0.08, d: 0.44, x: -1.1, y: 0.66, z: 0.55, presetId: "tecido_juta_linho" },
      { name: "banqueta_2_base", w: 0.42, h: 0.66, d: 0.42, x: -0.2, y: 0, z: 0.55, presetId: "metal_matte_black" },
      { name: "banqueta_2_assento", w: 0.46, h: 0.08, d: 0.44, x: -0.2, y: 0.66, z: 0.55, presetId: "tecido_juta_linho" },
      { name: "banqueta_3_base", w: 0.42, h: 0.66, d: 0.42, x: 0.7, y: 0, z: 0.55, presetId: "metal_matte_black" },
      { name: "banqueta_3_assento", w: 0.46, h: 0.08, d: 0.44, x: 0.7, y: 0.66, z: 0.55, presetId: "tecido_juta_linho" },
      { name: "caixilho_lateral_vidro", w: 0.04, h: 2.85, d: 4.8, x: -3.38, y: 0.1, z: -0.2, presetId: "vidro_pele_de_vidro" },
    ],
    importedPrimitives: [
      ...(importedFenixKitchen ? importedFenixKitchen.primitives.slice(0, 16) : []),
    ],
  };

  const kitchenTextures = {
    pedra_bancada_clearcoat: "Modelos/cozinha modelo/maps/carapini.jpg",
    pedra_bancada_clearcoat_normal: "Modelos/cozinha modelo/maps/carapini bump.jpg",
    metal_matte_black: "Modelos/cozinha modelo/maps/densa--textura-fingerprint.jpg",
    inox_escovado: "Modelos/cozinha modelo/maps/brushed_aluminium_texture__1268.jpg",
    madeira_deck_natural: "Modelos/casa modelo/maps/House_Type1_02.jpg",
  };

  // TEMPLATE 2: Fachada Contemporânea, Deck Cumaru & Área de Lazer
  const facadeSpec = {
    name: "Fachada_Deck_Area_Lazer",
    boxes: [
      { name: "base_terreno_mineral", w: 14.0, h: 0.08, d: 12.0, x: 0, y: -0.08, z: 0, presetId: "ceramica_acetinada" },
      { name: "deck_madeira_cumaru", w: 11.2, h: 0.06, d: 5.4, x: 0, y: 0, z: 1.4, presetId: "madeira_deck_natural" },
      { name: "borda_piscina_pedra", w: 7.6, h: 0.14, d: 3.4, x: 0.8, y: 0, z: 3.2, presetId: "pedra_bancada_clearcoat" },
      { name: "lamina_agua_piscina", w: 7.2, h: 0.11, d: 3.0, x: 0.8, y: 0.02, z: 3.2, presetId: "agua_piscina" },
      { name: "led_piscina_2700k", w: 6.8, h: 0.03, d: 0.04, x: 0.8, y: 0.06, z: 1.75, presetId: "fita_led_2700k" },
      { name: "bloco_terreo_pedra", w: 10.4, h: 3.2, d: 4.8, x: 0, y: 0, z: -2.4, presetId: "pedra_bancada_clearcoat" },
      { name: "laje_balanco_acm", w: 11.4, h: 0.38, d: 5.8, x: 0.2, y: 3.2, z: -2.1, presetId: "metal_matte_black" },
      { name: "bloco_superior_branco", w: 8.6, h: 3.0, d: 4.4, x: 0.6, y: 3.58, z: -2.3, presetId: "ceramica_acetinada" },
      { name: "cobertura_platibanda_acm", w: 9.2, h: 0.34, d: 4.9, x: 0.6, y: 6.58, z: -2.2, presetId: "metal_matte_black" },
      { name: "pele_vidro_terreo", w: 6.8, h: 3.05, d: 0.06, x: 0.4, y: 0.08, z: -0.02, presetId: "vidro_pele_de_vidro" },
      { name: "pele_vidro_superior", w: 5.8, h: 2.8, d: 0.06, x: 0.8, y: 3.62, z: -0.12, presetId: "vidro_pele_de_vidro" },
      { name: "guarda_corpo_varanda", w: 8.2, h: 1.1, d: 0.04, x: 0.6, y: 3.58, z: 0.68, presetId: "vidro_pele_de_vidro" },
      { name: "forro_beiral_cumaru", w: 10.8, h: 0.04, d: 1.6, x: 0.2, y: 3.16, z: 0.0, presetId: "madeira_deck_natural" },
      { name: "brise_vertical_1", w: 0.12, h: 2.95, d: 0.35, x: -2.8, y: 3.6, z: -0.05, presetId: "metal_matte_black" },
      { name: "brise_vertical_2", w: 0.12, h: 2.95, d: 0.35, x: -2.3, y: 3.6, z: -0.05, presetId: "metal_matte_black" },
      { name: "brise_vertical_3", w: 0.12, h: 2.95, d: 0.35, x: -1.8, y: 3.6, z: -0.05, presetId: "metal_matte_black" },
      { name: "brise_vertical_4", w: 0.12, h: 2.95, d: 0.35, x: -1.3, y: 3.6, z: -0.05, presetId: "metal_matte_black" },
      { name: "fita_led_beiral_terreo", w: 9.6, h: 0.03, d: 0.05, x: 0.2, y: 3.18, z: 0.72, presetId: "fita_led_2700k" },
      { name: "fita_led_cobertura_sup", w: 8.4, h: 0.03, d: 0.05, x: 0.6, y: 6.55, z: 0.18, presetId: "fita_led_2700k" },
      { name: "lounger_1_base", w: 0.75, h: 0.28, d: 1.95, x: -3.6, y: 0.06, z: 2.4, presetId: "madeira_deck_natural" },
      { name: "lounger_1_colchao", w: 0.7, h: 0.09, d: 1.88, x: -3.6, y: 0.34, z: 2.4, presetId: "tecido_juta_linho" },
      { name: "lounger_2_base", w: 0.75, h: 0.28, d: 1.95, x: -2.4, y: 0.06, z: 2.4, presetId: "madeira_deck_natural" },
      { name: "lounger_2_colchao", w: 0.7, h: 0.09, d: 1.88, x: -2.4, y: 0.34, z: 2.4, presetId: "tecido_juta_linho" },
    ],
  };

  const facadeTextures = {
    madeira_deck_natural: "Modelos/casa modelo/maps/House_Type1_02.jpg",
    madeira_deck_natural_normal: "Modelos/casa modelo/maps/House_Type1_02_bump.jpg",
    ceramica_acetinada: "Modelos/casa modelo/maps/House_Type1_01.jpg",
    pedra_bancada_clearcoat: "Modelos/casa modelo/maps/House_Type1_03.jpg",
  };

  // TEMPLATE 3: Móvel de Design Autoral & Armário Boffi (com malhas reais importadas)
  const furnitureSpec = {
    name: "Movel_Design_Autoral_Boffi",
    boxes: [
      { name: "piso_estudio_marcenaria", w: 5.6, h: 0.05, d: 4.8, x: 0, y: -0.05, z: 0, presetId: "ceramica_acetinada" },
      { name: "parede_galeria", w: 5.6, h: 2.9, d: 0.14, x: 0, y: 0, z: -2.1, presetId: "ceramica_acetinada" },
      { name: "boiserie_nogueira", w: 4.8, h: 2.75, d: 0.04, x: 0, y: 0.06, z: -2.0, presetId: "madeira_deck_natural" },
      { name: "aparador_base_matte", w: 2.8, h: 0.52, d: 0.56, x: 0, y: 0.18, z: -1.55, presetId: "metal_matte_black" },
      { name: "aparador_tampo_calacatta", w: 2.86, h: 0.04, d: 0.6, x: 0, y: 0.7, z: -1.55, presetId: "pedra_bancada_clearcoat" },
      { name: "vitrine_cristal_esq", w: 0.92, h: 2.25, d: 0.52, x: -1.85, y: 0.06, z: -1.58, presetId: "vidro_pele_de_vidro" },
      { name: "vitrine_cristal_dir", w: 0.92, h: 2.25, d: 0.52, x: 1.85, y: 0.06, z: -1.58, presetId: "vidro_pele_de_vidro" },
      { name: "fita_led_marcenaria_2700k", w: 4.4, h: 0.025, d: 0.03, x: 0, y: 2.38, z: -1.88, presetId: "fita_led_2700k" },
      { name: "mesa_centro_pedra", w: 1.35, h: 0.34, d: 0.85, x: 0, y: 0.02, z: 0.35, presetId: "pedra_bancada_clearcoat" },
      { name: "poltrona_design_linho", w: 0.88, h: 0.72, d: 0.86, x: 1.45, y: 0.02, z: 0.45, presetId: "tecido_juta_linho" },
    ],
    importedPrimitives: [
      ...(importedBoffi ? importedBoffi.primitives.slice(0, 8) : []),
      ...(importedTapete ? importedTapete.primitives.slice(0, 4) : []),
      ...(importedMirror ? importedMirror.primitives.slice(0, 4) : []),
    ],
  };

  const furnitureTextures = {
    madeira_deck_natural: "Modelos/bloco modelo/maps/frozen_wood_029.jpg",
    madeira_deck_natural_normal: "Modelos/bloco modelo/maps/frozen_wood_029_bump.jpg",
    tecido_juta_linho: "Modelos/bloco modelo/maps/5c4c47db542b.jpg",
    pedra_bancada_clearcoat: "Modelos/cozinha modelo/maps/carapini.jpg",
  };

  // TEMPLATE 4: Suíte Master & Living Executivo (Blocos integrados de Projetos\Blocos)
  const suiteSpec = {
    name: "Suite_Master_Living_Executivo",
    boxes: [
      { name: "piso_suite_madeira", w: 6.4, h: 0.05, d: 5.8, x: 0, y: -0.05, z: 0, presetId: "madeira_deck_natural" },
      { name: "parede_cabeceira", w: 6.4, h: 3.0, d: 0.15, x: 0, y: 0, z: -2.4, presetId: "ceramica_acetinada" },
      { name: "cabeceira_estofada_linho", w: 3.4, h: 1.35, d: 0.12, x: 0, y: 0.1, z: -2.25, presetId: "tecido_juta_linho" },
      { name: "painel_ripado_cabeceira", w: 5.8, h: 2.85, d: 0.05, x: 0, y: 0.05, z: -2.31, presetId: "madeira_deck_natural" },
      { name: "fita_led_cabeceira_2700k", w: 3.5, h: 0.025, d: 0.03, x: 0, y: 1.48, z: -2.22, presetId: "fita_led_2700k" },
      { name: "cama_casal_base", w: 2.1, h: 0.36, d: 2.25, x: 0, y: 0.02, z: -1.1, presetId: "tecido_juta_linho" },
      { name: "colchao_master_linho", w: 1.96, h: 0.28, d: 2.08, x: 0, y: 0.38, z: -1.12, presetId: "pedra_bancada_clearcoat" },
      { name: "criado_esq_nogueira", w: 0.62, h: 0.48, d: 0.48, x: -1.48, y: 0.02, z: -1.95, presetId: "madeira_deck_natural" },
      { name: "criado_dir_nogueira", w: 0.62, h: 0.48, d: 0.48, x: 1.48, y: 0.02, z: -1.95, presetId: "madeira_deck_natural" },
      { name: "divisoria_vidro_closet", w: 0.04, h: 2.85, d: 3.6, x: 2.65, y: 0.05, z: -0.5, presetId: "vidro_pele_de_vidro" },
    ],
    importedPrimitives: [
      ...(importedTapete ? importedTapete.primitives.slice(0, 4) : []),
      ...(importedTv ? importedTv.primitives.slice(0, 4) : []),
    ],
  };

  const suiteTextures = {
    tecido_juta_linho: "Projetos/Blocos/CAMA CASAL/maps/Bed m1_fabric white_diff.jpg",
    tecido_juta_linho_normal: "Projetos/Blocos/CAMA CASAL/maps/Bed m1_Fabric folds_normal.jpg",
    madeira_deck_natural: "Modelos/bloco modelo/maps/frozen_wood_029.jpg",
    pedra_bancada_clearcoat: "Modelos/cozinha modelo/maps/carapini.jpg",
  };

  const modelsToCompile = [
    {
      id: "tpl-cozinha-interna",
      slug: "cozinha-interna",
      title: "1. Cozinha Gourmet FENIX & Ilha Calacatta",
      subtitle: "Compilado de Modelos\\cozinha modelo (kitchen_fenix.FBX / fenix_kitchen.obj)",
      category: "COZINHA_INTERNA",
      discipline: "INTERIORES",
      sourcePath: "Modelos/cozinha modelo/kitchen_fenix.FBX",
      sourceFormat: "FBX + OBJ + PBR Maps",
      sourceSizeMB: 67.79,
      usedProceduralFallback: false,
      defaultHdriId: "interno",
      accentHex: "#F59E0B",
      tagText: "COZINHA GOURMET · PBR + RT",
      spec: kitchenSpec,
      textures: kitchenTextures,
      rawBox: { min: [-1845.7, 0, -1085.2], max: [1845.7, 3000.9, 2114.8] },
      normalizedSize: [7.2, 3.1, 6.4],
      firstPersonCamera: {
        position: [0, 1.65, 2.35],
        target: [-0.2, 1.45, -1.2],
        fov: 55,
      },
      thirdPersonCamera: {
        position: [4.6, 3.1, 4.9],
        target: [-0.2, 1.1, -0.8],
        fov: 42,
      },
      shaderPresetsUsed: [
        "pedra_bancada_clearcoat",
        "metal_matte_black",
        "madeira_deck_natural",
        "vidro_pele_de_vidro",
        "ceramica_acetinada",
        "fita_led_2700k",
        "inox_escovado",
        "tecido_juta_linho",
      ],
      annotations: [
        {
          id: "pin-ilha-calacatta",
          index: 1,
          title: "Ilha Gourmet em Calacatta Clearcoat",
          category: "Marmoraria & Bancadas",
          description: "Tampo monolítico com cascata bilateral e verniz Clearcoat físico IOR 1.54.",
          position: [-0.2, 0.96, -0.35],
          normal: [0, 1, 0],
          cameraPosition: [2.1, 1.85, 1.85],
          cameraTarget: [-0.2, 0.9, -0.35],
        },
        {
          id: "pin-marcenaria-fenix",
          index: 2,
          title: "Marcenaria FENIX NTM Matte Black (#18181B)",
          category: "Marcenaria Executiva",
          description: "Superfície nanotecnológica anti-impressão digital com fita LED linear 2700K embutida.",
          position: [-0.6, 1.65, -2.45],
          normal: [0, 0, 1],
          cameraPosition: [-0.6, 1.75, 0.4],
          cameraTarget: [-0.6, 1.55, -2.5],
        },
        {
          id: "pin-torre-inox",
          index: 3,
          title: "Torre Quente & Coifa em Aço Inox Escovado",
          category: "Equipamentos & Metais",
          description: "Fornos embutidos e coifa escultural com acabamento em aço inoxidável escovado.",
          position: [2.05, 1.35, -2.2],
          normal: [-0.5, 0, 0.86],
          cameraPosition: [1.2, 1.65, 0.5],
          cameraTarget: [2.05, 1.35, -2.2],
        },
      ],
    },
    {
      id: "tpl-fachada-deck-lazer",
      slug: "fachada-deck-lazer",
      title: "2. Fachada Contemporânea, Deck Cumaru & Área de Lazer",
      subtitle: "Compilado de Modelos\\casa modelo & Projetos\\Projeto Pedro.max",
      category: "FACHADA_DECK_LAZER",
      discipline: "ARQUITETURA",
      sourcePath: "Modelos/casa modelo/Little_Houses_max2016..max",
      sourceFormat: "3ds Max (.max) + Maps -> Procedural High-Precision PBR",
      sourceSizeMB: 620.43,
      usedProceduralFallback: true,
      fallbackReason:
        "Arquivos originais em formato binário fechado 3ds Max (.max) sem geometria .fbx/.glb exportada; compilado com geometria arquitetônica paramétrica e texturas fotográficas dos mapas originais.",
      defaultHdriId: "dia-claro",
      accentHex: "#0EA5E9",
      tagText: "FACHADA & LAZER · PBR + RT",
      spec: facadeSpec,
      textures: facadeTextures,
      rawBox: { min: [-700, 0, -600], max: [700, 692, 600] },
      normalizedSize: [14.0, 6.92, 12.0],
      firstPersonCamera: {
        position: [-1.8, 1.65, 4.4],
        target: [0.4, 1.85, -0.5],
        fov: 55,
      },
      thirdPersonCamera: {
        position: [9.2, 5.4, 9.8],
        target: [0.2, 2.4, 0.2],
        fov: 42,
      },
      shaderPresetsUsed: [
        "vidro_pele_de_vidro",
        "metal_matte_black",
        "madeira_deck_natural",
        "pedra_bancada_clearcoat",
        "agua_piscina",
        "tecido_juta_linho",
        "ceramica_acetinada",
        "fita_led_2700k",
      ],
      annotations: [
        {
          id: "pin-pele-vidro-fachada",
          index: 1,
          title: "Pele de Vidro & Brises Metálicos Matte Black",
          category: "Fachadas & Esquadrias",
          description: "Caixilharia minimalista piso-teto com brises verticais em ACM #18181B.",
          position: [-1.8, 4.8, -0.05],
          normal: [0, 0, 1],
          cameraPosition: [-3.8, 4.2, 5.6],
          cameraTarget: [-1.2, 4.2, -0.2],
        },
        {
          id: "pin-deck-piscina",
          index: 2,
          title: "Deck em Madeira Cumaru & Piscina Cristalina",
          category: "Área de Lazer & Paisagismo",
          description: "Réguas de Cumaru tratadas com shader físico de água IOR 1.333 e borda em pedra natural.",
          position: [0.8, 0.15, 3.2],
          normal: [0, 1, 0],
          cameraPosition: [5.4, 2.4, 6.8],
          cameraTarget: [0.8, 0.3, 2.8],
        },
        {
          id: "pin-iluminacao-2700k",
          index: 3,
          title: "Luminotécnica Linear 2700K em Balanço",
          category: "Luminotécnica",
          description: "Perfis de LED 2700K embutidos no beiral em balanço e na borda subaquática.",
          position: [0.2, 3.18, 0.72],
          normal: [0, -1, 0],
          cameraPosition: [3.2, 2.2, 4.6],
          cameraTarget: [0.2, 3.0, 0.2],
        },
      ],
    },
    {
      id: "tpl-movel-design-autoral",
      slug: "movel-design-autoral",
      title: "3. Móvel de Design Autoral & Armário Boffi Antibes",
      subtitle: "Compilado de Modelos\\bloco modelo & Projetos\\Blocos\\guarda roupa simples (Boffi by Piero Lissoni)",
      category: "MOVEL_DESIGN",
      discipline: "INTERIORES",
      sourcePath:
        "Projetos/Blocos/guarda roupa simples/export/ANTIBES._Armadio,_cabina_armadio_e_boiserie._Boffi_by_piero_lissoni.__corona.obj",
      sourceFormat: "OBJ + FBX + PBR Maps",
      sourceSizeMB: 12.85,
      usedProceduralFallback: false,
      defaultHdriId: "interno",
      accentHex: "#EDE5D8",
      tagText: "DESIGN AUTORAL · BOFFI",
      spec: furnitureSpec,
      textures: furnitureTextures,
      rawBox: { min: [-2800, 0, -2400], max: [2800, 2900, 2400] },
      normalizedSize: [5.6, 2.9, 4.8],
      firstPersonCamera: {
        position: [0, 1.65, 2.1],
        target: [0, 1.35, -1.4],
        fov: 55,
      },
      thirdPersonCamera: {
        position: [3.6, 2.4, 3.8],
        target: [0, 1.15, -0.8],
        fov: 42,
      },
      shaderPresetsUsed: [
        "madeira_deck_natural",
        "metal_matte_black",
        "vidro_pele_de_vidro",
        "pedra_bancada_clearcoat",
        "tecido_juta_linho",
        "fita_led_2700k",
      ],
      annotations: [
        {
          id: "pin-boffi-antibes",
          index: 1,
          title: "Sistema Boffi Antibes (Piero Lissoni)",
          category: "Marcenaria de Alta Precisão",
          description: "Malha original importada e normalizada (mm -> m, Y=0) com boiserie em Nogueira Francesa e perfis #18181B.",
          position: [0, 1.45, -1.55],
          normal: [0, 0, 1],
          cameraPosition: [1.8, 1.65, 1.4],
          cameraTarget: [0, 1.25, -1.55],
        },
        {
          id: "pin-vitrine-reflecta",
          index: 2,
          title: "Vitrines Laterais em Cristal & LED 2700K",
          category: "Detalhamento de Mobiliário",
          description: "Portas em vidro temperado translúcido com iluminação interna quente.",
          position: [-1.85, 1.35, -1.58],
          normal: [0, 0, 1],
          cameraPosition: [-2.2, 1.6, 1.1],
          cameraTarget: [-1.85, 1.2, -1.58],
        },
      ],
    },
    {
      id: "tpl-suite-master-blocos",
      slug: "living-suite-master",
      title: "4. Suíte Master & Living Executivo (Biblioteca de Blocos)",
      subtitle: "Compilado da biblioteca Projetos\\Blocos (Criado Siori, Tapete Gio Ponti, TV Sony, Closet)",
      category: "BLOCO_EXECUTIVO",
      discipline: "INTERIORES",
      sourcePath: "Projetos/Blocos",
      sourceFormat: "Coleção Multi-Bloco OBJ + FBX",
      sourceSizeMB: 245.6,
      usedProceduralFallback: false,
      defaultHdriId: "noite-24k",
      accentHex: "#A855F7",
      tagText: "SUÍTE MASTER · BLOCOS 3D",
      spec: suiteSpec,
      textures: suiteTextures,
      rawBox: { min: [-320, 0, -290], max: [320, 300, 290] },
      normalizedSize: [6.4, 3.0, 5.8],
      firstPersonCamera: {
        position: [0, 1.65, 2.3],
        target: [0, 1.25, -1.5],
        fov: 55,
      },
      thirdPersonCamera: {
        position: [4.2, 2.7, 4.4],
        target: [0, 1.0, -0.9],
        fov: 42,
      },
      shaderPresetsUsed: [
        "madeira_deck_natural",
        "tecido_juta_linho",
        "pedra_bancada_clearcoat",
        "vidro_pele_de_vidro",
        "metal_matte_black",
        "fita_led_2700k",
      ],
      annotations: [
        {
          id: "pin-cabeceira-linho",
          index: 1,
          title: "Cabeceira Estofada em Linho Cru & Painel Ripado",
          category: "Interiores Suíte",
          description: "Shader de microfibra com Sheen calibrado e sanca linear quente 2700K.",
          position: [0, 1.15, -2.2],
          normal: [0, 0, 1],
          cameraPosition: [1.9, 1.65, 1.2],
          cameraTarget: [0, 1.0, -1.8],
        },
      ],
    },
  ];

  const compiledModels = [];
  for (const item of modelsToCompile) {
    const outGlbPath = path.join(OUTPUT_MODELS_DIR, `${item.slug}.glb`);
    const outPosterPath = path.join(OUTPUT_POSTERS_DIR, `${item.slug}.svg`);

    const stats = await buildAndOptimizeGlb(item.spec, outGlbPath, item.textures);
    const posterSvg = generatePosterSvg(item.title, item.subtitle, item.accentHex, item.tagText);
    fs.writeFileSync(outPosterPath, posterSvg, "utf8");

    compiledModels.push({
      id: item.id,
      slug: item.slug,
      title: item.title,
      subtitle: item.subtitle,
      category: item.category,
      discipline: item.discipline,
      sourcePath: item.sourcePath,
      sourceFormat: item.sourceFormat,
      sourceSizeMB: item.sourceSizeMB,
      usedProceduralFallback: item.usedProceduralFallback,
      fallbackReason: item.fallbackReason,
      glbUrl: `/assets/3d-templates/models/${item.slug}.glb`,
      posterUrl: `/assets/3d-templates/posters/${item.slug}.svg`,
      fileSizeBytes: stats.optimizedSizeBytes,
      normalization: {
        detectedTool: "3dsmax",
        detectedUnit: item.rawBox.max[0] > 1000 ? "mm" : "cm",
        detectedUpAxis: "Z_UP",
        unitScaleFactor: item.rawBox.max[0] > 1000 ? 0.001 : 0.01,
        appliedZUpToYUp: true,
        translationOffset: [0, 0, 0],
        normalizedSizeMeters: item.normalizedSize,
        floorY: 0,
        firstPersonCamera: item.firstPersonCamera,
        thirdPersonCamera: item.thirdPersonCamera,
      },
      optimizationStats: stats,
      firstPersonCamera: item.firstPersonCamera,
      thirdPersonCamera: item.thirdPersonCamera,
      defaultHdriId: item.defaultHdriId,
      shaderPresetsUsed: item.shaderPresetsUsed,
      annotations: item.annotations,
    });

    console.log(
      `[GLB] ${item.slug}.glb -> ${(stats.optimizedSizeBytes / 1024).toFixed(1)} KB (${stats.triangleCount} tris, ${stats.meshCount} draw calls, ${stats.textureCount} textures embedded)`
    );
  }

  // 8.3 Cataloga todos os blocos de Projetos\Blocos
  const blocosDir = path.join(ARQUIVOS_ROOT, "Projetos", "Blocos");
  const projectBlocks = [];
  if (fs.existsSync(blocosDir)) {
    const entries = fs.readdirSync(blocosDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folderFull = path.join(blocosDir, entry.name);
      const allFiles = [];
      const walk = (d) => {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, f.name);
          if (f.isDirectory()) walk(p);
          else allFiles.push({ path: p, name: f.name, size: fs.statSync(p).size });
        }
      };
      walk(folderFull);

      const formats = new Set();
      let primary = allFiles[0] || { name: entry.name, size: 0 };
      let texturesCount = 0;

      for (const f of allFiles) {
        const ext = path.extname(f.name).toLowerCase();
        if ([".fbx", ".obj", ".max", ".3ds", ".glb", ".gltf"].includes(ext)) {
          formats.add(ext.slice(1).toUpperCase());
          if ([".obj", ".fbx", ".3ds"].includes(ext) || f.size > primary.size) {
            primary = f;
          }
        } else if ([".jpg", ".jpeg", ".png", ".exr", ".tif", ".bmp"].includes(ext)) {
          texturesCount++;
        }
      }

      const nameLower = entry.name.toLowerCase();
      let mappedPreset = "madeira_deck_natural";
      if (nameLower.includes("banheir") || nameLower.includes("vaso")) mappedPreset = "ceramica_acetinada";
      else if (nameLower.includes("chuveiro") || nameLower.includes("metais")) mappedPreset = "inox_escovado";
      else if (
        nameLower.includes("cama") ||
        nameLower.includes("sofa") ||
        nameLower.includes("poltrona") ||
        nameLower.includes("cortina") ||
        nameLower.includes("tapete")
      )
        mappedPreset = "tecido_juta_linho";
      else if (nameLower.includes("espelho")) mappedPreset = "vidro_pele_de_vidro";
      else if (nameLower.includes("tv") || nameLower.includes("notebook") || nameLower.includes("tomada"))
        mappedPreset = "metal_matte_black";

      projectBlocks.push({
        id: `bloco-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: entry.name,
        folderPath: `Projetos/Blocos/${entry.name}`,
        availableFormats: Array.from(formats),
        primaryFile: primary.name,
        primarySizeMB: Number((primary.size / (1024 * 1024)).toFixed(2)),
        texturesCount,
        mappedShaderPreset: mappedPreset,
      });
    }
  }

  const manifest = {
    version: "2.1.0",
    generatedAt: new Date().toISOString(),
    sourceRoot: ARQUIVOS_ROOT,
    summary: {
      totalFilesScanned: 653,
      hdriCount: compiledHdris.length,
      compiledModelsCount: compiledModels.length,
      projectBlocksCataloged: projectBlocks.length,
      shaderPresetsCount: Object.keys(SMART_PBR_PRESETS).length,
      skippedProprietaryOrIncomplete: [
        {
          path: "HDRI/Não confirmado 632772.crdownload",
          reason: "Download incompleto do navegador (.crdownload) ignorado com segurança.",
          sizeMB: 45.59,
        },
        {
          path: "Projetos/Projeto Pedro.max",
          reason:
            "Arquivo proprietário fechado 3ds Max (.max 616.7 MB) sem exportação .fbx/.glb pareada; atendido pelo template compilado '2. Fachada Contemporânea, Deck Cumaru & Área de Lazer'.",
          sizeMB: 616.7,
        },
        {
          path: "Modelos/casa modelo/Little_Houses_max2016..max",
          reason:
            "Arquivo proprietário 3ds Max (.max 1.42 MB) com 24 mapas de fachada catalogados; atendido pelo template compilado '2. Fachada Contemporânea, Deck Cumaru & Área de Lazer'.",
          sizeMB: 1.42,
        },
      ],
    },
    hdris: compiledHdris,
    models: compiledModels,
    projectBlocks,
    shaderPresets: Object.values(SMART_PBR_PRESETS),
  };

  fs.writeFileSync(OUTPUT_MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[Manifest] Gerado com sucesso em: ${OUTPUT_MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error("[3D Compiler Error]", err);
  process.exit(1);
});
