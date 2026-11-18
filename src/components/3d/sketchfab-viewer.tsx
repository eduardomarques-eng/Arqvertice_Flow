"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  GROUND_PRESETS,
  buildProceduralGroundTextures,
  createRadialAlphaTexture,
  type GroundPresetId,
  type ProceduralGroundMaps,
} from "./environments/procedural-ground";
import {
  SKY_PRESETS,
  applySkyEnvironment,
  createAtmosphericSkyDome,
  type SkyPresetId,
} from "./environments/procedural-sky";

export interface ViewerAssetOption {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  glbUrl: string;
}

interface SketchfabViewerProps {
  initialAssets: ViewerAssetOption[];
  initialAssetId?: string;
  initialProjectId?: string;
  initialFileUrl?: string;
  initialTitle?: string;
}

type CameraViewPreset = "persp" | "top" | "front" | "side" | "iso";

function buildDemoPavilion(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Pavilhao_Minimalista_Demo";

  const concreteMat = new THREE.MeshStandardMaterial({
    color: "#D6D3D1",
    roughness: 0.78,
    metalness: 0.04,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: "#27272A",
    roughness: 0.35,
    metalness: 0.85,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: "#92400E",
    roughness: 0.55,
    metalness: 0.02,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: "#E0F2FE",
    roughness: 0.08,
    metalness: 0.0,
    transmission: 0.82,
    ior: 1.5,
    thickness: 0.2,
    transparent: true,
    opacity: 0.92,
  });

  // Base plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 7), concreteMat);
  plinth.position.set(0, 0.175, 0);
  group.add(plinth);

  // Cantilever roof slab
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.32, 7.6), concreteMat);
  roof.position.set(0.4, 3.65, 0);
  group.add(roof);

  // Warm wood soffit under roof
  const soffit = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.06, 7.2), woodMat);
  soffit.position.set(0.4, 3.46, 0);
  group.add(soffit);

  // Structural steel columns
  const colGeo = new THREE.CylinderGeometry(0.11, 0.11, 3.25, 16);
  for (const [cx, cz] of [
    [-4.2, -3.0],
    [4.4, -3.0],
    [-4.2, 3.0],
    [4.4, 3.0],
  ]) {
    const col = new THREE.Mesh(colGeo, darkMetalMat);
    col.position.set(cx, 1.95, cz);
    group.add(col);
  }

  // Rear architectural wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.2, 0.28), concreteMat);
  backWall.position.set(-0.8, 1.95, -2.4);
  group.add(backWall);

  // Glass curtain wall
  const glassWall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.1, 0.08), glassMat);
  glassWall.position.set(0.2, 1.9, 2.3);
  group.add(glassWall);

  // Timber brise-soleil fins
  const finGeo = new THREE.BoxGeometry(0.08, 3.15, 0.35);
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(finGeo, woodMat);
    fin.position.set(3.4 + i * 0.42, 1.92, 1.2);
    group.add(fin);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}

export function SketchfabViewer({
  initialAssets,
  initialAssetId,
  initialProjectId,
  initialFileUrl,
  initialTitle,
}: SketchfabViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedAssetId, setSelectedAssetId] = useState<string>(() => {
    if (initialAssetId) return initialAssetId;
    if (initialProjectId) {
      const match = initialAssets.find((a) => a.projectId === initialProjectId);
      if (match) return match.id;
    }
    return "";
  });
  const [customModel, setCustomModel] = useState<{ url: string; name: string } | null>(
    initialFileUrl
      ? { url: initialFileUrl, name: initialTitle || "Modelo do Projeto (.GLB)" }
      : null
  );

  const [navMode, setNavMode] = useState<"orbit" | "walk">("orbit");
  const [fov, setFov] = useState<number>(45);
  const [skyPreset, setSkyPreset] = useState<SkyPresetId>("morning");
  const [sunAzimuth, setSunAzimuth] = useState<number>(72);
  const [sunElevation, setSunElevation] = useState<number>(28);
  const [groundPreset, setGroundPreset] = useState<GroundPresetId>("concrete");
  const [groundScale, setGroundScale] = useState<number>(10);
  const [showContactShadows, setShowContactShadows] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [openDrawer, setOpenDrawer] = useState<"sky" | "ground" | "views" | "help" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ triangles: number; meshes: number }>({
    triangles: 0,
    meshes: 0,
  });

  // Three.js mutable refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const wireframeGroupRef = useRef<THREE.Group | null>(null);
  const skyMeshRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const pmremRef = useRef<THREE.PMREMGenerator | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const groundMapsRef = useRef<ProceduralGroundMaps | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const modelCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.5, 0));
  const modelRadiusRef = useRef<number>(8);
  const keysPressedRef = useRef<Set<string>>(new Set());

  const activeAsset = initialAssets.find((a) => a.id === selectedAssetId) || null;
  const activeUrl = customModel?.url || activeAsset?.glbUrl || null;
  const activeTitle =
    customModel?.name ||
    (activeAsset ? `${activeAsset.projectName} — ${activeAsset.title}` : "Pavilhão Minimalista (Demo)");

  const frameCamera = useCallback((view: CameraViewPreset = "persp") => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const center = modelCenterRef.current;
    const r = Math.max(4, modelRadiusRef.current);

    if (view === "top") {
      cam.position.set(center.x, center.y + r * 2.2, center.z + 0.01);
    } else if (view === "front") {
      cam.position.set(center.x, center.y + r * 0.25, center.z + r * 2.1);
    } else if (view === "side") {
      cam.position.set(center.x + r * 2.1, center.y + r * 0.25, center.z);
    } else if (view === "iso") {
      cam.position.set(center.x + r * 1.45, center.y + r * 1.25, center.z + r * 1.45);
    } else {
      cam.position.set(center.x + r * 1.5, center.y + r * 0.85, center.z + r * 1.65);
    }
    ctrl.target.copy(center);
    ctrl.update();
  }, []);

  // Initialize WebGL Scene once
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const width = host.clientWidth || 1280;
    const height = host.clientHeight || 720;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
    camera.position.set(11, 6, 13);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.492;
    controls.minDistance = 1.5;
    controls.maxDistance = 140;
    controls.target.set(0, 1.5, 0);
    controls.update();
    controlsRef.current = controls;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    pmremRef.current = pmrem;

    const skyDome = createAtmosphericSkyDome();
    scene.add(skyDome);
    skyMeshRef.current = skyDome;

    const sunLight = new THREE.DirectionalLight("#FFF3D1", 2.3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    const d = 22;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const hemiLight = new THREE.HemisphereLight("#BAE6FD", "#78716C", 0.75);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    // Ground plane with radial fade alphaMap
    const groundGeo = new THREE.PlaneGeometry(140, 140);
    const alphaMap = createRadialAlphaTexture(512);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#FFFFFF",
      roughness: 0.75,
      metalness: 0.04,
      transparent: true,
      alphaMap,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    groundMeshRef.current = groundMesh;

    const grid = new THREE.GridHelper(60, 60, "#71717A", "#D4D4D8");
    grid.position.y = 0.015;
    grid.visible = false;
    scene.add(grid);
    gridHelperRef.current = grid;

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    modelRootRef.current = modelRoot;

    const wireGroup = new THREE.Group();
    wireGroup.visible = false;
    scene.add(wireGroup);
    wireframeGroupRef.current = wireGroup;

    const handleResize = () => {
      if (!host || !rendererRef.current || !cameraRef.current) return;
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(host);

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      keysPressedRef.current.add(k);
      if (k === "f") {
        frameCamera("persp");
      } else if (k === "?") {
        setOpenDrawer((prev) => (prev === "help" ? null : "help"));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let rafId = 0;
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      if (keysPressedRef.current.size > 0 && cameraRef.current && controlsRef.current) {
        const speed = 7.5 * dt;
        cameraRef.current.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, cameraRef.current.up).normalize();

        const move = new THREE.Vector3();
        if (keysPressedRef.current.has("w") || keysPressedRef.current.has("arrowup")) {
          move.addScaledVector(forward, speed);
        }
        if (keysPressedRef.current.has("s") || keysPressedRef.current.has("arrowdown")) {
          move.addScaledVector(forward, -speed);
        }
        if (keysPressedRef.current.has("d") || keysPressedRef.current.has("arrowright")) {
          move.addScaledVector(right, speed);
        }
        if (keysPressedRef.current.has("a") || keysPressedRef.current.has("arrowleft")) {
          move.addScaledVector(right, -speed);
        }
        if (move.lengthSq() > 0) {
          cameraRef.current.position.add(move);
          controlsRef.current.target.add(move);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      controls.dispose();
      groundMapsRef.current?.dispose();
      alphaMap.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      skyDome.geometry.dispose();
      (skyDome.material as THREE.Material).dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [frameCamera]);

  // Update FOV
  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.fov = fov;
    cameraRef.current.updateProjectionMatrix();
  }, [fov]);

  // Update Walk vs Orbit eye height
  useEffect(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    if (navMode === "walk") {
      cam.position.y = 1.65;
      ctrl.target.y = 1.65;
      ctrl.update();
    }
  }, [navMode]);

  // Update Procedural Sky + PMREM IBL
  useEffect(() => {
    if (
      !skyMeshRef.current ||
      !sunLightRef.current ||
      !hemiLightRef.current ||
      !pmremRef.current ||
      !sceneRef.current
    ) {
      return;
    }
    const preset = SKY_PRESETS.find((p) => p.id === skyPreset) || SKY_PRESETS[0];
    applySkyEnvironment({
      skyMesh: skyMeshRef.current,
      sunLight: sunLightRef.current,
      hemiLight: hemiLightRef.current,
      pmremGenerator: pmremRef.current,
      scene: sceneRef.current,
      preset,
      azimuthDeg: sunAzimuth,
      elevationDeg: sunElevation,
    });
    if (modelRootRef.current) {
      modelRootRef.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if ("envMapIntensity" in m) {
              (m as THREE.MeshStandardMaterial).envMapIntensity = preset.envIntensity;
            }
          }
        }
      });
    }
  }, [skyPreset, sunAzimuth, sunElevation]);

  // Update Procedural PBR Ground
  useEffect(() => {
    const ground = groundMeshRef.current;
    if (!ground) return;
    const mat = ground.material as THREE.MeshStandardMaterial;
    const meta = GROUND_PRESETS.find((g) => g.id === groundPreset) || GROUND_PRESETS[0];

    groundMapsRef.current?.dispose();
    const maps = buildProceduralGroundTextures(groundPreset, groundScale);
    groundMapsRef.current = maps;

    mat.map = maps.map;
    mat.normalMap = maps.normalMap;
    mat.roughnessMap = maps.roughnessMap;
    mat.roughness = meta.roughness;
    mat.metalness = meta.metalness;
    mat.needsUpdate = true;
  }, [groundPreset, groundScale]);

  // Toggle shadows, grid, wireframe overlay
  useEffect(() => {
    if (sunLightRef.current) {
      sunLightRef.current.castShadow = showContactShadows;
    }
  }, [showContactShadows]);

  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  useEffect(() => {
    if (wireframeGroupRef.current) {
      wireframeGroupRef.current.visible = showWireframe;
    }
  }, [showWireframe]);

  // Load .GLB or Minimalist Demo Pavilion (preserving 100% of native materials)
  useEffect(() => {
    const root = modelRootRef.current;
    const wireGroup = wireframeGroupRef.current;
    if (!root || !wireGroup) return;

    const clearGroup = (grp: THREE.Group) => {
      while (grp.children.length > 0) {
        const child = grp.children.pop()!;
        grp.remove(child);
        child.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
        });
      }
    };

    clearGroup(root);
    clearGroup(wireGroup);
    setLoadError(null);

    const applyLoadedObject = (obj: THREE.Group) => {
      // Normalize onto ground Y=0 without altering any material colors/maps
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      obj.position.y -= box.min.y;

      let triangles = 0;
      let meshes = 0;
      const wireMat = new THREE.LineBasicMaterial({
        color: "#18181B",
        transparent: true,
        opacity: 0.32,
      });

      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          meshes += 1;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const geom = mesh.geometry;
          if (geom) {
            triangles += geom.index
              ? Math.round(geom.index.count / 3)
              : Math.round((geom.attributes.position?.count || 0) / 3);
            const edges = new THREE.EdgesGeometry(geom, 24);
            const line = new THREE.LineSegments(edges, wireMat);
            mesh.updateWorldMatrix(true, false);
            line.applyMatrix4(mesh.matrixWorld);
            wireGroup.add(line);
          }
        }
      });

      root.add(obj);
      const finalBox = new THREE.Box3().setFromObject(root);
      const finalCenter = new THREE.Vector3();
      const sphere = new THREE.Sphere();
      finalBox.getCenter(finalCenter);
      finalBox.getBoundingSphere(sphere);
      modelCenterRef.current.copy(finalCenter);
      modelRadiusRef.current = Math.max(4, sphere.radius);
      setStats({ triangles, meshes });
      frameCamera("persp");
    };

    if (!activeUrl) {
      applyLoadedObject(buildDemoPavilion());
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      activeUrl,
      (gltf) => {
        if (cancelled) return;
        setIsLoading(false);
        applyLoadedObject(gltf.scene);
      },
      undefined,
      () => {
        if (cancelled) return;
        setIsLoading(false);
        setLoadError("Não foi possível carregar o .GLB selecionado. Exibindo pavilhão demo.");
        applyLoadedObject(buildDemoPavilion());
      }
    );

    return () => {
      cancelled = true;
      draco.dispose();
    };
  }, [activeUrl, frameCamera]);

  const handleLocalGlbFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".glb") && !file.name.toLowerCase().endsWith(".gltf")) {
      setLoadError("Selecione um arquivo .glb ou .gltf válido.");
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setCustomModel({ url: blobUrl, name: file.name });
    setSelectedAssetId("");
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.().catch(() => null);
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.().catch(() => null);
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleLocalGlbFile(file);
      }}
      className="relative w-full h-[calc(100dvh-5rem)] min-h-[540px] overflow-hidden rounded-2xl border border-slate-200/90 dark:border-zinc-700/80 bg-[#09090B] shadow-xl select-none"
    >
      {/* Canvas 3D Full-Bleed */}
      <div ref={canvasHostRef} className="absolute inset-0 w-full h-full" />

      {/* Barra Superior Minimalista */}
      <div className="pointer-events-none absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/85 dark:bg-zinc-900/85 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
          <span className="font-bold text-zinc-900 dark:text-zinc-50 truncate max-w-[200px] sm:max-w-[300px]">
            {activeTitle}
          </span>
          {initialAssets.length > 0 && (
            <select
              aria-label="Selecionar modelo do projeto"
              value={selectedAssetId}
              onChange={(e) => {
                setCustomModel(null);
                setSelectedAssetId(e.target.value);
              }}
              className="h-8 max-w-[180px] rounded-lg px-2 text-[11px] font-medium"
            >
              <option value="">Pavilhão Demo</option>
              {initialAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.projectName} · {a.title}
                </option>
              ))}
            </select>
          )}
          <span className="hidden sm:inline-flex rounded-md bg-[#EDE5D8] dark:bg-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-900 dark:text-zinc-200">
            {stats.triangles.toLocaleString("pt-BR")} tris · {stats.meshes} malhas
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLocalGlbFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[40px] rounded-xl border border-white/20 bg-white/90 dark:bg-zinc-900/90 px-3.5 py-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-lg backdrop-blur-md hover:bg-[#EDE5D8] dark:hover:bg-zinc-800 transition"
          >
            Carregar .GLB
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Tela Cheia"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-white/20 bg-white/90 dark:bg-zinc-900/90 px-3 py-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-lg backdrop-blur-md hover:bg-[#EDE5D8] dark:hover:bg-zinc-800 transition"
          >
            {isFullscreen ? "Sair" : "⛶"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-xs">
          <div className="rounded-xl bg-white/95 dark:bg-zinc-900/95 px-4 py-2.5 text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-lg">
            Carregando geometria e materiais PBR...
          </div>
        </div>
      )}

      {loadError && (
        <div className="pointer-events-auto absolute top-16 left-3 z-20 rounded-xl border border-amber-300 bg-amber-50/95 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow-md">
          {loadError}
        </div>
      )}

      {/* Popovers do Dock Flutuante */}
      {openDrawer && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-white/20 bg-white/92 dark:bg-zinc-900/92 p-4 shadow-2xl backdrop-blur-md text-xs space-y-3">
          {openDrawer === "sky" && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  Céu Atmosférico & Sol (IBL)
                </span>
                <button
                  type="button"
                  onClick={() => setOpenDrawer(null)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {SKY_PRESETS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSkyPreset(s.id);
                      setSunAzimuth(s.defaultAzimuth);
                      setSunElevation(s.defaultElevation);
                    }}
                    className={`rounded-xl border p-2 text-center transition ${
                      skyPreset === s.id
                        ? "border-[#B45309] bg-[#EDE5D8] text-zinc-900 font-bold dark:bg-amber-500/20 dark:text-amber-200"
                        : "border-slate-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span
                      className="mx-auto mb-1 block h-3 w-6 rounded-full"
                      style={{
                        background: `linear-gradient(180deg, ${s.topColor}, ${s.horizonColor})`,
                      }}
                    />
                    <span className="block text-[10px] truncate">{s.shortLabel}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Azimute Solar: {sunAzimuth}°
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={sunAzimuth}
                    onChange={(e) => setSunAzimuth(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Elevação: {sunElevation}°
                  </span>
                  <input
                    type="range"
                    min={2}
                    max={85}
                    value={sunElevation}
                    onChange={(e) => setSunElevation(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            </>
          )}

          {openDrawer === "ground" && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  Piso PBR Procedural & Grade
                </span>
                <button
                  type="button"
                  onClick={() => setOpenDrawer(null)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {GROUND_PRESETS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGroundPreset(g.id);
                      setGroundScale(g.defaultScale);
                    }}
                    className={`rounded-xl border p-2 text-center transition ${
                      groundPreset === g.id
                        ? "border-[#B45309] bg-[#EDE5D8] text-zinc-900 font-bold dark:bg-amber-500/20 dark:text-amber-200"
                        : "border-slate-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span
                      className="mx-auto mb-1 block h-3 w-6 rounded-full border border-black/15"
                      style={{ backgroundColor: g.swatch }}
                    />
                    <span className="block text-[10px] truncate">{g.shortLabel}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex-1 min-w-[140px]">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Escala Textura: {groundScale}x
                  </span>
                  <input
                    type="range"
                    min={2}
                    max={24}
                    value={groundScale}
                    onChange={(e) => setGroundScale(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showContactShadows}
                    onChange={(e) => setShowContactShadows(e.target.checked)}
                  />
                  Sombras
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                  Grade Métrica
                </label>
              </div>
            </>
          )}

          {openDrawer === "views" && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  Vistas & Lente ({fov}°)
                </span>
                <button
                  type="button"
                  onClick={() => setOpenDrawer(null)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    ["persp", "Persp"],
                    ["top", "Topo"],
                    ["front", "Frontal"],
                    ["side", "Lateral"],
                    ["iso", "Iso"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => frameCamera(v)}
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-[#F4F4F8] dark:bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-[#EDE5D8]"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  Campo de Visão (FOV): {fov}°
                </span>
                <input
                  type="range"
                  min={28}
                  max={75}
                  value={fov}
                  onChange={(e) => setFov(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </>
          )}

          {openDrawer === "help" && (
            <div className="space-y-1.5 text-[11px] text-zinc-700 dark:text-zinc-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  Atalhos & Navegação Sketchfab
                </span>
                <button type="button" onClick={() => setOpenDrawer(null)}>
                  ✕
                </button>
              </div>
              <p>• Arrastar (1 dedo / botão esq.): Orbitar modelo</p>
              <p>• Arrastar (2 dedos / botão dir.): Mover (Pan)</p>
              <p>• Scroll / Pinça: Zoom suave</p>
              <p>• W / A / S / D (ou Setas): Passeio 1ª Pessoa (1.65m)</p>
              <p>• Tecla F: Enquadrar modelo • Arraste .GLB para abrir na hora</p>
            </div>
          )}
        </div>
      )}

      {/* Dock Inferior Flutuante Estilo Sketchfab */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex justify-center">
        <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto scrollbar-none rounded-2xl border border-white/20 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setNavMode((m) => (m === "orbit" ? "walk" : "orbit"))}
            className={`min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              navMode === "walk"
                ? "bg-[#B45309] text-white"
                : "text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {navMode === "walk" ? "🚶 Passeio 1.65m" : "🌀 Órbita"}
          </button>

          <button
            type="button"
            onClick={() => frameCamera("persp")}
            title="Enquadrar Modelo (F)"
            className="min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ⌖ Enquadrar
          </button>

          <button
            type="button"
            onClick={() => setOpenDrawer((d) => (d === "views" ? null : "views"))}
            className={`min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              openDrawer === "views"
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            🎥 Vistas
          </button>

          <button
            type="button"
            onClick={() => setOpenDrawer((d) => (d === "sky" ? null : "sky"))}
            className={`min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              openDrawer === "sky"
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            ☀️ Céu
          </button>

          <button
            type="button"
            onClick={() => setOpenDrawer((d) => (d === "ground" ? null : "ground"))}
            className={`min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              openDrawer === "ground"
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            🪨 Chão
          </button>

          <button
            type="button"
            onClick={() => setShowWireframe((w) => !w)}
            title="Inspeção de Malha (Sem alterar materiais)"
            className={`min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              showWireframe
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            ⌗ Malha
          </button>

          <button
            type="button"
            onClick={() => setOpenDrawer((d) => (d === "help" ? null : "help"))}
            title="Atalhos (?)"
            className="min-h-[40px] min-w-[40px] shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
}
