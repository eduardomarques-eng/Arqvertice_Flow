export interface Project3DCameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface Project3DAnnotation {
  id: string;
  index: number;
  x: number;
  y: number;
  z: number;
  normal?: [number, number, number];
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  title: string;
  description: string;
  materialSpec?: string;
  dimensions?: string;
}

export interface Project3DOptimizationStats {
  originalBytes: number;
  optimizedBytes: number;
  compressionRatio: number;
  meshopt: boolean;
  ktx2: boolean;
  vertexCount: number;
  drawCalls: number;
}

export interface Project3DAssetDTO {
  id: string;
  projectId: string;
  documentId?: string | null;
  revisionId?: string | null;
  title: string;
  description?: string | null;
  glbUrl: string;
  posterUrl?: string | null;
  fileSizeBytes?: number | null;
  optimizationStats?: Project3DOptimizationStats | null;
  cameraPreset: Project3DCameraPreset;
  annotations: Project3DAnnotation[];
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SHOWCASE_CAMERA_PRESET: Project3DCameraPreset = {
  position: [18.5, 13.0, 21.0],
  target: [0, 5.2, 0],
  fov: 42,
};

export const DEFAULT_SHOWCASE_OPTIMIZATION_STATS: Project3DOptimizationStats = {
  originalBytes: 42588,
  optimizedBytes: 23352,
  compressionRatio: 45.2,
  meshopt: true,
  ktx2: false,
  vertexCount: 888,
  drawCalls: 6,
};

export const DEFAULT_SHOWCASE_ANNOTATIONS: Project3DAnnotation[] = [
  {
    id: "pin-pele-vidro-brise",
    index: 1,
    x: 4.8,
    y: 8.6,
    z: 4.9,
    normal: [0, 0, 1],
    cameraPosition: [11.2, 10.4, 13.8],
    cameraTarget: [3.2, 8.2, 3.8],
    title: "Pele de Vidro & Brise Metálico",
    description:
      "Sistema estrutural Glazing com vidro duplo insulado de controle solar e brises verticais em alumínio anodizado champagne.",
    materialSpec: "Vidro Insulado Low-E 6+12+6mm · Alumínio Champagne",
    dimensions: "Módulos 1,25m × 3,20m (Pé-direito duplo)",
  },
  {
    id: "pin-guarda-corpo-laminado",
    index: 2,
    x: -4.6,
    y: 5.4,
    z: 5.6,
    normal: [0, 0, 1],
    cameraPosition: [-12.0, 6.8, 13.5],
    cameraTarget: [-3.5, 5.0, 4.5],
    title: "Guarda-Corpo em Vidro Laminado",
    description:
      "Guarda-corpo panorâmico engastado em perfil U de aço inox oculto na laje, garantindo transparência contínua nos terraços.",
    materialSpec: "Vidro Laminado Temperado 10+10mm + PVB Estrutural",
    dimensions: "H = 1,10m · Extensão frontal 14,40m",
  },
  {
    id: "pin-acm-matte-black",
    index: 3,
    x: 5.2,
    y: 3.1,
    z: -4.2,
    normal: [1, 0, 0],
    cameraPosition: [14.5, 4.8, -10.5],
    cameraTarget: [3.8, 3.2, -3.0],
    title: "Revestimento ACM Matte Black",
    description:
      "Fachada ventilada no embasamento e coroamento em painéis de alumínio composto pintura PVDF Kynar 500 preto fosco.",
    materialSpec: "ACM 4mm Núcleo Mineral Incombustível · #18181B",
    dimensions: "Paginação 1,50m × 3,00m · Junta seca 12mm",
  },
  {
    id: "pin-iluminacao-linear-2700k",
    index: 4,
    x: 0.0,
    y: 1.8,
    z: 6.2,
    normal: [0, 1, 0],
    cameraPosition: [6.4, 3.0, 13.2],
    cameraTarget: [0.0, 1.6, 4.8],
    title: "Iluminação Linear 2700K",
    description:
      "Perfis de LED arquitetural embutidos nas sancas do pórtico de acesso e marquise em balanço, destacando os planos em concreto e madeira.",
    materialSpec: "Perfil Extrudado IP67 · LED 2700K IRC > 95 (18W/m)",
    dimensions: "Linhas contínuas de 12,00m · Fluxo 1650 lm/m",
  },
];
