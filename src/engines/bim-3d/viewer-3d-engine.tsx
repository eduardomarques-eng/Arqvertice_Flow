"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader.js";
import { disposeObject3D } from "./gpu-cleanup";
import { aggregateSceneTakeoffInWorker, type RawMeshMetric } from "./mesh-worker";
export type {
  IfcElementProperties,
  Ifc3dRfiPin,
  ExtractedIfcTakeoff,
  RenderMode,
  CameraNavMode,
  QuickViewPreset,
} from "./types";
import type {
  IfcElementProperties,
  Ifc3dRfiPin,
  ExtractedIfcTakeoff,
  RenderMode,
  CameraNavMode,
  QuickViewPreset,
} from "./types";
const IconBox = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const IconPointer = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 9 5 12 1.8-5.2L21 14Z" />
    <path d="M7.2 2.2 8 5.1" />
    <path d="m5.1 8-2.9-.8" />
    <path d="M14 4.1 12 6" />
    <path d="m6 12-1.9 2" />
  </svg>
);

const IconRotateCcw = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const IconMaximize = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6" />
    <path d="M9 21H3v-6" />
    <path d="M21 3l-7 7" />
    <path d="M3 21l7-7" />
  </svg>
);

const IconMinimize = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14h6v6" />
    <path d="M20 10h-6V4" />
    <path d="M14 10l7-7" />
    <path d="M3 21l7-7" />
  </svg>
);

const IconEye = ({ className = "h-3 w-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = ({ className = "h-3 w-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const IconScissors = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <path d="M8.12 8.12 12 12" />
    <path d="M20 4 8.12 15.88" />
    <circle cx="6" cy="18" r="3" />
    <path d="M14.8 14.8 20 20" />
  </svg>
);

const IconSparkles = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const IconFootprints = ({ className = "h-3 w-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
    <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
  </svg>
);

const IconCompass = ({ className = "h-3 w-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

interface Viewer3dEngineProps {
  modelUrl?: string | null;
  ifcUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
  rfis3d?: Ifc3dRfiPin[];
  focusedRfiId?: string | null;
  isPlacing3dPin?: boolean;
  onPlace3dPin?: (cameraState: {
    position: [number, number, number];
    target: [number, number, number];
    pinPosition: [number, number, number];
    renderMode?: RenderMode;
    sectionPlanes?: { open: boolean; x: number; y: number; z: number };
  }) => void;
  onSelectRfi?: (rfiId: string) => void;
  onExtractedQuantities?: (items: ExtractedIfcTakeoff[]) => void;
}

interface MeshSnapshot {
  originalMaterial: THREE.Material | THREE.Material[];
  baseLocalPos: THREE.Vector3;
  explodeDir: THREE.Vector3;
  edgeHelper?: THREE.LineSegments;
}

const RENDER_MODE_LABELS: Array<{ id: RenderMode; label: string }> = [
  { id: "PBR", label: "Realista" },
  { id: "CLAY", label: "Maquete" },
  { id: "EDGES", label: "Arestas" },
  { id: "WIREFRAME", label: "Aramado" },
  { id: "XRAY", label: "Raio-X" },
  { id: "EXPLODED", label: "Explodida" },
];

const QUICK_VIEWS: Array<{ id: QuickViewPreset; label: string }> = [
  { id: "ISO", label: "Iso" },
  { id: "TOP", label: "Topo" },
  { id: "FRONT", label: "Frontal" },
  { id: "BACK", label: "Posterior" },
  { id: "LEFT", label: "Esq" },
  { id: "RIGHT", label: "Dir" },
];

function detect3dExtension(url?: string | null, fileType?: string | null, fileName?: string | null): string {
  const candidates = [fileName, url, fileType].filter(Boolean).map((v) => String(v).toLowerCase());
  for (const val of candidates) {
    if (val.includes(".fbx") || val === "fbx") return "FBX";
    if (val.includes(".glb") || val === "glb") return "GLB";
    if (val.includes(".gltf") || val === "gltf") return "GLTF";
    if (val.includes(".obj") || val === "obj") return "OBJ";
    if (val.includes(".stl") || val === "stl") return "STL";
    if (val.includes(".3ds") || val === "3ds" || val === "tds") return "TDS";
    if (val.includes(".ifc") || val === "ifc") return "IFC";
  }
  return "IFC";
}

function extractSceneTakeoff(root: THREE.Group, formatLabel: string): ExtractedIfcTakeoff[] {
  const buckets = new Map<
    string,
    { count: number; areaM2: number; maxL: number; maxP: number; maxA: number; category: ExtractedIfcTakeoff["category"] }
  >();

  const mBox = new THREE.Box3();
  const mSize = new THREE.Vector3();

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    mBox.setFromObject(mesh);
    mBox.getSize(mSize);

    const matName = Array.isArray(mesh.material)
      ? mesh.material[0]?.name || "Multi-Material"
      : mesh.material?.name || "";
    const layerKey = (matName || mesh.name || `Camada ${formatLabel}`).trim();
    const lower = layerKey.toLowerCase();

    let category: ExtractedIfcTakeoff["category"] = "AREAS";
    if (lower.includes("window") || lower.includes("door") || lower.includes("vidro") || lower.includes("esquad")) {
      category = "ESQUADRIAS";
    } else if (lower.includes("pilar") || lower.includes("viga") || lower.includes("laje") || lower.includes("slab") || lower.includes("concret") || lower.includes("column")) {
      category = "ESTRUTURA";
    } else if (lower.includes("revest") || lower.includes("pis") || lower.includes("mad") || lower.includes("gess")) {
      category = "REVESTIMENTOS";
    } else if (lower.includes("elet") || lower.includes("lumin") || lower.includes("light")) {
      category = "ELETRICO";
    } else if (lower.includes("hidr") || lower.includes("tub") || lower.includes("pipe")) {
      category = "HIDRAULICO";
    }

    const area = (mSize.x * mSize.y + mSize.y * mSize.z + mSize.x * mSize.z) * 2;
    const prev = buckets.get(layerKey) || {
      count: 0,
      areaM2: 0,
      maxL: 0,
      maxP: 0,
      maxA: 0,
      category,
    };

    buckets.set(layerKey, {
      count: prev.count + 1,
      areaM2: prev.areaM2 + area,
      maxL: Math.max(prev.maxL, mSize.x),
      maxP: Math.max(prev.maxP, mSize.z),
      maxA: Math.max(prev.maxA, mSize.y),
      category,
    });
  });

  return Array.from(buckets.entries())
    .slice(0, 20)
    .map(([name, b]) => ({
      category: b.category,
      description: `${name} (${b.count}x · ${b.maxL.toFixed(2)}×${b.maxP.toFixed(2)}×${b.maxA.toFixed(2)}m)`,
      quantity: Number(b.areaM2.toFixed(2)),
      unit: "m²",
    }));
}

function buildProceduralBimModel(): { group: THREE.Group; takeoff: ExtractedIfcTakeoff[] } {
  const group = new THREE.Group();
  group.name = "ProceduralBIMModel";

  const addElement = (
    geo: THREE.BufferGeometry,
    color: number,
    pos: [number, number, number],
    meta: Omit<IfcElementProperties, "expressId">,
    id: number,
    roughness = 0.72,
    metalness = 0.08
  ) => {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...meta, expressId: id };
    group.add(mesh);
    return mesh;
  };

  // Laje Térreo
  addElement(
    new THREE.BoxGeometry(12, 0.35, 8.5),
    0xd6d3d1,
    [0, 0.175, 0],
    {
      name: "Laje Piso Térreo - Concreto FCK 30",
      category: "IfcSlab",
      level: "Térreo",
      material: "Concreto Armado FCK 30",
      dimensions: "12.00 x 8.50 x 0.35 m",
      areaM2: 102,
      volumeM3: 35.7,
    },
    1001,
    0.85,
    0.05
  );

  // Paredes Principais
  const wallSpecs: Array<{
    size: [number, number, number];
    pos: [number, number, number];
    name: string;
    area: number;
    vol: number;
    id: number;
  }> = [
    { size: [12, 3.2, 0.25], pos: [0, 1.95, -4.125], name: "Parede Externa Norte", area: 38.4, vol: 9.6, id: 2001 },
    { size: [12, 3.2, 0.25], pos: [0, 1.95, 4.125], name: "Parede Fachada Sul", area: 38.4, vol: 9.6, id: 2002 },
    { size: [0.25, 3.2, 8.0], pos: [-5.875, 1.95, 0], name: "Parede Lateral Oeste", area: 25.6, vol: 6.4, id: 2003 },
    { size: [0.25, 3.2, 8.0], pos: [5.875, 1.95, 0], name: "Parede Lateral Leste", area: 25.6, vol: 6.4, id: 2004 },
    { size: [0.18, 3.2, 5.2], pos: [-1.2, 1.95, -1.4], name: "Divisória Interna Sala/Suíte", area: 16.64, vol: 2.99, id: 2005 },
    { size: [5.0, 3.2, 0.18], pos: [3.25, 1.95, 0.5], name: "Divisória Interna Cozinha", area: 16.0, vol: 2.88, id: 2006 },
  ];

  wallSpecs.forEach((w) => {
    addElement(
      new THREE.BoxGeometry(...w.size),
      0xf4f4f5,
      w.pos,
      {
        name: w.name,
        category: "IfcWall",
        level: "Térreo",
        material: "Alvenaria Estrutural + Reboco",
        dimensions: `${w.size[0].toFixed(2)} x ${w.size[1].toFixed(2)} x ${w.size[2].toFixed(2)} m`,
        areaM2: w.area,
        volumeM3: w.vol,
      },
      w.id
    );
  });

  // Pilares Estruturais
  const columnPositions: [number, number][] = [
    [-5.75, -3.9],
    [0, -3.9],
    [5.75, -3.9],
    [-5.75, 3.9],
    [0, 3.9],
    [5.75, 3.9],
  ];
  columnPositions.forEach(([x, z], idx) => {
    addElement(
      new THREE.BoxGeometry(0.35, 3.55, 0.35),
      0xa1a1aa,
      [x, 2.1, z],
      {
        name: `Pilar P-0${idx + 1}`,
        category: "IfcColumn",
        level: "Térreo",
        material: "Concreto Armado FCK 35",
        dimensions: "0.35 x 0.35 x 3.55 m",
        areaM2: 4.97,
        volumeM3: 0.43,
      },
      3001 + idx,
      0.7,
      0.1
    );
  });

  // Esquadria / Pele de Vidro
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.38,
    roughness: 0.12,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.4, 0.08), glassMat);
  glassMesh.position.set(-2.5, 1.85, 4.28);
  glassMesh.userData = {
    expressId: 4001,
    name: "Caixilho Panorâmico Alumínio Preto + Vidro Laminado",
    category: "IfcWindow",
    level: "Térreo",
    material: "Alumínio Anodizado + Vidro 10mm",
    dimensions: "4.60 x 2.40 x 0.08 m",
    areaM2: 11.04,
    volumeM3: 0.88,
  };
  group.add(glassMesh);

  // Cobertura / Laje Superior
  addElement(
    new THREE.BoxGeometry(12.6, 0.28, 9.1),
    0x27272a,
    [0, 3.7, 0],
    {
      name: "Laje Cobertura Impermeabilizada",
      category: "IfcRoof",
      level: "Cobertura",
      material: "Concreto + Manta Asfáltica + Brita",
      dimensions: "12.60 x 9.10 x 0.28 m",
      areaM2: 114.66,
      volumeM3: 32.1,
    },
    5001,
    0.65,
    0.15
  );

  const takeoff: ExtractedIfcTakeoff[] = [
    { category: "ESTRUTURA", description: "Lajes em Concreto FCK 30 (Térreo + Cobertura)", unit: "m³", quantity: 67.8 },
    { category: "ESTRUTURA", description: "Pilares em Concreto FCK 35 (P-01 a P-06)", unit: "m³", quantity: 2.58 },
    { category: "AREAS", description: "Paredes Externas e Divisórias Internas", unit: "m²", quantity: 160.64 },
    { category: "ESQUADRIAS", description: "Caixilho Panorâmico Vidro Laminado 10mm", unit: "m²", quantity: 11.04 },
  ];

  return { group, takeoff };
}

export function Viewer3dEngine({
  modelUrl,
  ifcUrl,
  fileType,
  fileName,
  rfis3d = [],
  focusedRfiId,
  isPlacing3dPin = false,
  onPlace3dPin,
  onSelectRfi,
  onExtractedQuantities,
}: Viewer3dEngineProps) {
  const effectiveUrl = modelUrl || ifcUrl || null;
  const activeFormat = useMemo(
    () => detect3dExtension(effectiveUrl, fileType, fileName),
    [effectiveUrl, fileType, fileName]
  );

  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const snapshotsRef = useRef<Map<THREE.Mesh, MeshSnapshot>>(new Map());
  const pinsGroupRef = useRef<THREE.Group | null>(null);

  const [renderMode, setRenderMode] = useState<RenderMode>("PBR");
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [navMode, setNavMode] = useState<CameraNavMode>("ORBIT");
  const [sectionOpen, setSectionOpen] = useState(false);
  const [clipX, setClipX] = useState(100);
  const [clipY, setClipY] = useState(100);
  const [clipZ, setClipZ] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadBadge, setLoadBadge] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<IfcElementProperties | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [isolatedId, setIsolatedId] = useState<number | null>(null);

  // Walk mode state refs
  const keysPressedRef = useRef<Set<string>>(new Set());
  const joystickVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const navModeRef = useRef<CameraNavMode>(navMode);
  navModeRef.current = navMode;

  const placingPinRef = useRef(isPlacing3dPin);
  placingPinRef.current = isPlacing3dPin;
  const onPlace3dPinRef = useRef(onPlace3dPin);
  onPlace3dPinRef.current = onPlace3dPin;
  const onSelectRfiRef = useRef(onSelectRfi);
  onSelectRfiRef.current = onSelectRfi;
  const renderModeRef = useRef<RenderMode>(renderMode);
  renderModeRef.current = renderMode;
  const sectionPlanesRef = useRef({ open: sectionOpen, x: clipX, y: clipY, z: clipZ });
  sectionPlanesRef.current = { open: sectionOpen, x: clipX, y: clipY, z: clipZ };

  // Clipping planes
  const clipPlanesRef = useRef([
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 100),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 100),
  ]);

  const modelBoundsRef = useRef<{ min: THREE.Vector3; max: THREE.Vector3; radius: number }>({
    min: new THREE.Vector3(-5, -5, -5),
    max: new THREE.Vector3(5, 5, 5),
    radius: 8,
  });

  // Apply quick camera view
  const applyQuickView = useCallback((preset: QuickViewPreset) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;

    const r = Math.max(modelBoundsRef.current.radius * 1.9, 6);
    const target = new THREE.Vector3(0, 0, 0);

    switch (preset) {
      case "TOP":
        cam.position.set(0, r * 1.35, 0.01);
        break;
      case "FRONT":
        cam.position.set(0, r * 0.15, r * 1.25);
        break;
      case "BACK":
        cam.position.set(0, r * 0.15, -r * 1.25);
        break;
      case "LEFT":
        cam.position.set(-r * 1.25, r * 0.15, 0);
        break;
      case "RIGHT":
        cam.position.set(r * 1.25, r * 0.15, 0);
        break;
      case "ISO":
      default:
        cam.position.set(r * 0.85, r * 0.68, r * 0.85);
        break;
    }

    ctrl.target.copy(target);
    ctrl.update();
  }, []);

  // Normalize loaded 3D object to origin + uniform scale
  const normalizeAndSnapshotModel = useCallback((root: THREE.Group, formatLabel: string) => {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetSpan = 10;
    const scale = targetSpan / maxDim;

    root.scale.multiplyScalar(scale);
    root.position.sub(center.multiplyScalar(scale));
    root.updateMatrixWorld(true);

    const normBox = new THREE.Box3().setFromObject(root);
    const normSize = new THREE.Vector3();
    normBox.getSize(normSize);
    modelBoundsRef.current = {
      min: normBox.min.clone(),
      max: normBox.max.clone(),
      radius: Math.max(normSize.length() * 0.5, 3),
    };

    // Update camera near/far & controls
    const cam = cameraRef.current;
    if (cam) {
      cam.near = Math.max(0.05, modelBoundsRef.current.radius * 0.005);
      cam.far = Math.max(500, modelBoundsRef.current.radius * 40);
      cam.updateProjectionMatrix();
    }

    // Snapshot meshes for render modes + explode
    const snapshots = new Map<THREE.Mesh, MeshSnapshot>();
    let autoId = 10000;
    const meshCenterWorld = new THREE.Vector3();
    const rootCenterWorld = new THREE.Vector3(0, 0, 0);

    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (!mesh.userData?.expressId) {
          autoId += 1;
          const mBox = new THREE.Box3().setFromObject(mesh);
          const mSize = new THREE.Vector3();
          mBox.getSize(mSize);
          mesh.userData = {
            expressId: autoId,
            name: mesh.name || `Elemento ${formatLabel} #${autoId - 10000}`,
            category: `Mesh (${formatLabel})`,
            level: "Modelo 3D",
            material: Array.isArray(mesh.material)
              ? "Multi-Material"
              : mesh.material?.name || "Material Padrão",
            dimensions: `${mSize.x.toFixed(2)} x ${mSize.y.toFixed(2)} x ${mSize.z.toFixed(2)} u`,
            areaM2: Number(((mSize.x * mSize.y + mSize.y * mSize.z + mSize.x * mSize.z) * 2).toFixed(2)),
            volumeM3: Number((mSize.x * mSize.y * mSize.z).toFixed(2)),
            format: formatLabel,
          };
        }

        const mBox = new THREE.Box3().setFromObject(mesh);
        mBox.getCenter(meshCenterWorld);
        const dir = meshCenterWorld.clone().sub(rootCenterWorld);
        if (dir.lengthSq() < 0.0001) {
          dir.set(0, 1, 0);
        } else {
          dir.normalize();
        }

        snapshots.set(mesh, {
          originalMaterial: mesh.material,
          baseLocalPos: mesh.position.clone(),
          explodeDir: dir,
        });
      }
    });

    snapshotsRef.current = snapshots;
  }, []);

  // Load 3D model using appropriate loader
  const loadModel = useCallback(
    async (scene: THREE.Scene) => {
      setLoading(true);
      setSelectedElement(null);
      setHiddenIds(new Set());
      setIsolatedId(null);

      // Clear previous model and dispose GPU resources
      if (modelRootRef.current) {
        scene.remove(modelRootRef.current);
        disposeObject3D(modelRootRef.current);
        modelRootRef.current = null;
      }
      snapshotsRef.current.clear();

      const usePlaceholder =
        !effectiveUrl ||
        effectiveUrl.includes("storage.arqvertice.com.br") ||
        effectiveUrl.startsWith("mock://");

      let loadedGroup: THREE.Group | null = null;
      let badge = `${activeFormat} • Motor WebGL`;

      if (!usePlaceholder && effectiveUrl) {
        try {
          if (activeFormat === "GLB" || activeFormat === "GLTF") {
            const loader = new GLTFLoader();
            const draco = new DRACOLoader();
            draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
            loader.setDRACOLoader(draco);
            const gltf = await loader.loadAsync(effectiveUrl);
            loadedGroup = gltf.scene;
            badge = `${activeFormat} (Draco) • Carregado`;
          } else if (activeFormat === "FBX") {
            const loader = new FBXLoader();
            loadedGroup = await loader.loadAsync(effectiveUrl);
            badge = "FBX Autodesk • Carregado";
          } else if (activeFormat === "OBJ") {
            const objLoader = new OBJLoader();
            try {
              const mtlUrl = effectiveUrl.replace(/\.obj$/i, ".mtl");
              const mtlRes = await fetch(mtlUrl, { method: "HEAD" });
              if (mtlRes.ok) {
                const mtlLoader = new MTLLoader();
                const materials = await mtlLoader.loadAsync(mtlUrl);
                materials.preload();
                objLoader.setMaterials(materials);
              }
            } catch {
              // Sem MTL pareado, segue com material padrão
            }
            loadedGroup = await objLoader.loadAsync(effectiveUrl);
            badge = "OBJ Wavefront • Carregado";
          } else if (activeFormat === "STL") {
            const loader = new STLLoader();
            const geo = await loader.loadAsync(effectiveUrl);
            geo.computeVertexNormals();
            const mat = new THREE.MeshStandardMaterial({
              color: 0xe4e4e7,
              roughness: 0.45,
              metalness: 0.15,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.name = fileName || "Malha STL";
            const g = new THREE.Group();
            g.add(mesh);
            loadedGroup = g;
            badge = "STL Malha 3D • Carregado";
          } else if (activeFormat === "TDS") {
            const loader = new TDSLoader();
            loadedGroup = await loader.loadAsync(effectiveUrl);
            badge = "3DS Studio • Carregado";
          } else if (activeFormat === "IFC") {
            const res = await fetch(effectiveUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = new Uint8Array(await res.arrayBuffer());
            const WebIFC = await import("web-ifc");
            const ifcApi = new WebIFC.IfcAPI();
            ifcApi.SetWasmPath("/wasm/");
            await ifcApi.Init();
            const modelID = ifcApi.OpenModel(buffer);

            const ifcGroup = new THREE.Group();
            let meshCount = 0;

            ifcApi.StreamAllMeshes(modelID, (flatMesh) => {
              const placed = flatMesh.geometries;
              for (let i = 0; i < placed.size(); i++) {
                const pg = placed.get(i);
                const geom = ifcApi.GetGeometry(modelID, pg.geometryExpressID);
                const verts = ifcApi.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
                const indices = ifcApi.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());

                const posArr = new Float32Array((verts.length / 6) * 3);
                const normArr = new Float32Array((verts.length / 6) * 3);
                for (let j = 0, k = 0; j < verts.length; j += 6, k += 3) {
                  posArr[k] = verts[j];
                  posArr[k + 1] = verts[j + 1];
                  posArr[k + 2] = verts[j + 2];
                  normArr[k] = verts[j + 3];
                  normArr[k + 1] = verts[j + 4];
                  normArr[k + 2] = verts[j + 5];
                }

                const threeGeo = new THREE.BufferGeometry();
                threeGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
                threeGeo.setAttribute("normal", new THREE.BufferAttribute(normArr, 3));
                threeGeo.setIndex(Array.from(indices));

                const mat = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(pg.color.x, pg.color.y, pg.color.z),
                  transparent: pg.color.w < 1,
                  opacity: pg.color.w,
                  roughness: 0.65,
                  side: THREE.DoubleSide,
                });

                const mesh = new THREE.Mesh(threeGeo, mat);
                const matrix = new THREE.Matrix4().fromArray(pg.flatTransformation);
                mesh.applyMatrix4(matrix);
                mesh.userData = {
                  expressId: flatMesh.expressID,
                  name: `Elemento IFC #${flatMesh.expressID}`,
                  category: "IfcProduct",
                  level: "BIM IFC",
                  material: "Material BIM",
                  dimensions: "Via web-ifc",
                  areaM2: 0,
                  volumeM3: 0,
                  format: "IFC",
                };
                ifcGroup.add(mesh);
                meshCount++;
                geom.delete();
              }
            });

            ifcApi.CloseModel(modelID);
            if (meshCount > 0) {
              loadedGroup = ifcGroup;
              badge = `IFC BIM (${meshCount} elementos) • web-ifc`;
            }
          }
        } catch (err) {
          console.warn("[Viewer3dEngine] Fallback para modelo demonstrativo:", err);
        }
      }

      let isProcedural = false;
      if (!loadedGroup) {
        isProcedural = true;
        const proc = buildProceduralBimModel();
        loadedGroup = proc.group;
        badge = `${activeFormat} • Preview Arquitetônico 3D`;
        onExtractedQuantities?.(proc.takeoff);
      }

      normalizeAndSnapshotModel(loadedGroup, activeFormat);
      if (!isProcedural) {
        const metrics: RawMeshMetric[] = [];
        const mBox = new THREE.Box3();
        const mSize = new THREE.Vector3();
        loadedGroup.traverse((obj) => {
          if (!(obj as THREE.Mesh).isMesh) return;
          const mesh = obj as THREE.Mesh;
          mBox.setFromObject(mesh);
          mBox.getSize(mSize);
          const matName = Array.isArray(mesh.material)
            ? mesh.material[0]?.name || "Multi-Material"
            : mesh.material?.name || "";
          metrics.push({ name: mesh.name, materialName: matName, sx: mSize.x, sy: mSize.y, sz: mSize.z });
        });
        const workerTakeoff = await aggregateSceneTakeoffInWorker(metrics, activeFormat);
        const finalTakeoff = workerTakeoff.length > 0 ? workerTakeoff : extractSceneTakeoff(loadedGroup, activeFormat);
        if (finalTakeoff.length > 0) {
          onExtractedQuantities?.(finalTakeoff);
        }
      }
      modelRootRef.current = loadedGroup;
      scene.add(loadedGroup);
      applyQuickView("ISO");
      setLoadBadge(badge);
      setLoading(false);
    },
    [effectiveUrl, activeFormat, fileName, normalizeAndSnapshotModel, applyQuickView, onExtractedQuantities]
  );

  // Initialize Three.js Scene + Animation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(14, 10, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxDistance = 200;
    controls.minDistance = 1;
    controlsRef.current = controls;

    // Soft Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe4e4e7, 0.95);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    dirLight.position.set(16, 24, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -18;
    dirLight.shadow.camera.right = 18;
    dirLight.shadow.camera.top = 18;
    dirLight.shadow.camera.bottom = -18;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.55);
    fillLight.position.set(-14, 10, -12);
    scene.add(fillLight);

    // Subtle CAD Ground Grid
    const grid = new THREE.GridHelper(32, 32, 0xd4d4d8, 0xe4e4e7);
    grid.position.y = -4.2;
    scene.add(grid);

    const pinsGroup = new THREE.Group();
    scene.add(pinsGroup);
    pinsGroupRef.current = pinsGroup;

    loadModel(scene);

    // Raycasting for selection & 3D pins
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Check RFI pins first
      if (pinsGroupRef.current) {
        const pinHits = raycaster.intersectObjects(pinsGroupRef.current.children, false);
        if (pinHits.length > 0 && pinHits[0].object.userData?.rfiId) {
          onSelectRfiRef.current?.(pinHits[0].object.userData.rfiId);
          return;
        }
      }

      if (!modelRootRef.current) return;
      const hits = raycaster.intersectObjects(modelRootRef.current.children, true);
      if (hits.length > 0) {
        const hit = hits[0];
        if (placingPinRef.current && onPlace3dPinRef.current) {
          const p = hit.point;
          const t = controls.target;
          onPlace3dPinRef.current({
            position: [
              Number(camera.position.x.toFixed(2)),
              Number(camera.position.y.toFixed(2)),
              Number(camera.position.z.toFixed(2)),
            ],
            target: [Number(t.x.toFixed(2)), Number(t.y.toFixed(2)), Number(t.z.toFixed(2))],
            pinPosition: [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))],
            renderMode: renderModeRef.current,
            sectionPlanes: { ...sectionPlanesRef.current },
          });
          return;
        }
        if (hit.object.userData?.expressId) {
          setSelectedElement(hit.object.userData as IfcElementProperties);
        }
      } else {
        setSelectedElement(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    // Keyboard listeners for WALK mode
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    let animId = 0;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (navModeRef.current === "WALK") {
        const speed = 0.14;
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, up).normalize();

        const keys = keysPressedRef.current;
        const j = joystickVecRef.current;

        let moveForward = 0;
        let moveRight = 0;
        if (keys.has("w") || keys.has("arrowup")) moveForward += 1;
        if (keys.has("s") || keys.has("arrowdown")) moveForward -= 1;
        if (keys.has("d") || keys.has("arrowright")) moveRight += 1;
        if (keys.has("a") || keys.has("arrowleft")) moveRight -= 1;

        moveForward += -j.y;
        moveRight += j.x;

        if (Math.abs(moveForward) > 0.01 || Math.abs(moveRight) > 0.01) {
          const delta = new THREE.Vector3()
            .addScaledVector(forward, moveForward * speed)
            .addScaledVector(right, moveRight * speed);
          camera.position.add(delta);
          controls.target.add(delta);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      disposeObject3D(scene);
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [loadModel]);

  // Apply Render Mode, Exploded View & Clipping Planes
  useEffect(() => {
    const snapshots = snapshotsRef.current;
    if (!snapshots.size) return;

    const bounds = modelBoundsRef.current;
    const mapPercentToCoord = (pct: number, min: number, max: number) => {
      if (pct >= 99.5) return 999;
      return min + (pct / 100) * (max - min);
    };

    clipPlanesRef.current[0].constant = mapPercentToCoord(clipX, bounds.min.x, bounds.max.x);
    clipPlanesRef.current[1].constant = mapPercentToCoord(clipY, bounds.min.y, bounds.max.y);
    clipPlanesRef.current[2].constant = mapPercentToCoord(clipZ, bounds.min.z, bounds.max.z);

    const activeClip = sectionOpen ? clipPlanesRef.current : [];

    const clayMat = new THREE.MeshStandardMaterial({
      color: 0xede5d8,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
      clippingPlanes: activeClip,
    });

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x18181b,
      wireframe: true,
      clippingPlanes: activeClip,
    });

    const xrayMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      roughness: 0.2,
      side: THREE.DoubleSide,
      clippingPlanes: activeClip,
    });

    const explodeDist = renderMode === "EXPLODED" ? (explodeFactor / 100) * 3.8 : 0;

    snapshots.forEach((snap, mesh) => {
      // Remove previous edge helper if any
      if (snap.edgeHelper) {
        mesh.remove(snap.edgeHelper);
        snap.edgeHelper.geometry.dispose();
        snap.edgeHelper = undefined;
      }

      // Visibility filter (isolate / hide)
      const elId = mesh.userData?.expressId as number | undefined;
      if (isolatedId !== null) {
        mesh.visible = elId === isolatedId;
      } else if (elId !== undefined && hiddenIds.has(elId)) {
        mesh.visible = false;
      } else {
        mesh.visible = true;
      }

      // Exploded position
      mesh.position
        .copy(snap.baseLocalPos)
        .addScaledVector(snap.explodeDir, explodeDist);

      // Material per mode
      if (renderMode === "CLAY") {
        mesh.material = clayMat;
      } else if (renderMode === "WIREFRAME") {
        mesh.material = wireMat;
      } else if (renderMode === "XRAY") {
        mesh.material = xrayMat;
      } else if (renderMode === "EDGES") {
        mesh.material = clayMat;
        const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 18);
        const edgesMat = new THREE.LineBasicMaterial({
          color: 0x18181b,
          transparent: true,
          opacity: 0.65,
        });
        const lineSeg = new THREE.LineSegments(edgesGeo, edgesMat);
        mesh.add(lineSeg);
        snap.edgeHelper = lineSeg;
      } else {
        // PBR or EXPLODED
        const orig = snap.originalMaterial;
        const applyClip = (m: THREE.Material) => {
          m.clippingPlanes = activeClip;
          m.needsUpdate = true;
        };
        if (Array.isArray(orig)) orig.forEach(applyClip);
        else applyClip(orig);
        mesh.material = orig;
      }
    });
  }, [renderMode, explodeFactor, sectionOpen, clipX, clipY, clipZ, hiddenIds, isolatedId]);

  // Render 3D RFI Pins
  useEffect(() => {
    const group = pinsGroupRef.current;
    if (!group) return;
    group.clear();

    rfis3d.forEach((pin) => {
      const pos = pin.cameraState?.pinPosition;
      if (!pos) return;
      const isFocused = pin.id === focusedRfiId;
      const color =
        pin.status === "ENCERRADA"
          ? 0x10b981
          : pin.status === "RESPONDIDA"
            ? 0x3b82f6
            : 0xf59e0b;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(isFocused ? 0.28 : 0.2, 16, 16),
        new THREE.MeshStandardMaterial({
          color,
          emissive: isFocused ? color : 0x000000,
          emissiveIntensity: isFocused ? 0.6 : 0,
        })
      );
      sphere.position.set(pos[0], pos[1], pos[2]);
      sphere.userData = { rfiId: pin.id };
      group.add(sphere);
    });
  }, [rfis3d, focusedRfiId]);

  // Restore saved camera, renderMode, and sectionPlanes when focusing an RFI
  useEffect(() => {
    if (!focusedRfiId) return;
    const focused = rfis3d.find((r) => r.id === focusedRfiId);
    if (!focused?.cameraState) return;

    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (cam && ctrl) {
      const { position, target } = focused.cameraState;
      if (Array.isArray(position) && position.length === 3) {
        cam.position.set(position[0], position[1], position[2]);
      }
      if (Array.isArray(target) && target.length === 3) {
        ctrl.target.set(target[0], target[1], target[2]);
      }
      ctrl.update();
    }

    if (focused.cameraState.renderMode) {
      setRenderMode(focused.cameraState.renderMode);
    }
    if (focused.cameraState.sectionPlanes) {
      setSectionOpen(focused.cameraState.sectionPlanes.open);
      setClipX(focused.cameraState.sectionPlanes.x);
      setClipY(focused.cameraState.sectionPlanes.y);
      setClipZ(focused.cameraState.sectionPlanes.z);
    }
  }, [focusedRfiId, rfis3d]);

  const handleResetVisibility = () => {
    setHiddenIds(new Set());
    setIsolatedId(null);
    setClipX(100);
    setClipY(100);
    setClipZ(100);
    setExplodeFactor(0);
    setRenderMode("PBR");
    applyQuickView("ISO");
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200/70 bg-[#F5F5F7] ${
        isFullscreen ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : "h-[540px]"
      }`}
    >
      {/* Top Left Status Pill */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/90 px-3 py-1 text-[11px] font-medium text-zinc-800 shadow-sm backdrop-blur-md">
          <IconBox className="h-3.5 w-3.5 text-zinc-700" />
          {loadBadge || `${activeFormat} • Carregando...`}
        </span>
        {isPlacing3dPin && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
            <IconPointer className="h-3.5 w-3.5" />
            Clique no modelo 3D para fixar RFI
          </span>
        )}
      </div>

      {/* Top Right Quick Views + Fullscreen */}
      <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center gap-1.5">
        <div className="hidden items-center gap-0.5 rounded-full border border-slate-200/70 bg-white/90 p-1 shadow-sm backdrop-blur-md sm:flex">
          {QUICK_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => applyQuickView(v.id)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleResetVisibility}
          title="Resetar câmera e filtros"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/90 text-zinc-700 shadow-sm backdrop-blur-md transition hover:bg-white"
        >
          <IconRotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen((f) => !f)}
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/90 text-zinc-700 shadow-sm backdrop-blur-md transition hover:bg-white"
        >
          {isFullscreen ? <IconMinimize className="h-3.5 w-3.5" /> : <IconMaximize className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* WebGL Canvas Container */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#F5F5F7]/80 backdrop-blur-sm">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
          <p className="mt-2 text-xs font-medium text-zinc-600">
            Processando geometria {activeFormat}...
          </p>
        </div>
      )}

      {/* Element Inspector Card */}
      {selectedElement && (
        <div className="absolute left-3 top-14 z-10 w-64 rounded-2xl border border-slate-200/70 bg-white/95 p-3.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)] backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {selectedElement.category}
              </p>
              <h4 className="text-xs font-semibold text-zinc-900">{selectedElement.name}</h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedElement(null)}
              className="text-xs text-zinc-400 hover:text-zinc-700"
            >
              ✕
            </button>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] text-zinc-600">
            <div className="flex justify-between">
              <span>Nível:</span>
              <span className="font-medium text-zinc-900">{selectedElement.level}</span>
            </div>
            <div className="flex justify-between">
              <span>Material:</span>
              <span className="max-w-[130px] truncate font-medium text-zinc-900">
                {selectedElement.material}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dimensões:</span>
              <span className="font-medium text-zinc-900">{selectedElement.dimensions}</span>
            </div>
            <div className="flex justify-between">
              <span>Área / Volume:</span>
              <span className="font-medium text-zinc-900">
                {selectedElement.areaM2} m² • {selectedElement.volumeM3} m³
              </span>
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            <button
              type="button"
              onClick={() =>
                setIsolatedId((prev) =>
                  prev === selectedElement.expressId ? null : selectedElement.expressId
                )
              }
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-zinc-50 py-1.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100"
            >
              <IconEye className="h-3 w-3" />
              {isolatedId === selectedElement.expressId ? "Mostrar Tudo" : "Isolar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setHiddenIds((prev) => {
                  const next = new Set(prev);
                  next.add(selectedElement.expressId);
                  return next;
                });
                setSelectedElement(null);
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-zinc-50 py-1.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100"
            >
              <IconEyeOff className="h-3 w-3" />
              Ocultar
            </button>
          </div>
        </div>
      )}

      {/* Section Planes Popover */}
      {sectionOpen && (
        <div className="absolute bottom-20 right-3 z-10 w-60 rounded-2xl border border-slate-200/70 bg-white/95 p-3.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
              <IconScissors className="h-3.5 w-3.5" />
              Planos de Corte (X / Y / Z)
            </span>
            <button
              type="button"
              onClick={() => {
                setClipX(100);
                setClipY(100);
                setClipZ(100);
              }}
              className="text-[10px] font-medium text-zinc-500 hover:text-zinc-900"
            >
              Reset
            </button>
          </div>
          <div className="space-y-2 text-[11px]">
            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Eixo X</span>
                <span>{clipX}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={clipX}
                onChange={(e) => setClipX(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
            </label>
            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Eixo Y (Altura)</span>
                <span>{clipY}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={clipY}
                onChange={(e) => setClipY(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
            </label>
            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Eixo Z</span>
                <span>{clipZ}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={clipZ}
                onChange={(e) => setClipZ(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
            </label>
          </div>
        </div>
      )}

      {/* Walk Mode Mobile Touch Joystick */}
      {navMode === "WALK" && (
        <div className="absolute bottom-20 left-3 z-10 flex flex-col items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/90 p-2.5 shadow-md backdrop-blur-md">
          <span className="text-[10px] font-medium text-zinc-500">WASD ou Toque</span>
          <div className="grid grid-cols-3 gap-1">
            <div />
            <button
              type="button"
              onPointerDown={() => (joystickVecRef.current = { x: 0, y: -1 })}
              onPointerUp={() => (joystickVecRef.current = { x: 0, y: 0 })}
              onPointerLeave={() => (joystickVecRef.current = { x: 0, y: 0 })}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-800 active:bg-zinc-900 active:text-white"
            >
              ↑
            </button>
            <div />
            <button
              type="button"
              onPointerDown={() => (joystickVecRef.current = { x: -1, y: 0 })}
              onPointerUp={() => (joystickVecRef.current = { x: 0, y: 0 })}
              onPointerLeave={() => (joystickVecRef.current = { x: 0, y: 0 })}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-800 active:bg-zinc-900 active:text-white"
            >
              ←
            </button>
            <button
              type="button"
              onPointerDown={() => (joystickVecRef.current = { x: 0, y: 1 })}
              onPointerUp={() => (joystickVecRef.current = { x: 0, y: 0 })}
              onPointerLeave={() => (joystickVecRef.current = { x: 0, y: 0 })}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-800 active:bg-zinc-900 active:text-white"
            >
              ↓
            </button>
            <button
              type="button"
              onPointerDown={() => (joystickVecRef.current = { x: 1, y: 0 })}
              onPointerUp={() => (joystickVecRef.current = { x: 0, y: 0 })}
              onPointerLeave={() => (joystickVecRef.current = { x: 0, y: 0 })}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-800 active:bg-zinc-900 active:text-white"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Apple-Minimalist Bottom Floating Bar */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex flex-col items-center gap-2">
        {renderMode === "EXPLODED" && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200/70 bg-white/95 px-4 py-1.5 shadow-md backdrop-blur-md">
            <IconSparkles className="h-3.5 w-3.5 text-zinc-700" />
            <span className="text-[11px] font-medium text-zinc-700">Explosão</span>
            <input
              type="range"
              min={0}
              max={100}
              value={explodeFactor}
              onChange={(e) => setExplodeFactor(Number(e.target.value))}
              className="w-32 accent-zinc-900"
            />
            <span className="w-8 text-right text-[11px] font-semibold text-zinc-900">
              {explodeFactor}%
            </span>
          </div>
        )}

        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-slate-200/70 bg-white/90 px-2 py-1.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] backdrop-blur-md">
          {/* 6 Render Modes */}
          <div className="flex flex-wrap items-center gap-0.5">
            {RENDER_MODE_LABELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setRenderMode(m.id);
                  if (m.id === "EXPLODED" && explodeFactor === 0) {
                    setExplodeFactor(35);
                  }
                }}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-medium transition-all ${
                  renderMode === m.id
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="mx-1 h-4 w-px bg-slate-200" />

          {/* Section Planes Toggle */}
          <button
            type="button"
            onClick={() => setSectionOpen((s) => !s)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-all ${
              sectionOpen
                ? "bg-[#EDE5D8] text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <IconScissors className="h-3 w-3" />
            Corte
          </button>

          {/* Camera Mode: Orbit vs Walk */}
          <button
            type="button"
            onClick={() => setNavMode((n) => (n === "ORBIT" ? "WALK" : "ORBIT"))}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-all ${
              navMode === "WALK"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {navMode === "WALK" ? (
              <>
                <IconFootprints className="h-3 w-3" />
                Passeio
              </>
            ) : (
              <>
                <IconCompass className="h-3 w-3" />
                Órbita
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
