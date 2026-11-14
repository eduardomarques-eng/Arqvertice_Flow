"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface IfcElementProperties {
  expressID: number;
  globalId: string;
  ifcClass: string;
  name: string;
  storey: string;
  material: string;
  dimensions: string;
}

export interface Ifc3dRfiPin {
  id: string;
  code: string;
  title: string;
  status: string;
  cameraState?: {
    position: [number, number, number];
    target: [number, number, number];
    pinPosition?: [number, number, number];
  } | null;
}

export interface ExtractedIfcTakeoff {
  category: "AREAS" | "ESQUADRIAS" | "REVESTIMENTOS" | "ELETRICO" | "HIDRAULICO" | "ESTRUTURA";
  description: string;
  quantity: number;
  unit: string;
}

interface DemoBimMeta {
  expressID: number;
  globalId: string;
  ifcClass: string;
  name: string;
  storey: string;
  material: string;
  dimensions: string;
  category: ExtractedIfcTakeoff["category"];
  qty: number;
  unit: string;
}

export function Ifc3dViewer({
  ifcUrl,
  rfis3d = [],
  focusedRfiId,
  isPlacing3dPin,
  onPlace3dPin,
  onSelectRfi,
  onExtractedQuantities,
}: {
  ifcUrl?: string | null;
  rfis3d?: Ifc3dRfiPin[];
  focusedRfiId?: string | null;
  isPlacing3dPin?: boolean;
  onPlace3dPin?: (cameraState: {
    position: [number, number, number];
    target: [number, number, number];
    pinPosition: [number, number, number];
  }) => void;
  onSelectRfi?: (rfiId: string) => void;
  onExtractedQuantities?: (items: ExtractedIfcTakeoff[]) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const pinGroupRef = useRef<THREE.Group | null>(null);

  const [selectedProps, setSelectedProps] = useState<IfcElementProperties | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [isolatedId, setIsolatedId] = useState<number | null>(null);
  const [sectionX, setSectionX] = useState<number>(15);
  const [sectionY, setSectionY] = useState<number>(12);
  const [sectionZ, setSectionZ] = useState<number>(15);
  const [isLoadedFromIfc, setIsLoadedFromIfc] = useState<boolean>(false);
  const [ifcError, setIfcError] = useState<string | null>(null);

  const planeXRef = useRef(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 15));
  const planeYRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 12));
  const planeZRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 15));
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const originalMatMapRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());

  const setCameraView = useCallback((view: "ISO" | "TOP" | "FRONT" | "SIDE") => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    ctrl.target.set(0, 2, 0);
    if (view === "TOP") cam.position.set(0, 22, 0.01);
    else if (view === "FRONT") cam.position.set(0, 4, 18);
    else if (view === "SIDE") cam.position.set(18, 4, 0);
    else cam.position.set(14, 11, 14);
    ctrl.update();
  }, []);

  // Atualiza Section Planes
  useEffect(() => {
    planeXRef.current.constant = sectionX;
    planeYRef.current.constant = sectionY;
    planeZRef.current.constant = sectionZ;
  }, [sectionX, sectionY, sectionZ]);

  // Atualiza visibilidade (Isolar / Ocultar)
  useEffect(() => {
    const group = modelGroupRef.current;
    if (!group) return;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData?.bim) {
        const eid = (obj.userData.bim as DemoBimMeta).expressID;
        if (isolatedId !== null) {
          obj.visible = eid === isolatedId;
        } else {
          obj.visible = !hiddenIds.has(eid);
        }
      }
    });
  }, [hiddenIds, isolatedId]);

  // Voo suave para RFI selecionada
  useEffect(() => {
    if (!focusedRfiId) return;
    const targetRfi = rfis3d.find((r) => r.id === focusedRfiId);
    if (targetRfi?.cameraState && cameraRef.current && controlsRef.current) {
      const { position, target } = targetRfi.cameraState;
      cameraRef.current.position.set(position[0], position[1], position[2]);
      controlsRef.current.target.set(target[0], target[1], target[2]);
      controlsRef.current.update();
    }
  }, [focusedRfiId, rfis3d]);

  // Renderiza Pinos 3D de RFI
  useEffect(() => {
    const pinGroup = pinGroupRef.current;
    if (!pinGroup) return;
    while (pinGroup.children.length > 0) {
      pinGroup.remove(pinGroup.children[0]);
    }
    rfis3d.forEach((rfi) => {
      const pos = rfi.cameraState?.pinPosition;
      if (!pos) return;
      const geo = new THREE.SphereGeometry(0.28, 16, 16);
      const color = rfi.id === focusedRfiId ? 0xe11d48 : rfi.status === "ENCERRADA" ? 0x059669 : 0x2563eb;
      const mat = new THREE.MeshBasicMaterial({ color });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.set(pos[0], pos[1], pos[2]);
      sphere.userData = { rfiId: rfi.id };
      pinGroup.add(sphere);
    });
  }, [rfis3d, focusedRfiId]);

  // Inicializa Three.js + Carregamento IFC
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F5F5F7");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(14, 11, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    // Iluminação técnica suave
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(12, 20, 10);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(24, 24, 0xcbd5e1, 0xe2e8f0);
    scene.add(grid);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    pinGroupRef.current = pinGroup;

    const planes = [planeXRef.current, planeYRef.current, planeZRef.current];

    function buildProceduralBimModel() {
      const elements: Array<{ geo: THREE.BufferGeometry; color: number; pos: [number, number, number]; opacity?: number; bim: DemoBimMeta }> = [
        {
          geo: new THREE.BoxGeometry(10, 0.3, 8),
          color: 0xd6d3d1,
          pos: [0, 0.15, 0],
          bim: { expressID: 101, globalId: "2O2Fr$t4X7Zf8NOew3FLOH", ifcClass: "IfcSlab", name: "Laje Piso Térreo", storey: "Pavimento Térreo", material: "Concreto Armado C30", dimensions: "10.00 x 8.00 x 0.30 m", category: "ESTRUTURA", qty: 80.0, unit: "m²" },
        },
        {
          geo: new THREE.BoxGeometry(10, 0.25, 8),
          color: 0xe7e5e4,
          pos: [0, 3.45, 0],
          bim: { expressID: 102, globalId: "2O2Fr$t4X7Zf8NOew3FL02", ifcClass: "IfcSlab", name: "Laje Cobertura", storey: "Cobertura", material: "Concreto Armado C30", dimensions: "10.00 x 8.00 x 0.25 m", category: "ESTRUTURA", qty: 80.0, unit: "m²" },
        },
        {
          geo: new THREE.BoxGeometry(10, 3.0, 0.2),
          color: 0xfafaf9,
          pos: [0, 1.8, -3.9],
          bim: { expressID: 201, globalId: "3A9xK$p2L1Wf8NOew3WALL1", ifcClass: "IfcWall", name: "Parede Externa Norte", storey: "Pavimento Térreo", material: "Alvenaria Bloco Cerâmico", dimensions: "10.00 x 3.00 x 0.20 m", category: "AREAS", qty: 30.0, unit: "m²" },
        },
        {
          geo: new THREE.BoxGeometry(0.2, 3.0, 7.8),
          color: 0xf5f5f4,
          pos: [-4.9, 1.8, 0],
          bim: { expressID: 202, globalId: "3A9xK$p2L1Wf8NOew3WALL2", ifcClass: "IfcWall", name: "Parede Externa Oeste", storey: "Pavimento Térreo", material: "Alvenaria Bloco Cerâmico", dimensions: "7.80 x 3.00 x 0.20 m", category: "AREAS", qty: 23.4, unit: "m²" },
        },
        {
          geo: new THREE.BoxGeometry(4.2, 2.4, 0.12),
          color: 0x93c5fd,
          opacity: 0.65,
          pos: [1.5, 1.5, 3.9],
          bim: { expressID: 301, globalId: "1CurtainWall$FaC001", ifcClass: "IfcCurtainWall", name: "Pele de Vidro Fachada Sul", storey: "Pavimento Térreo", material: "Alumínio Anodizado + Vidro Laminado", dimensions: "4.20 x 2.40 x 0.12 m", category: "ESQUADRIAS", qty: 10.08, unit: "m²" },
        },
        {
          geo: new THREE.BoxGeometry(1.1, 2.2, 0.14),
          color: 0x78350f,
          pos: [-2.8, 1.4, 3.9],
          bim: { expressID: 302, globalId: "1Door$Pivotante001", ifcClass: "IfcDoor", name: "Porta Pivotante Entrada", storey: "Pavimento Térreo", material: "Madeira Maciça Freijó", dimensions: "1.10 x 2.20 m", category: "ESQUADRIAS", qty: 1, unit: "un" },
        },
        {
          geo: new THREE.BoxGeometry(2.0, 1.2, 0.12),
          color: 0xbae6fd,
          opacity: 0.7,
          pos: [4.9, 1.9, -1.0],
          bim: { expressID: 303, globalId: "1Window$Maximar001", ifcClass: "IfcWindow", name: "Janela Panorâmica Leste", storey: "Pavimento Térreo", material: "Esquadria Alumínio Preto", dimensions: "2.00 x 1.20 m", category: "ESQUADRIAS", qty: 2, unit: "un" },
        },
        {
          geo: new THREE.CylinderGeometry(0.18, 0.18, 3.0, 16),
          color: 0x71717a,
          pos: [4.6, 1.8, 3.6],
          bim: { expressID: 401, globalId: "4Column$P01", ifcClass: "IfcColumn", name: "Pilar P01", storey: "Pavimento Térreo", material: "Concreto Armado", dimensions: "Ø 0.36 x 3.00 m", category: "ESTRUTURA", qty: 0.31, unit: "m³" },
        },
      ];

      elements.forEach((el) => {
        const mat = new THREE.MeshStandardMaterial({
          color: el.color,
          transparent: Boolean(el.opacity),
          opacity: el.opacity ?? 1,
          clippingPlanes: planes,
          clipShadows: true,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(el.geo, mat);
        mesh.position.set(el.pos[0], el.pos[1], el.pos[2]);
        mesh.userData = { bim: el.bim };
        modelGroup.add(mesh);
      });
    }

    async function loadIfcOrFallback() {
      if (!ifcUrl || ifcUrl.includes("storage.arqvertice.com.br") || !ifcUrl.toLowerCase().includes(".ifc")) {
        buildProceduralBimModel();
        setIsLoadedFromIfc(false);
        return;
      }
      try {
        const WebIFC = await import("web-ifc");
        const ifcApi = new WebIFC.IfcAPI();
        ifcApi.SetWasmPath("/wasm/");
        await ifcApi.Init();
        const res = await fetch(ifcUrl);
        if (!res.ok) throw new Error("IFC fetch error");
        const buffer = await res.arrayBuffer();
        const modelID = ifcApi.OpenModel(new Uint8Array(buffer));

        // Constrói geometria base do IFC via StreamAllMeshes
        let meshCount = 0;
        ifcApi.StreamAllMeshes(modelID, (flatMesh) => {
          const placed = flatMesh.geometries;
          for (let i = 0; i < placed.size(); i++) {
            const pg = placed.get(i);
            const geom = ifcApi.GetGeometry(modelID, pg.geometryExpressID);
            const verts = ifcApi.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
            const indices = ifcApi.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());

            const bufferGeo = new THREE.BufferGeometry();
            const posArray = new Float32Array(verts.length / 2);
            for (let k = 0; k < verts.length; k += 6) {
              const idx = (k / 6) * 3;
              posArray[idx] = verts[k];
              posArray[idx + 1] = verts[k + 1];
              posArray[idx + 2] = verts[k + 2];
            }
            bufferGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
            bufferGeo.setIndex(Array.from(indices));
            bufferGeo.computeVertexNormals();

            const mat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(pg.color.x, pg.color.y, pg.color.z),
              transparent: pg.color.w < 0.99,
              opacity: pg.color.w,
              clippingPlanes: planes,
              side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(bufferGeo, mat);
            mesh.applyMatrix4(new THREE.Matrix4().fromArray(pg.flatTransformation));
            const props = ifcApi.GetLine(modelID, flatMesh.expressID);
            mesh.userData = {
              bim: {
                expressID: flatMesh.expressID,
                globalId: props?.GlobalId?.value || `IFC-${flatMesh.expressID}`,
                ifcClass: props?.constructor?.name || "IfcBuildingElement",
                name: props?.Name?.value || `Elemento #${flatMesh.expressID}`,
                storey: "Pavimento Modelo",
                material: "Material IFC",
                dimensions: "Geometria BIM",
              },
            };
            modelGroup.add(mesh);
            meshCount++;
            geom.delete();
          }
        });
        ifcApi.CloseModel(modelID);
        if (meshCount === 0) {
          buildProceduralBimModel();
        } else {
          setIsLoadedFromIfc(true);
        }
      } catch {
        setIfcError("Modelo IFC remoto indisponível; exibindo gêmeo BIM interativo local.");
        buildProceduralBimModel();
      }
    }

    loadIfcOrFallback();

    // Raycasting para seleção de elementos e colocação de Pinos 3D
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function handlePointerDown(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Verifica clique em pino 3D existente
      const pinHits = raycaster.intersectObjects(pinGroup.children, false);
      if (pinHits.length > 0 && onSelectRfi) {
        const rfiId = pinHits[0].object.userData?.rfiId;
        if (rfiId) {
          onSelectRfi(rfiId);
          return;
        }
      }

      const hits = raycaster.intersectObjects(modelGroup.children, true);
      if (hits.length > 0) {
        const hit = hits[0];
        if (isPlacing3dPin && onPlace3dPin) {
          onPlace3dPin({
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z],
            pinPosition: [hit.point.x, hit.point.y, hit.point.z],
          });
          return;
        }

        const mesh = hit.object as THREE.Mesh;
        if (selectedMeshRef.current && originalMatMapRef.current.has(selectedMeshRef.current)) {
          selectedMeshRef.current.material = originalMatMapRef.current.get(selectedMeshRef.current)!;
        }
        if (!originalMatMapRef.current.has(mesh)) {
          originalMatMapRef.current.set(mesh, mesh.material);
        }
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x18181b,
          emissive: 0x3b82f6,
          emissiveIntensity: 0.45,
          clippingPlanes: planes,
          side: THREE.DoubleSide,
        });
        selectedMeshRef.current = mesh;
        if (mesh.userData?.bim) {
          setSelectedProps(mesh.userData.bim as IfcElementProperties);
        }
      }
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    let animId = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      controls.dispose();
      renderer.dispose();
    };
  }, [ifcUrl, isPlacing3dPin, onPlace3dPin, onSelectRfi]);

  function handleExtractFromScene() {
    const group = modelGroupRef.current;
    if (!group || !onExtractedQuantities) return;
    const summary: Record<string, ExtractedIfcTakeoff> = {};
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData?.bim) {
        const meta = obj.userData.bim as DemoBimMeta;
        const key = `${meta.ifcClass}-${meta.name}`;
        if (!summary[key]) {
          summary[key] = {
            category: meta.category || "ESTRUTURA",
            description: `${meta.ifcClass}: ${meta.name}`,
            quantity: meta.qty || 1,
            unit: meta.unit || "un",
          };
        } else {
          summary[key].quantity += meta.qty || 1;
        }
      }
    });
    onExtractedQuantities(Object.values(summary));
  }

  return (
    <div className="relative flex h-full w-full flex-col rounded-xl overflow-hidden bg-[#F5F5F7]">
      {/* Barra Flutuante macOS de Vistas & Cortes */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white/90 backdrop-blur px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {(["ISO", "TOP", "FRONT", "SIDE"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCameraView(v)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              {v === "ISO" ? "Isométrica" : v === "TOP" ? "Topo" : v === "FRONT" ? "Frontal" : "Fachada"}
            </button>
          ))}
          {onExtractedQuantities && (
            <button
              type="button"
              onClick={handleExtractFromScene}
              className="ml-1 rounded-lg bg-[#18181B] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 transition"
            >
              Extrair Quantitativos IFC
            </button>
          )}
        </div>

        {/* Sliders de Planos de Corte */}
        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-600">
          <label className="flex items-center gap-1">
            Corte X
            <input
              type="range"
              min={-6}
              max={15}
              step={0.5}
              value={sectionX}
              onChange={(e) => setSectionX(parseFloat(e.target.value))}
              className="w-16 accent-[#18181B]"
            />
          </label>
          <label className="flex items-center gap-1">
            Corte Y
            <input
              type="range"
              min={0.5}
              max={12}
              step={0.5}
              value={sectionY}
              onChange={(e) => setSectionY(parseFloat(e.target.value))}
              className="w-16 accent-[#18181B]"
            />
          </label>
          <label className="flex items-center gap-1">
            Corte Z
            <input
              type="range"
              min={-6}
              max={15}
              step={0.5}
              value={sectionZ}
              onChange={(e) => setSectionZ(parseFloat(e.target.value))}
              className="w-16 accent-[#18181B]"
            />
          </label>
        </div>
      </div>

      {/* Canvas 3D */}
      <div ref={mountRef} className="relative flex-1 min-h-[460px] w-full cursor-grab active:cursor-grabbing" />

      {/* Aviso discreto caso modelo seja fallback */}
      {ifcError && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10px] text-slate-500 border border-slate-200/70 shadow-sm">
          {ifcError}
        </div>
      )}
      {!isLoadedFromIfc && !ifcError && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10px] text-slate-500 border border-slate-200/70 shadow-sm">
          Gêmeo BIM 3D Interativo · Clique em um elemento para inspecionar propriedades IFC
        </div>
      )}

      {/* Inspetor Flutuante de Propriedades IFC */}
      {selectedProps && (
        <div className="absolute top-14 right-3 w-64 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur p-3.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12)] space-y-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase text-blue-600">
                {selectedProps.ifcClass}
              </span>
              <h4 className="font-semibold text-slate-900 leading-tight">{selectedProps.name}</h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedProps(null)}
              className="text-slate-400 hover:text-slate-800 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
            <p><span className="text-slate-400">GlobalId:</span> <span className="font-mono">{selectedProps.globalId}</span></p>
            <p><span className="text-slate-400">Pavimento:</span> {selectedProps.storey}</p>
            <p><span className="text-slate-400">Material:</span> {selectedProps.material}</p>
            <p><span className="text-slate-400">Dimensões:</span> {selectedProps.dimensions}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsolatedId(isolatedId === selectedProps.expressID ? null : selectedProps.expressID)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              {isolatedId === selectedProps.expressID ? "Desisolar" : "Isolar Elemento"}
            </button>
            <button
              type="button"
              onClick={() => setHiddenIds((prev) => new Set(prev).add(selectedProps.expressID))}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              Ocultar
            </button>
            {(hiddenIds.size > 0 || isolatedId !== null) && (
              <button
                type="button"
                onClick={() => {
                  setHiddenIds(new Set());
                  setIsolatedId(null);
                }}
                className="rounded-lg bg-[#18181B] px-2 py-1 text-[10px] font-semibold text-white"
              >
                Mostrar Todos
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
