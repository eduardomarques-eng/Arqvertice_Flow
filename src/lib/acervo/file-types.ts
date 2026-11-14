import type { AcervoFileType } from "@prisma/client";

const EXT_TO_ACERVO_TYPE: Record<string, AcervoFileType> = {
  PDF: "PDF",
  DWG: "DWG",
  DXF: "DXF",
  IFC: "IFC",
  RVT: "RVT",
  FBX: "FBX",
  GLB: "GLB",
  GLTF: "GLTF",
  OBJ: "OBJ",
  STL: "STL",
  "3DS": "TDS",
  TDS: "TDS",
  MAX: "MAX",
  PNG: "IMG",
  JPG: "IMG",
  JPEG: "IMG",
  WEBP: "IMG",
  SVG: "IMG",
  IMG: "IMG",
  DOC: "DOC",
  DOCX: "DOC",
};

export const ACCEPTED_PRIMARY_EXTENSIONS =
  ".pdf,.dwg,.dxf,.rvt,.ifc,.fbx,.glb,.gltf,.obj,.stl,.3ds,.max,.png,.webp,.jpg";

export const ACCEPTED_PREVIEW_EXTENSIONS =
  ".pdf,.dxf,.ifc,.fbx,.glb,.gltf,.obj,.stl,.3ds,.png,.webp,.jpg";

export function normalizeAcervoFileType(
  rawType?: string | null,
  fileName?: string | null
): AcervoFileType {
  if (rawType) {
    const key = rawType.trim().toUpperCase().replace(/^\./, "");
    if (EXT_TO_ACERVO_TYPE[key]) {
      return EXT_TO_ACERVO_TYPE[key];
    }
  }
  if (fileName) {
    const ext = fileName.split(".").pop()?.trim().toUpperCase() || "";
    if (EXT_TO_ACERVO_TYPE[ext]) {
      return EXT_TO_ACERVO_TYPE[ext];
    }
  }
  return "PDF";
}

export function is3dAcervoFormat(fileType?: string | null, fileName?: string | null): boolean {
  const normalized = normalizeAcervoFileType(fileType, fileName);
  return ["IFC", "FBX", "GLB", "GLTF", "OBJ", "STL", "TDS"].includes(normalized);
}
