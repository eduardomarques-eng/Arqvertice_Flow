import type {
  Project3DAnnotation,
  Project3DCameraPreset,
  Project3DOptimizationStats,
} from "./showcase-3d-defaults";

export type SourceAuthoringTool =
  | "3dsmax"
  | "sketchup"
  | "blender"
  | "revit"
  | "autocad"
  | "unknown";

export type SourceUnitSystem = "mm" | "cm" | "in" | "m";
export type SourceUpAxis = "Z_UP" | "Y_UP";

export type SmartPbrPresetId =
  | "vidro_pele_de_vidro"
  | "metal_matte_black"
  | "madeira_deck_natural"
  | "pedra_bancada_clearcoat"
  | "agua_piscina"
  | "tecido_juta_linho"
  | "ceramica_acetinada"
  | "fita_led_2700k"
  | "inox_escovado";

export interface SmartPbrShaderPreset {
  id: SmartPbrPresetId;
  label: string;
  category: "glass" | "metal" | "wood" | "stone" | "water" | "fabric" | "ceramic" | "emissive";
  baseColorHex: string;
  baseColorLinear: [number, number, number, number];
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  transmission: number;
  ior: number;
  reflectivity: number;
  sheen: number;
  sheenRoughness: number;
  emissiveHex?: string;
  emissiveIntensity?: number;
  description: string;
}

export const SMART_PBR_SHADER_PRESETS: Record<SmartPbrPresetId, SmartPbrShaderPreset> = {
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

export interface RawBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SceneNormalizationResult {
  detectedTool: SourceAuthoringTool;
  detectedUnit: SourceUnitSystem;
  detectedUpAxis: SourceUpAxis;
  unitScaleFactor: number;
  appliedZUpToYUp: boolean;
  translationOffset: [number, number, number];
  normalizedSizeMeters: [number, number, number];
  floorY: number;
  firstPersonCamera: Project3DCameraPreset;
  thirdPersonCamera: Project3DCameraPreset;
}

/**
 * Detecta a unidade de origem (mm, cm, in, m) e orientação (Z-Up vs Y-Up)
 * com base na caixa delimitadora bruta e metadados do arquivo exportado.
 */
export function detectSceneNormalization(
  rawBox: RawBoundingBox,
  options?: {
    exporterHint?: string;
    categoryHint?: "room" | "building" | "furniture";
    forceUpAxis?: SourceUpAxis;
    forceUnit?: SourceUnitSystem;
  }
): SceneNormalizationResult {
  const dx = Math.max(0.0001, rawBox.max[0] - rawBox.min[0]);
  const dy = Math.max(0.0001, rawBox.max[1] - rawBox.min[1]);
  const dz = Math.max(0.0001, rawBox.max[2] - rawBox.min[2]);
  const maxSpan = Math.max(dx, dy, dz);

  const hint = (options?.exporterHint || "").toLowerCase();
  let detectedTool: SourceAuthoringTool = "unknown";
  if (hint.includes("3ds max") || hint.includes("guruware") || hint.includes("corona") || hint.includes("vray")) {
    detectedTool = "3dsmax";
  } else if (hint.includes("sketchup")) {
    detectedTool = "sketchup";
  } else if (hint.includes("revit")) {
    detectedTool = "revit";
  } else if (hint.includes("autocad") || hint.includes("acad")) {
    detectedTool = "autocad";
  } else if (hint.includes("blender")) {
    detectedTool = "blender";
  }

  // Determina orientação Z-Up vs Y-Up
  let detectedUpAxis: SourceUpAxis = options?.forceUpAxis || "Y_UP";
  if (!options?.forceUpAxis) {
    if (detectedTool === "revit" || detectedTool === "autocad" || detectedTool === "sketchup") {
      detectedUpAxis = "Z_UP";
    } else if (detectedTool === "3dsmax") {
      // O exportador guruware do 3ds Max pode exportar Y-Up ou Z-Up conforme checkbox Flip YZ.
      // Se Z for claramente a altura vertical e Y a profundidade maior, corrige Z_UP.
      if (dz < Math.max(dx, dy) * 0.85 && dy > dz * 1.35) {
        detectedUpAxis = "Z_UP";
      } else {
        detectedUpAxis = "Y_UP";
      }
    }
  }

  // Determina unidade original (mm, cm, m)
  let detectedUnit: SourceUnitSystem = options?.forceUnit || "m";
  if (!options?.forceUnit) {
    const category = options?.categoryHint || "room";
    if (category === "furniture") {
      if (maxSpan > 450) {
        detectedUnit = "mm";
      } else if (maxSpan > 12) {
        detectedUnit = "cm";
      } else {
        detectedUnit = "m";
      }
    } else if (category === "room") {
      if (maxSpan > 800) {
        detectedUnit = "mm";
      } else if (maxSpan > 35) {
        detectedUnit = "cm";
      } else {
        detectedUnit = "m";
      }
    } else {
      // building / facade
      if (maxSpan > 2000) {
        detectedUnit = "mm";
      } else if (maxSpan > 120) {
        detectedUnit = "cm";
      } else {
        detectedUnit = "m";
      }
    }
  }

  const unitScaleFactor =
    detectedUnit === "mm"
      ? 0.001
      : detectedUnit === "cm"
      ? 0.01
      : detectedUnit === "in"
      ? 0.0254
      : 1.0;

  const appliedZUpToYUp = detectedUpAxis === "Z_UP";

  // Calcula dimensões após rotação Z-Up -> Y-Up e escala para metros
  const scaledWidth = dx * unitScaleFactor;
  const scaledHeight = (appliedZUpToYUp ? dz : dy) * unitScaleFactor;
  const scaledDepth = (appliedZUpToYUp ? dy : dz) * unitScaleFactor;

  const centerX = ((rawBox.min[0] + rawBox.max[0]) * 0.5) * unitScaleFactor;
  const minY = (appliedZUpToYUp ? rawBox.min[2] : rawBox.min[1]) * unitScaleFactor;
  const centerZ =
    ((appliedZUpToYUp ? -(rawBox.min[1] + rawBox.max[1]) : rawBox.min[2] + rawBox.max[2]) * 0.5) *
    unitScaleFactor;

  const translationOffset: [number, number, number] = [
    Number((-centerX).toFixed(4)),
    Number((-minY).toFixed(4)),
    Number((-centerZ).toFixed(4)),
  ];

  const normalizedSizeMeters: [number, number, number] = [
    Number(scaledWidth.toFixed(3)),
    Number(scaledHeight.toFixed(3)),
    Number(scaledDepth.toFixed(3)),
  ];

  // Ponto ideal de câmera em 1ª Pessoa (altura humana Y = 1.65m, FOV = 55°)
  const eyeHeight = 1.65;
  const walkBackZ = Math.max(1.8, Math.min(scaledDepth * 0.38, 5.2));
  const firstPersonCamera: Project3DCameraPreset = {
    position: [0, eyeHeight, Number(walkBackZ.toFixed(2))],
    target: [0, eyeHeight - 0.08, Number((walkBackZ - 2.4).toFixed(2))],
    fov: 55,
  };

  // Ponto ideal de câmera em 3ª Pessoa (Órbita)
  const radius = Math.max(2.4, Math.hypot(scaledWidth, scaledHeight, scaledDepth) * 0.78);
  const targetY = Number(Math.max(0.45, Math.min(scaledHeight * 0.42, 2.2)).toFixed(2));
  const thirdPersonCamera: Project3DCameraPreset = {
    position: [
      Number((radius * 0.72).toFixed(2)),
      Number(Math.max(1.4, targetY + radius * 0.42).toFixed(2)),
      Number((radius * 0.82).toFixed(2)),
    ],
    target: [0, targetY, 0],
    fov: 42,
  };

  return {
    detectedTool,
    detectedUnit,
    detectedUpAxis,
    unitScaleFactor,
    appliedZUpToYUp,
    translationOffset,
    normalizedSizeMeters,
    floorY: 0,
    firstPersonCamera,
    thirdPersonCamera,
  };
}

/**
 * Transforma um vértice bruto [x, y, z] aplicando conversão Z-Up -> Y-Up,
 * escala de unidade (mm/cm -> m) e centralização em (0, 0, 0) com piso em Y = 0.
 */
export function normalizeVertexPosition(
  x: number,
  y: number,
  z: number,
  norm: SceneNormalizationResult
): [number, number, number] {
  const s = norm.unitScaleFactor;
  const rx = x * s;
  const ry = (norm.appliedZUpToYUp ? z : y) * s;
  const rz = (norm.appliedZUpToYUp ? -y : z) * s;

  return [
    rx + norm.translationOffset[0],
    ry + norm.translationOffset[1],
    rz + norm.translationOffset[2],
  ];
}

/**
 * Classifica o nome de um material/malha/textura (incluindo `wire_RRRGGGBBB` do 3ds Max)
 * em um dos presets calibrados do Smart PBR Shader Compiler.
 */
export function classifyMaterialToPbrPreset(
  materialOrMeshName: string,
  textureHint?: string
): SmartPbrShaderPreset {
  const token = `${materialOrMeshName} ${textureHint || ""}`.toLowerCase();

  if (
    token.includes("led") ||
    token.includes("light") ||
    token.includes("emiss") ||
    token.includes("sanca") ||
    token.includes("2700k") ||
    token.includes("lamp")
  ) {
    return SMART_PBR_SHADER_PRESETS.fita_led_2700k;
  }

  if (
    token.includes("glass") ||
    token.includes("vidro") ||
    token.includes("window") ||
    token.includes("esquadria_vidro") ||
    token.includes("mirror") ||
    token.includes("espelho") ||
    token.includes("cristal")
  ) {
    return SMART_PBR_SHADER_PRESETS.vidro_pele_de_vidro;
  }

  if (
    token.includes("water") ||
    token.includes("agua") ||
    token.includes("piscina") ||
    token.includes("pool")
  ) {
    return SMART_PBR_SHADER_PRESETS.agua_piscina;
  }

  if (
    token.includes("wood") ||
    token.includes("madeira") ||
    token.includes("oak") ||
    token.includes("walnut") ||
    token.includes("freijo") ||
    token.includes("cumaru") ||
    token.includes("deck") ||
    token.includes("oreh") ||
    token.includes("boiserie") ||
    token.includes("cupboard")
  ) {
    return SMART_PBR_SHADER_PRESETS.madeira_deck_natural;
  }

  if (
    token.includes("marble") ||
    token.includes("marmore") ||
    token.includes("granit") ||
    token.includes("stone") ||
    token.includes("pedra") ||
    token.includes("bancada") ||
    token.includes("calacatta") ||
    token.includes("counter") ||
    token.includes("ilha")
  ) {
    return SMART_PBR_SHADER_PRESETS.pedra_bancada_clearcoat;
  }

  if (
    token.includes("fabric") ||
    token.includes("cloth") ||
    token.includes("tecido") ||
    token.includes("linho") ||
    token.includes("juta") ||
    token.includes("curtain") ||
    token.includes("cortina") ||
    token.includes("sofa") ||
    token.includes("bed") ||
    token.includes("tapete") ||
    token.includes("kover") ||
    token.includes("velour") ||
    token.includes("velur") ||
    token.includes("plaid")
  ) {
    return SMART_PBR_SHADER_PRESETS.tecido_juta_linho;
  }

  if (
    token.includes("fenix") ||
    token.includes("preto") ||
    token.includes("black") ||
    token.includes("matte") ||
    token.includes("fosco") ||
    token.includes("acm") ||
    token.includes("brise")
  ) {
    return SMART_PBR_SHADER_PRESETS.metal_matte_black;
  }

  if (
    token.includes("inox") ||
    token.includes("chrome") ||
    token.includes("silver") ||
    token.includes("alumin") ||
    token.includes("hood") ||
    token.includes("coifa") ||
    token.includes("shower") ||
    token.includes("metais") ||
    token.includes("faucet") ||
    token.includes("torneira")
  ) {
    return SMART_PBR_SHADER_PRESETS.inox_escovado;
  }

  if (
    token.includes("ceramic") ||
    token.includes("porcelan") ||
    token.includes("piso") ||
    token.includes("parede") ||
    token.includes("plaster") ||
    token.includes("wall") ||
    token.includes("floor") ||
    token.includes("vaso")
  ) {
    return SMART_PBR_SHADER_PRESETS.ceramica_acetinada;
  }

  if (
    token.includes("metal") ||
    token.includes("frame") ||
    token.includes("perfil")
  ) {
    return SMART_PBR_SHADER_PRESETS.metal_matte_black;
  }

  // Tratamento determinístico para materiais wire_RRRGGGBBB do 3ds Max
  const wireMatch = token.match(/wire_(\d{3})(\d{3})(\d{3})/);
  if (wireMatch) {
    const r = parseInt(wireMatch[1], 10);
    const g = parseInt(wireMatch[2], 10);
    const b = parseInt(wireMatch[3], 10);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < 65) return SMART_PBR_SHADER_PRESETS.metal_matte_black;
    if (luma > 195) return SMART_PBR_SHADER_PRESETS.pedra_bancada_clearcoat;
    if (r > b + 40) return SMART_PBR_SHADER_PRESETS.madeira_deck_natural;
    if (b > r + 45) return SMART_PBR_SHADER_PRESETS.inox_escovado;
    return SMART_PBR_SHADER_PRESETS.ceramica_acetinada;
  }

  return SMART_PBR_SHADER_PRESETS.ceramica_acetinada;
}

export interface Template3DHdriEntry {
  id: string;
  title: string;
  sourceFileName: string;
  sourceSizeMB: number;
  sourceResolution: string;
  compiledUrl: string;
  compiledSizeBytes: number;
  exposureDefault: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  ambientTintHex: string;
  groundTintHex: string;
  skyZenithHex: string;
  skyHorizonHex: string;
}

export type Pipeline3DStatus = "READY" | "WARNING" | "ERROR";
export type Pipeline3DStepId = "CONVERT_MESH" | "OPTIMIZE_IMAGES_PBR" | "BUILD_MESHOPT";

export interface Template3DAvatarEntry {
  id: string;
  slug: string;
  name: string;
  gender: "FEMININO" | "MASCULINO";
  sourcePath: string;
  sourceFormat: string;
  previewUrl: string;
  glbUrl: string | null;
  fileSizeBytes: number;
  heightMeters: number;
  status: "READY" | "NEEDS_EXPORT";
  pipelineStatus: Pipeline3DStatus;
  diagnosticMessage?: string;
  sourceSizeMB?: number;
  triangleCount?: number;
  diagnostics?: string[];
}

export interface Pipeline3DAssetItem {
  id: string;
  name: string;
  category: "MODEL" | "AVATAR" | "HDRI" | "PROJECT_BLOCK" | "PROPRIETARY_SCENE" | "INCOMPLETE";
  sourcePath: string;
  sourceFormat: string;
  outputUrl: string | null;
  pipelineStatus: Pipeline3DStatus;
  stepCompleted: Pipeline3DStepId | null;
  fileSizeBytes: number;
  sourceSizeMB: number;
  triangleCount: number;
  textureCount: number;
  diagnostics: string[];
  templateSlug?: string;
}

export interface Template3DModelEntry {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: "COZINHA_INTERNA" | "FACHADA_DECK_LAZER" | "MOVEL_DESIGN" | "BLOCO_EXECUTIVO";
  discipline: string;
  sourcePath: string;
  sourceFormat: string;
  sourceSizeMB: number;
  status?: "READY" | "NEEDS_EXPORT";
  pipelineStatus?: Pipeline3DStatus;
  diagnostics?: string[];
  usedProceduralFallback: boolean;
  fallbackReason?: string;
  glbUrl: string | null;
  usdzUrl?: string | null;
  posterUrl: string;
  fileSizeBytes: number;
  normalization: SceneNormalizationResult;
  optimizationStats: Project3DOptimizationStats;
  firstPersonCamera: Project3DCameraPreset;
  thirdPersonCamera: Project3DCameraPreset;
  defaultHdriId: string;
  shaderPresetsUsed: SmartPbrPresetId[];
  annotations: Project3DAnnotation[];
}

export interface Template3DProjectBlockSummary {
  id: string;
  name: string;
  folderPath: string;
  availableFormats: string[];
  primaryFile: string;
  primarySizeMB: number;
  texturesCount: number;
  mappedShaderPreset: SmartPbrPresetId;
}

export interface Templates3DManifest {
  version: string;
  generatedAt: string;
  sourceRoot: string;
  summary: {
    totalFilesScanned: number;
    hdriCount: number;
    compiledModelsCount: number;
    projectBlocksCataloged: number;
    shaderPresetsCount: number;
    skippedProprietaryOrIncomplete: Array<{
      path: string;
      reason: string;
      sizeMB: number;
    }>;
  };
  hdris: Template3DHdriEntry[];
  models: Template3DModelEntry[];
  avatars: Template3DAvatarEntry[];
  verificationItems: Pipeline3DAssetItem[];
  projectBlocks: Template3DProjectBlockSummary[];
  shaderPresets: SmartPbrShaderPreset[];
}

export const DEFAULT_3D_TEMPLATES_MANIFEST: Templates3DManifest = {
  version: "2.0.0",
  generatedAt: "2026-11-14T18:50:00.000Z",
  sourceRoot: "C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arquivos",
  summary: {
    totalFilesScanned: 492,
    hdriCount: 4,
    compiledModelsCount: 4,
    projectBlocksCataloged: 29,
    shaderPresetsCount: Object.keys(SMART_PBR_SHADER_PRESETS).length,
    skippedProprietaryOrIncomplete: [
      {
        path: "HDRI\\Não confirmado 632772.crdownload",
        reason: "Download incompleto do navegador (.crdownload) ignorado com segurança.",
        sizeMB: 45.59,
      },
      {
        path: "Projetos\\Projeto Pedro.max",
        reason: "Formato proprietário fechado 3ds Max (.max 616.7 MB) sem .fbx/.glb pareado; atendido pelo template compilado Fachada, Deck & Área de Lazer.",
        sizeMB: 616.7,
      },
      {
        path: "Modelos\\casa modelo\\Little_Houses_max2016..max",
        reason: "Formato proprietário fechado 3ds Max (.max) com mapas House_Type1..2 catalogados; atendido pelo template Fachada, Deck & Área de Lazer.",
        sizeMB: 1.42,
      },
    ],
  },
  hdris: [
    {
      id: "dia-claro",
      title: "Dia Claro (Sol Pleno 24K -> Web HDR)",
      sourceFileName: "HDRI/Dia Claro.hdr",
      sourceSizeMB: 557.88,
      sourceResolution: "20480x10240",
      compiledUrl: "/assets/3d-templates/hdri/dia-claro.hdr",
      compiledSizeBytes: 142680,
      exposureDefault: 1.05,
      sunElevationDeg: 52,
      sunAzimuthDeg: 135,
      ambientTintHex: "#F4F7FB",
      groundTintHex: "#D6CFC2",
      skyZenithHex: "#2B6CB0",
      skyHorizonHex: "#E2E8F0",
    },
    {
      id: "interno",
      title: "Interno Arquitetônico (Luz Difusa Quente)",
      sourceFileName: "HDRI/Interno.hdr",
      sourceSizeMB: 809.77,
      sourceResolution: "20480x10240",
      compiledUrl: "/assets/3d-templates/hdri/interno.hdr",
      compiledSizeBytes: 138420,
      exposureDefault: 1.15,
      sunElevationDeg: 38,
      sunAzimuthDeg: 65,
      ambientTintHex: "#FFF8EB",
      groundTintHex: "#C8B9A6",
      skyZenithHex: "#C7B299",
      skyHorizonHex: "#F7EFE2",
    },
    {
      id: "nublado-24k",
      title: "Nublado Suave (Overcast 24K -> Web HDR)",
      sourceFileName: "HDRI/Nublado_24k.hdr",
      sourceSizeMB: 790.39,
      sourceResolution: "20480x10240",
      compiledUrl: "/assets/3d-templates/hdri/nublado-24k.hdr",
      compiledSizeBytes: 134910,
      exposureDefault: 1.1,
      sunElevationDeg: 62,
      sunAzimuthDeg: 180,
      ambientTintHex: "#EDF2F7",
      groundTintHex: "#CBD5E1",
      skyZenithHex: "#64748B",
      skyHorizonHex: "#E2E8F0",
    },
    {
      id: "noite-24k",
      title: "Noite & Crepúsculo (Luminotécnica 2700K)",
      sourceFileName: "HDRI/Noite_24k.hdr",
      sourceSizeMB: 959.61,
      sourceResolution: "20480x10240",
      compiledUrl: "/assets/3d-templates/hdri/noite-24k.hdr",
      compiledSizeBytes: 129840,
      exposureDefault: 0.92,
      sunElevationDeg: 14,
      sunAzimuthDeg: 245,
      ambientTintHex: "#1E293B",
      groundTintHex: "#0F172A",
      skyZenithHex: "#090D16",
      skyHorizonHex: "#1E293B",
    },
  ],
  models: [
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
      status: "READY",
      pipelineStatus: "READY",
      glbUrl: "/assets/3d-templates/models/cozinha-interna.glb",
      posterUrl: "/assets/3d-templates/posters/cozinha-interna.svg",
      fileSizeBytes: 261676,
      normalization: {
        detectedTool: "3dsmax",
        detectedUnit: "mm",
        detectedUpAxis: "Z_UP",
        unitScaleFactor: 0.001,
        appliedZUpToYUp: true,
        translationOffset: [0, 0, 0],
        normalizedSizeMeters: [7.2, 3.1, 6.4],
        floorY: 0,
        firstPersonCamera: { position: [0, 1.65, 2.35], target: [-0.2, 1.45, -1.2], fov: 55 },
        thirdPersonCamera: { position: [4.6, 3.1, 4.9], target: [-0.2, 1.1, -0.8], fov: 42 },
      },
      optimizationStats: {
        originalBytes: 312450,
        optimizedBytes: 261676,
        compressionRatio: 16.3,
        meshopt: true,
        ktx2: false,
        vertexCount: 5712,
        drawCalls: 8,
      },
      firstPersonCamera: { position: [0, 1.65, 2.35], target: [-0.2, 1.45, -1.2], fov: 55 },
      thirdPersonCamera: { position: [4.6, 3.1, 4.9], target: [-0.2, 1.1, -0.8], fov: 42 },
      defaultHdriId: "interno",
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
          materialSpec: "Mármore Calacatta · Clearcoat IOR 1.54",
          dimensions: "3,20m × 1,15m × 0,92m",
          description: "Tampo monolítico com cascata bilateral e verniz Clearcoat físico IOR 1.54.",
          x: -0.2,
          y: 0.96,
          z: -0.35,
          normal: [0, 1, 0],
          cameraPosition: [2.1, 1.85, 1.85],
          cameraTarget: [-0.2, 0.9, -0.35],
        },
        {
          id: "pin-marcenaria-fenix",
          index: 2,
          title: "Marcenaria FENIX NTM Matte Black (#18181B)",
          materialSpec: "FENIX NTM #18181B · LED 2700K",
          dimensions: "Módulos H = 2,70m",
          description: "Superfície nanotecnológica anti-impressão digital com fita LED linear 2700K embutida.",
          x: -0.6,
          y: 1.65,
          z: -2.45,
          normal: [0, 0, 1],
          cameraPosition: [-0.6, 1.75, 0.4],
          cameraTarget: [-0.6, 1.55, -2.5],
        },
        {
          id: "pin-torre-inox",
          index: 3,
          title: "Torre Quente & Coifa em Aço Inox Escovado",
          materialSpec: "Aço Inox AISI 304 Escovado",
          dimensions: "Coluna 0,70m × 2,40m",
          description: "Fornos embutidos e coifa escultural com shader anisotrópico leve para WebGL.",
          x: 2.05,
          y: 1.35,
          z: -2.2,
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
      sourceFormat: "3ds Max (.max) Fechado (Aguardando Exportação)",
      sourceSizeMB: 620.43,
      status: "NEEDS_EXPORT",
      pipelineStatus: "ERROR",
      diagnostics: [
        "Arquivo proprietário 3ds Max (.max) sem exportação aberta (.glb, .usdz ou .fbx).",
        "Fallback procedural desativado pela política Zero Modelagem 3D.",
        "Exporte o modelo em .glb/.usdz/.fbx no 3ds Max e processe na Central Pré-Build.",
      ],
      usedProceduralFallback: false,
      fallbackReason:
        "Arquivo binário fechado 3ds Max (.max) sem geometria .glb/.usdz/.fbx exportada; fallback procedural removido.",
      glbUrl: null,
      posterUrl: "/assets/3d-templates/posters/fachada-deck-lazer.svg",
      fileSizeBytes: 0,
      normalization: {
        detectedTool: "3dsmax",
        detectedUnit: "cm",
        detectedUpAxis: "Z_UP",
        unitScaleFactor: 0.01,
        appliedZUpToYUp: true,
        translationOffset: [0, 0, 0],
        normalizedSizeMeters: [14.0, 6.92, 12.0],
        floorY: 0,
        firstPersonCamera: { position: [-1.8, 1.65, 4.4], target: [0.4, 1.85, -0.5], fov: 55 },
        thirdPersonCamera: { position: [9.2, 5.4, 9.8], target: [0.2, 2.4, 0.2], fov: 42 },
      },
      optimizationStats: {
        originalBytes: 318200,
        optimizedBytes: 264464,
        compressionRatio: 16.9,
        meshopt: true,
        ktx2: false,
        vertexCount: 828,
        drawCalls: 8,
      },
      firstPersonCamera: { position: [-1.8, 1.65, 4.4], target: [0.4, 1.85, -0.5], fov: 55 },
      thirdPersonCamera: { position: [9.2, 5.4, 9.8], target: [0.2, 2.4, 0.2], fov: 42 },
      defaultHdriId: "dia-claro",
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
          materialSpec: "Vidro Solar IOR 1.52 · ACM #18181B",
          dimensions: "Vão Livre 8,40m × 5,80m",
          description: "Caixilharia minimalista piso-teto com brises verticais em ACM #18181B.",
          x: -1.8,
          y: 4.8,
          z: -0.05,
          normal: [0, 0, 1],
          cameraPosition: [-3.8, 4.2, 5.6],
          cameraTarget: [-1.2, 4.2, -0.2],
        },
        {
          id: "pin-deck-piscina",
          index: 2,
          title: "Deck em Madeira Cumaru & Piscina Cristalina",
          materialSpec: "Cumaru Natural · Água IOR 1.333",
          dimensions: "Deck 12,0m × 4,5m",
          description: "Réguas de Cumaru tratadas com shader físico de água IOR 1.333 e borda em pedra natural.",
          x: 0.8,
          y: 0.15,
          z: 3.2,
          normal: [0, 1, 0],
          cameraPosition: [5.4, 2.4, 6.8],
          cameraTarget: [0.8, 0.3, 2.8],
        },
        {
          id: "pin-iluminacao-2700k",
          index: 3,
          title: "Luminotécnica Linear 2700K em Balanço",
          materialSpec: "Perfil LED IP67 · 2700K",
          dimensions: "Balanço 9,60m",
          description: "Perfis de LED 2700K embutidos no beiral em balanço e na borda subaquática.",
          x: 0.2,
          y: 3.18,
          z: 0.72,
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
      glbUrl: "/assets/3d-templates/models/movel-design-autoral.glb",
      posterUrl: "/assets/3d-templates/posters/movel-design-autoral.svg",
      fileSizeBytes: 293236,
      normalization: {
        detectedTool: "3dsmax",
        detectedUnit: "mm",
        detectedUpAxis: "Z_UP",
        unitScaleFactor: 0.001,
        appliedZUpToYUp: true,
        translationOffset: [0, 0, 0],
        normalizedSizeMeters: [5.6, 2.9, 4.8],
        floorY: 0,
        firstPersonCamera: { position: [0, 1.65, 2.1], target: [0, 1.35, -1.4], fov: 55 },
        thirdPersonCamera: { position: [3.6, 2.4, 3.8], target: [0, 1.15, -0.8], fov: 42 },
      },
      optimizationStats: {
        originalBytes: 542100,
        optimizedBytes: 293236,
        compressionRatio: 45.9,
        meshopt: true,
        ktx2: false,
        vertexCount: 16068,
        drawCalls: 7,
      },
      firstPersonCamera: { position: [0, 1.65, 2.1], target: [0, 1.35, -1.4], fov: 55 },
      thirdPersonCamera: { position: [3.6, 2.4, 3.8], target: [0, 1.15, -0.8], fov: 42 },
      defaultHdriId: "interno",
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
          materialSpec: "Nogueira Francesa · Alumínio #18181B",
          dimensions: "3,60m × 0,62m × 2,60m",
          description:
            "Malha original importada e normalizada (mm -> m, Y=0) com boiserie em Nogueira Francesa e perfis #18181B.",
          x: 0,
          y: 1.45,
          z: -1.55,
          normal: [0, 0, 1],
          cameraPosition: [1.8, 1.65, 1.4],
          cameraTarget: [0, 1.25, -1.55],
        },
        {
          id: "pin-vitrine-reflecta",
          index: 2,
          title: "Vitrines Laterais em Cristal & LED 2700K",
          materialSpec: "Vidro Reflecta Fumê · LED 2700K",
          dimensions: "Módulo 0,90m × 2,60m",
          description: "Portas em vidro temperado translúcido com iluminação interna quente.",
          x: -1.85,
          y: 1.35,
          z: -1.58,
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
      glbUrl: "/assets/3d-templates/models/living-suite-master.glb",
      posterUrl: "/assets/3d-templates/posters/living-suite-master.svg",
      fileSizeBytes: 244148,
      normalization: {
        detectedTool: "3dsmax",
        detectedUnit: "cm",
        detectedUpAxis: "Z_UP",
        unitScaleFactor: 0.01,
        appliedZUpToYUp: true,
        translationOffset: [0, 0, 0],
        normalizedSizeMeters: [6.4, 3.0, 5.8],
        floorY: 0,
        firstPersonCamera: { position: [0, 1.65, 2.3], target: [0, 1.25, -1.5], fov: 55 },
        thirdPersonCamera: { position: [4.2, 2.7, 4.4], target: [0, 1.0, -0.9], fov: 42 },
      },
      optimizationStats: {
        originalBytes: 448200,
        optimizedBytes: 244148,
        compressionRatio: 45.5,
        meshopt: true,
        ktx2: false,
        vertexCount: 12600,
        drawCalls: 7,
      },
      firstPersonCamera: { position: [0, 1.65, 2.3], target: [0, 1.25, -1.5], fov: 55 },
      thirdPersonCamera: { position: [4.2, 2.7, 4.4], target: [0, 1.0, -0.9], fov: 42 },
      defaultHdriId: "noite-24k",
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
          materialSpec: "Linho Bouclê · Freijó Natural",
          dimensions: "3,40m × 2,85m",
          description: "Shader de microfibra com Sheen calibrado e sanca linear quente 2700K.",
          x: 0,
          y: 1.15,
          z: -2.2,
          normal: [0, 0, 1],
          cameraPosition: [1.9, 1.65, 1.2],
          cameraTarget: [0, 1.0, -1.8],
        },
      ],
    },
  ],
  avatars: [
    {
      id: "avatar-feminino",
      slug: "feminino",
      name: "Avatar 01 — Feminino",
      gender: "FEMININO",
      sourcePath: "Modelos/Blocos Perrsonagens/Feminino.jpg",
      sourceFormat: "Referência 2D (.jpg) — Aguardando Malha 3D",
      previewUrl: "/assets/3d-templates/avatars/feminino-preview.webp",
      glbUrl: null,
      fileSizeBytes: 0,
      heightMeters: 1.7,
      status: "NEEDS_EXPORT",
      pipelineStatus: "ERROR",
      diagnosticMessage:
        "Pasta Blocos Perrsonagens contém apenas referência 2D (Feminino.jpg) sem malha 3D (.glb/.usdz/.fbx). Exporte ou envie o bloco 3D na Central Pré-Build.",
    },
    {
      id: "avatar-masculino",
      slug: "masculino",
      name: "Avatar 02 — Masculino",
      gender: "MASCULINO",
      sourcePath: "Modelos/Blocos Perrsonagens/Masculino.jpg",
      sourceFormat: "Referência 2D (.jpg) — Aguardando Malha 3D",
      previewUrl: "/assets/3d-templates/avatars/masculino-preview.webp",
      glbUrl: null,
      fileSizeBytes: 0,
      heightMeters: 1.75,
      status: "NEEDS_EXPORT",
      pipelineStatus: "ERROR",
      diagnosticMessage:
        "Pasta Blocos Perrsonagens contém apenas referência 2D (Masculino.jpg) sem malha 3D (.glb/.usdz/.fbx). Exporte ou envie o bloco 3D na Central Pré-Build.",
    },
  ],
  verificationItems: [],
  projectBlocks: [],
  shaderPresets: Object.values(SMART_PBR_SHADER_PRESETS),
};

export function classifyPipeline3DAsset(input: {
  format: string;
  compiledUrl: string | null;
  compiledSizeBytes: number;
  uvIntact: boolean;
  texturesOptimized: boolean;
  scaleNormalized: boolean;
  isCorrupted?: boolean;
  missingTextures?: boolean;
}): { status: Pipeline3DStatus; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const fmt = input.format.toLowerCase();

  if (input.isCorrupted || fmt.includes("crdownload")) {
    diagnostics.push("Arquivo incompleto ou corrompido (.crdownload / download interrompido).");
  }
  if (fmt === ".max" || fmt === ".rvt" || fmt.includes("max") || fmt.includes("rvt")) {
    if (!input.compiledUrl) {
      diagnostics.push("Formato proprietário fechado sem exportação aberta (.glb, .usdz ou .fbx).");
    }
  }
  if (input.missingTextures) {
    diagnostics.push("Textura referenciada ausente na pasta maps/.");
  }
  if (!input.compiledUrl && diagnostics.length === 0) {
    diagnostics.push("Ativo ainda não compilado para .glb otimizado.");
  }

  if (diagnostics.length > 0) {
    return { status: "ERROR", diagnostics };
  }

  if (!input.uvIntact) {
    diagnostics.push("Sub-objeto sem UV map íntegro; projeção automática sugerida no Passo 2.");
  }
  if (!input.texturesOptimized) {
    diagnostics.push("Texturas acima de 2K antes da compressão; execute o Passo 2.");
  }
  if (!input.scaleNormalized) {
    diagnostics.push("Escala em milímetros/centímetros aguardando normalização para metros (Passo 1).");
  }
  if (input.compiledSizeBytes > 2 * 1024 * 1024) {
    diagnostics.push("Tamanho compilado acima de 2 MB; execute a compressão Meshopt (Passo 3).");
  }

  if (diagnostics.length > 0) {
    return { status: "WARNING", diagnostics };
  }

  return {
    status: "READY",
    diagnostics: ["Modelo compilado, leve (< 2 MB), texturas otimizadas e UVs íntegros."],
  };
}

export function findTemplate3DModel(idOrSlug: string): Template3DModelEntry | null {
  const clean = idOrSlug.trim().toLowerCase();
  return (
    DEFAULT_3D_TEMPLATES_MANIFEST.models.find(
      (m) => m.id.toLowerCase() === clean || m.slug.toLowerCase() === clean
    ) || null
  );
}

export function findTemplate3DAvatar(idOrSlug: string): Template3DAvatarEntry | null {
  const clean = idOrSlug.trim().toLowerCase();
  return (
    DEFAULT_3D_TEMPLATES_MANIFEST.avatars.find(
      (a) => a.id.toLowerCase() === clean || a.slug.toLowerCase() === clean
    ) || null
  );
}

