export interface IfcElementProperties {
  expressId: number;
  name: string;
  category: string;
  level: string;
  material: string;
  dimensions: string;
  areaM2: number;
  volumeM3: number;
  format?: string;
}

export type RenderMode = "PBR" | "CLAY" | "EDGES" | "WIREFRAME" | "XRAY" | "EXPLODED";
export type CameraNavMode = "ORBIT" | "WALK";
export type QuickViewPreset = "ISO" | "TOP" | "FRONT" | "BACK" | "LEFT" | "RIGHT";

export interface Ifc3dRfiPin {
  id: string;
  code: string;
  title: string;
  status: string;
  cameraState?: {
    position: [number, number, number];
    target: [number, number, number];
    pinPosition?: [number, number, number];
    renderMode?: RenderMode;
    sectionPlanes?: { open: boolean; x: number; y: number; z: number };
  } | null;
}

export interface ExtractedIfcTakeoff {
  category: "AREAS" | "ESQUADRIAS" | "REVESTIMENTOS" | "ELETRICO" | "HIDRAULICO" | "ESTRUTURA";
  description: string;
  quantity: number;
  unit: string;
}
