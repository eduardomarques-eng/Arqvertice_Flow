#!/usr/bin/env node
/**
 * ArqVértice Flow — Pipeline CLI de Compressão e Otimização 3D (.GLB)
 * Aplica: dedup, prune, reorder, quantize e Meshopt (EXT_meshopt_compression)
 * Uso:
 *   npm run optimize:3d -- <entrada.glb> [saida.glb]
 *   npm run optimize:3d -- --generate-showcase
 */
import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, reorder, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.encoder": MeshoptEncoder,
});

/**
 * Helper para adicionar um paralelepípedo (box) com normais e índices a uma Mesh glTF
 */
function createBoxPrimitive(doc, material, sizeX, sizeY, sizeZ, offsetX = 0, offsetY = 0, offsetZ = 0) {
  const hx = sizeX / 2;
  const hy = sizeY / 2;
  const hz = sizeZ / 2;

  // 24 vértices (4 por face)
  const positions = new Float32Array([
    // Front (+Z)
    -hx + offsetX, -hy + offsetY,  hz + offsetZ,
     hx + offsetX, -hy + offsetY,  hz + offsetZ,
     hx + offsetX,  hy + offsetY,  hz + offsetZ,
    -hx + offsetX,  hy + offsetY,  hz + offsetZ,
    // Back (-Z)
     hx + offsetX, -hy + offsetY, -hz + offsetZ,
    -hx + offsetX, -hy + offsetY, -hz + offsetZ,
    -hx + offsetX,  hy + offsetY, -hz + offsetZ,
     hx + offsetX,  hy + offsetY, -hz + offsetZ,
    // Top (+Y)
    -hx + offsetX,  hy + offsetY,  hz + offsetZ,
     hx + offsetX,  hy + offsetY,  hz + offsetZ,
     hx + offsetX,  hy + offsetY, -hz + offsetZ,
    -hx + offsetX,  hy + offsetY, -hz + offsetZ,
    // Bottom (-Y)
    -hx + offsetX, -hy + offsetY, -hz + offsetZ,
     hx + offsetX, -hy + offsetY, -hz + offsetZ,
     hx + offsetX, -hy + offsetY,  hz + offsetZ,
    -hx + offsetX, -hy + offsetY,  hz + offsetZ,
    // Right (+X)
     hx + offsetX, -hy + offsetY,  hz + offsetZ,
     hx + offsetX, -hy + offsetY, -hz + offsetZ,
     hx + offsetX,  hy + offsetY, -hz + offsetZ,
     hx + offsetX,  hy + offsetY,  hz + offsetZ,
    // Left (-X)
    -hx + offsetX, -hy + offsetY, -hz + offsetZ,
    -hx + offsetX, -hy + offsetY,  hz + offsetZ,
    -hx + offsetX,  hy + offsetY,  hz + offsetZ,
    -hx + offsetX,  hy + offsetY, -hz + offsetZ,
  ]);

  const normals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  const posAcc = doc.createAccessor().setType("VEC3").setArray(positions);
  const normAcc = doc.createAccessor().setType("VEC3").setArray(normals);
  const idxAcc = doc.createAccessor().setType("SCALAR").setArray(indices);

  return doc
    .createPrimitive()
    .setAttribute("POSITION", posAcc)
    .setAttribute("NORMAL", normAcc)
    .setIndices(idxAcc)
    .setMaterial(material);
}

async function generateArchitecturalShowcaseGlb(outputPath) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene("ArqVertice_Architectural_Showcase");

  // Materiais PBR Calibrados (Warm Minimalist + Vidro Low-E + ACM Matte Black + Brise Champagne + LED 2700K)
  const matConcreteWarm = doc
    .createMaterial("Concreto_Arquitetonico_Warm")
    .setBaseColorFactor([0.92, 0.89, 0.84, 1.0])
    .setMetallicFactor(0.05)
    .setRoughnessFactor(0.75);

  const matAcmMatteBlack = doc
    .createMaterial("ACM_Matte_Black_PVDF")
    .setBaseColorFactor([0.11, 0.11, 0.13, 1.0])
    .setMetallicFactor(0.45)
    .setRoughnessFactor(0.42);

  const matGlassLowE = doc
    .createMaterial("Vidro_Insulado_LowE")
    .setBaseColorFactor([0.62, 0.78, 0.86, 0.58])
    .setAlphaMode("BLEND")
    .setMetallicFactor(0.15)
    .setRoughnessFactor(0.08);

  const matGlassBalustrade = doc
    .createMaterial("Vidro_Laminado_GuardaCorpo")
    .setBaseColorFactor([0.76, 0.88, 0.92, 0.45])
    .setAlphaMode("BLEND")
    .setMetallicFactor(0.1)
    .setRoughnessFactor(0.05);

  const matBriseChampagne = doc
    .createMaterial("Aluminio_Champagne_Anodizado")
    .setBaseColorFactor([0.78, 0.68, 0.54, 1.0])
    .setMetallicFactor(0.82)
    .setRoughnessFactor(0.28);

  const matLinearLed = doc
    .createMaterial("LED_Linear_2700K")
    .setBaseColorFactor([1.0, 0.88, 0.65, 1.0])
    .setEmissiveFactor([1.0, 0.82, 0.52])
    .setMetallicFactor(0.0)
    .setRoughnessFactor(0.2);

  // 1. Embasamento e Lajes Horizontais (Concreto Warm Minimalist)
  const meshSlabs = doc.createMesh("Estrutura_Lajes_Concreto");
  meshSlabs.addPrimitive(createBoxPrimitive(doc, matConcreteWarm, 18.0, 0.45, 16.0, 0, 0.225, 0)); // Base térreo
  meshSlabs.addPrimitive(createBoxPrimitive(doc, matConcreteWarm, 14.5, 0.38, 12.5, 0, 2.1, 0.8)); // Marquise Pórtico
  for (let floor = 1; floor <= 4; floor++) {
    const y = 2.1 + floor * 2.6;
    meshSlabs.addPrimitive(createBoxPrimitive(doc, matConcreteWarm, 11.6, 0.32, 10.6, 0.4, y, 0));
  }
  // Cobertura / Ático
  meshSlabs.addPrimitive(createBoxPrimitive(doc, matConcreteWarm, 12.2, 0.45, 11.2, 0.4, 13.2, 0));
  scene.addChild(doc.createNode("Pavimentos_Concreto").setMesh(meshSlabs));

  // 2. Pele de Vidro Duplo Low-E (Torre Principal)
  const meshGlass = doc.createMesh("Fachada_Pele_Vidro_LowE");
  meshGlass.addPrimitive(createBoxPrimitive(doc, matGlassLowE, 9.6, 10.4, 9.2, 0.6, 7.5, 0.1));
  meshGlass.addPrimitive(createBoxPrimitive(doc, matGlassLowE, 11.2, 1.85, 9.8, -0.5, 1.15, 0.5));
  scene.addChild(doc.createNode("Pele_De_Vidro").setMesh(meshGlass));

  // 3. Brises Metálicos Verticais em Alumínio Champagne
  const meshBrises = doc.createMesh("Brises_Aluminio_Champagne");
  for (let i = -4; i <= 5; i++) {
    const bx = i * 0.95 + 0.6;
    meshBrises.addPrimitive(createBoxPrimitive(doc, matBriseChampagne, 0.08, 10.2, 0.35, bx, 7.5, 4.82));
  }
  scene.addChild(doc.createNode("Sistema_Brises").setMesh(meshBrises));

  // 4. Guarda-Corpo em Vidro Laminado nos Terraços
  const meshBalustrade = doc.createMesh("Guarda_Corpo_Vidro_Laminado");
  for (let floor = 1; floor <= 4; floor++) {
    const by = 2.1 + floor * 2.6 + 0.62;
    meshBalustrade.addPrimitive(createBoxPrimitive(doc, matGlassBalustrade, 11.4, 1.05, 0.06, 0.4, by, 5.25));
    meshBalustrade.addPrimitive(createBoxPrimitive(doc, matGlassBalustrade, 0.06, 1.05, 10.4, -5.35, by, 0));
  }
  scene.addChild(doc.createNode("Guarda_Corpos").setMesh(meshBalustrade));

  // 5. Volumes e Pórticos em Revestimento ACM Matte Black (#18181B)
  const meshAcm = doc.createMesh("Revestimento_ACM_Matte_Black");
  meshAcm.addPrimitive(createBoxPrimitive(doc, matAcmMatteBlack, 2.8, 13.6, 10.4, 4.8, 6.8, -0.4)); // Torre vertical ACM
  meshAcm.addPrimitive(createBoxPrimitive(doc, matAcmMatteBlack, 13.2, 0.55, 2.6, 0.0, 2.35, 5.2)); // Testa marquise frontal
  meshAcm.addPrimitive(createBoxPrimitive(doc, matAcmMatteBlack, 0.65, 2.2, 1.8, -5.8, 1.2, 4.8)); // Pilar pórtico esquerdo
  meshAcm.addPrimitive(createBoxPrimitive(doc, matAcmMatteBlack, 0.65, 2.2, 1.8, 5.8, 1.2, 4.8)); // Pilar pórtico direito
  scene.addChild(doc.createNode("Revestimento_ACM").setMesh(meshAcm));

  // 6. Iluminação Linear 2700K nas Sancas e Marquise
  const meshLed = doc.createMesh("Iluminacao_Linear_2700K");
  meshLed.addPrimitive(createBoxPrimitive(doc, matLinearLed, 11.8, 0.08, 0.14, 0.0, 1.9, 6.1));
  meshLed.addPrimitive(createBoxPrimitive(doc, matLinearLed, 10.8, 0.06, 0.12, 0.4, 4.65, 5.15));
  meshLed.addPrimitive(createBoxPrimitive(doc, matLinearLed, 10.8, 0.06, 0.12, 0.4, 7.25, 5.15));
  meshLed.addPrimitive(createBoxPrimitive(doc, matLinearLed, 10.8, 0.06, 0.12, 0.4, 9.85, 5.15));
  scene.addChild(doc.createNode("Perfis_LED_2700K").setMesh(meshLed));

  const rawBytes = await io.writeBinary(doc);

  await doc.transform(
    dedup(),
    prune(),
    reorder({ encoder: MeshoptEncoder }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" })
  );

  const optimizedBytes = await io.writeBinary(doc);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(optimizedBytes));

  // Gera também o pôster SVG arquitetônico instantâneo (0ms load)
  const posterPath = path.join(path.dirname(outputPath), "arqvertice-showcase-poster.svg");
  const svgPoster = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="675" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F5F5F7"/>
      <stop offset="55%" stop-color="#EDE5D8"/>
      <stop offset="100%" stop-color="#E4DAC9"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="120" x2="0" y2="540" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#93B7C8" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#537A8E" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <ellipse cx="600" cy="565" rx="370" ry="38" fill="#18181B" fill-opacity="0.08"/>
  <!-- Embasamento e Lajes -->
  <polygon points="290,545 620,585 910,520 590,485" fill="#DFD6C7" stroke="#C8BMA8" stroke-width="1.5"/>
  <!-- Torre de Vidro & Brises -->
  <polygon points="380,175 650,210 650,535 380,495" fill="url(#glass)" stroke="#7A9AAE" stroke-width="1.5"/>
  <polygon points="650,210 830,165 830,490 650,535" fill="#18181B" fill-opacity="0.92"/>
  <!-- Lajes Horizontais -->
  <polygon points="365,255 660,290 840,245 555,212" fill="#F2ECE1"/>
  <polygon points="365,335 660,370 840,325 555,292" fill="#F2ECE1"/>
  <polygon points="365,415 660,450 840,405 555,372" fill="#F2ECE1"/>
  <!-- Linha LED 2700K -->
  <line x1="340" y1="485" x2="685" y2="528" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
</svg>`;
  fs.writeFileSync(posterPath, svgPoster, "utf8");

  console.log(
    `[optimize:3d] Showcase GLB gerado e otimizado: ${outputPath} (${rawBytes.byteLength}B -> ${optimizedBytes.byteLength}B)`
  );
}

async function optimizeExistingFile(inputPath, outputPath) {
  const inputBuf = fs.readFileSync(inputPath);
  const doc = await io.readBinary(new Uint8Array(inputBuf));
  await doc.transform(
    dedup(),
    prune(),
    reorder({ encoder: MeshoptEncoder }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" })
  );
  const outBuf = await io.writeBinary(doc);
  fs.writeFileSync(outputPath, Buffer.from(outBuf));
  const ratio = ((1 - outBuf.byteLength / inputBuf.byteLength) * 100).toFixed(1);
  console.log(
    `[optimize:3d] Otimizado: ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${inputBuf.byteLength}B -> ${outBuf.byteLength}B | -${ratio}%)`
  );
}

const args = process.argv.slice(2);
const defaultShowcasePath = path.resolve(process.cwd(), "public/models/arqvertice-showcase.glb");

if (args.length === 0 || args.includes("--generate-showcase")) {
  await generateArchitecturalShowcaseGlb(defaultShowcasePath);
} else {
  const inFile = path.resolve(process.cwd(), args[0]);
  const outFile = args[1] ? path.resolve(process.cwd(), args[1]) : inFile;
  await optimizeExistingFile(inFile, outFile);
}
