"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  DEFAULT_3D_TEMPLATES_MANIFEST,
  classifyMaterialToPbrPreset,
  type SmartPbrShaderPreset,
  type Template3DHdriEntry,
  type Template3DModelEntry,
} from "@/lib/acervo/scene-compiler";
import type { Project3DAnnotation } from "@/lib/acervo/showcase-3d-defaults";
import { updateStudioCameraFrame, type StudioCameraMode } from "./StudioCameraRig";

export type { StudioCameraMode };
export type StudioVisualMode = "realista-pbr-rt" | "clay-maquete" | "tecnico-arestas" | "wireframe";
export type RenderPipelineStage = "NAVIGATING_60FPS" | "CONVERGING_RT_GI" | "CONVERGED_IDLE_0GPU";

export interface Studio3DAssetInput {
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  title: string;
  description?: string | null;
  category?: string;
  sourcePath?: string;
  glbUrl: string | null;
  usdzUrl?: string | null;
  status?: "READY" | "NEEDS_EXPORT";
  diagnostics?: string[];
  posterUrl?: string | null;
  defaultHdriId?: string;
  firstPersonCamera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
  thirdPersonCamera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
  annotations?: Project3DAnnotation[];
  stats?: {
    originalBytes?: number;
    optimizedBytes?: number;
    drawCalls?: number;
    triangles?: number;
  };
}

export interface Studio3DFullscreenEngineProps {
  initialAsset: Studio3DAssetInput;
  availableAssets?: Studio3DAssetInput[];
  returnHref: string;
  returnLabel?: string;
  pipelineHref?: string;
  userRole?: string;
}

interface StoredOriginalMaterial {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  pbrMaterial: THREE.MeshPhysicalMaterial;
  preset: SmartPbrShaderPreset;
}

export default function Studio3DFullscreenEngine({
  initialAsset,
  availableAssets,
  returnHref,
  returnLabel = "Voltar ao Acervo",
  pipelineHref = "/admin/acervo/pipeline-3d",
  userRole,
}: Studio3DFullscreenEngineProps) {
  const catalogAssets = useMemo<Studio3DAssetInput[]>(() => {
    const baseTemplates: Studio3DAssetInput[] = DEFAULT_3D_TEMPLATES_MANIFEST.models
      .filter((tpl: Template3DModelEntry) => Boolean(tpl.glbUrl) && tpl.status !== "NEEDS_EXPORT")
      .map((tpl: Template3DModelEntry) => ({
        id: tpl.id,
        projectId: initialAsset.projectId ?? null,
        projectName: initialAsset.projectName ?? "Acervo Manager CDE",
        title: tpl.title,
        description: tpl.subtitle,
        category: tpl.category,
        sourcePath: tpl.sourcePath,
        glbUrl: tpl.glbUrl,
        usdzUrl: tpl.usdzUrl ?? null,
        status: tpl.status ?? "READY",
        diagnostics: tpl.diagnostics,
        posterUrl: tpl.posterUrl,
        defaultHdriId: tpl.defaultHdriId,
        firstPersonCamera: tpl.normalization.firstPersonCamera,
        thirdPersonCamera: tpl.normalization.thirdPersonCamera,
        annotations: tpl.annotations,
        stats: {
          originalBytes: tpl.optimizationStats.originalBytes,
          optimizedBytes: tpl.optimizationStats.optimizedBytes,
          drawCalls: tpl.optimizationStats.drawCalls,
          triangles: Math.round(tpl.optimizationStats.vertexCount / 3),
        },
      }));

    const merged: Studio3DAssetInput[] = initialAsset.glbUrl ? [initialAsset] : [];
    if (availableAssets && availableAssets.length > 0) {
      for (const item of availableAssets) {
        if (item.glbUrl && !merged.some((m) => m.id === item.id || m.glbUrl === item.glbUrl)) {
          merged.push(item);
        }
      }
    }
    for (const tpl of baseTemplates) {
      if (!merged.some((m) => m.id === tpl.id || m.glbUrl === tpl.glbUrl)) {
        merged.push(tpl);
      }
    }
    return merged;
  }, [initialAsset, availableAssets]);

  const avatarCatalog = useMemo(
    () => DEFAULT_3D_TEMPLATES_MANIFEST.avatars || [],
    []
  );

  const hdriCatalog = useMemo<Template3DHdriEntry[]>(
    () => DEFAULT_3D_TEMPLATES_MANIFEST.hdris,
    []
  );

  const [activeAsset, setActiveAsset] = useState<Studio3DAssetInput>(initialAsset);
  const [cameraMode, setCameraMode] = useState<StudioCameraMode>("third-person");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("none");
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const [arNotice, setArNotice] = useState<string | null>(null);
  const [visualMode, setVisualMode] = useState<StudioVisualMode>("realista-pbr-rt");
  const [turntable, setTurntable] = useState<boolean>(false);
  const [activeHdriId, setActiveHdriId] = useState<string>(
    initialAsset.defaultHdriId || "dia-claro"
  );
  const [sunAzimuthDeg, setSunAzimuthDeg] = useState<number>(48);
  const [sunElevationDeg, setSunElevationDeg] = useState<number>(52);
  const [exposure, setExposure] = useState<number>(1.12);
  const [giAoIntensity, setGiAoIntensity] = useState<number>(1.15);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [selectedPin, setSelectedPin] = useState<Project3DAnnotation | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<"none" | "lighting" | "models" | "shaders">("none");

  const [pipelineStage, setPipelineStage] = useState<RenderPipelineStage>("NAVIGATING_60FPS");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hudIdle, setHudIdle] = useState<boolean>(false);
  const [shaderBreakdown, setShaderBreakdown] = useState<Record<string, number>>({});
  const [projectedPins, setProjectedPins] = useState<
    Array<{ pin: Project3DAnnotation; x: number; y: number; visible: boolean }>
  >([]);

  // Touch joystick state for 1st person mobile navigation
  const [joystickOffset, setJoystickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickVectorRef = useRef<{ forward: number; right: number }>({ forward: 0, right: 0 });

  // WebGL & Three.js refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rtOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.HemisphereLight | null>(null);
  const envGroupRef = useRef<THREE.Group | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const avatarRootRef = useRef<THREE.Group | null>(null);
  const edgeLinesGroupRef = useRef<THREE.Group | null>(null);
  const teleportRingRef = useRef<THREE.Mesh | null>(null);
  const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);
  const currentEnvMapRef = useRef<THREE.Texture | null>(null);
  const storedMaterialsRef = useRef<StoredOriginalMaterial[]>([]);

  // Demand-driven 2-stage rendering loop refs
  const rafIdRef = useRef<number | null>(null);
  const lastInteractionTimeRef = useRef<number>(performance.now());
  const hudIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<RenderPipelineStage>("NAVIGATING_60FPS");
  const needsRenderRef = useRef<boolean>(true);
  const rtPassCompletedRef = useRef<boolean>(false);

  // Camera state (supports both 3rd-person spherical orbit and 1st-person eye walk)
  const camStateRef = useRef({
    mode: "third-person" as StudioCameraMode,
    // 3rd person spherical coordinates around target
    spherical: new THREE.Spherical(9.5, Math.PI / 2.65, Math.PI / 4),
    target: new THREE.Vector3(0, 1.15, 0),
    desiredTarget: new THREE.Vector3(0, 1.15, 0),
    desiredRadius: 9.5,
    desiredPhi: Math.PI / 2.65,
    desiredTheta: Math.PI / 4,
    // 1st person coordinates (human eye height Y = 1.65m)
    fpPosition: new THREE.Vector3(0, 1.65, 3.6),
    fpDesiredPosition: new THREE.Vector3(0, 1.65, 3.6),
    fpYaw: 0,
    fpPitch: -0.05,
    fpDesiredYaw: 0,
    fpDesiredPitch: -0.05,
    // Pointer interaction
    isDragging: false,
    isPanning: false,
    pointerDownPos: { x: 0, y: 0 },
    prevPointer: { x: 0, y: 0 },
    keysPressed: new Set<string>(),
    teleportRingTimer: 0,
  });

  // Auto-hide HUD after 3 seconds of inactivity
  const registerUserActivity = useCallback(() => {
    setHudIdle(false);
    if (hudIdleTimerRef.current) {
      clearTimeout(hudIdleTimerRef.current);
    }
    hudIdleTimerRef.current = setTimeout(() => {
      setHudIdle(true);
    }, 3000);
  }, []);

  // Wake up the demand render loop (Stage 1: 60 FPS Navigation)
  const wakeRenderLoop = useCallback(() => {
    lastInteractionTimeRef.current = performance.now();
    needsRenderRef.current = true;
    rtPassCompletedRef.current = false;
    if (stageRef.current !== "NAVIGATING_60FPS") {
      stageRef.current = "NAVIGATING_60FPS";
      setPipelineStage("NAVIGATING_60FPS");
      if (rendererRef.current && typeof window !== "undefined") {
        const agileDpr = Math.min(window.devicePixelRatio || 1, 1.5);
        if (rendererRef.current.getPixelRatio() !== agileDpr) {
          rendererRef.current.setPixelRatio(agileDpr);
        }
      }
      if (rtOverlayCanvasRef.current) {
        const ctx = rtOverlayCanvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, rtOverlayCanvasRef.current.width, rtOverlayCanvasRef.current.height);
        }
      }
    }
  }, []);

  // Dispose helper for strict WebGL memory cleanup
  const disposeObject3D = useCallback((obj: THREE.Object3D | null) => {
    if (!obj) return;
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          for (const value of Object.values(mat)) {
            if (value && typeof value === "object" && "isTexture" in value) {
              (value as THREE.Texture).dispose();
            }
          }
          mat.dispose();
        }
      }
    });
  }, []);

  // Apply Stage 2 Screen-Space Ray Tracing / Contact AO / Soft GI Post-Process Convergence Pass
  const executeStage2RayTracingPass = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const overlay = rtOverlayCanvasRef.current;
    if (!renderer || !scene || !camera || !overlay) return;

    // Upsample to high-DPI retina (dpr = 2)
    const highDpr = Math.min(window.devicePixelRatio || 1, 2.0);
    renderer.setPixelRatio(highDpr);
    renderer.render(scene, camera);

    // Synthesize Screen-Space Contact AO + Specular GI Bloom on the overlay canvas
    const glCanvas = renderer.domElement;
    overlay.width = glCanvas.width;
    overlay.height = glCanvas.height;
    const ctx = overlay.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (visualMode === "realista-pbr-rt" && giAoIntensity > 0.05) {
        ctx.save();
        // Soft Indirect GI Bounce + Specular Highlight Bloom
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = Math.min(0.22 * giAoIntensity, 0.35);
        ctx.filter = "blur(18px) contrast(125%)";
        ctx.drawImage(glCanvas, 0, 0, overlay.width, overlay.height);

        // Contact Ambient Occlusion & Subtle Architectural Vignette
        ctx.filter = "none";
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = Math.min(0.28 * giAoIntensity, 0.45);
        const grad = ctx.createRadialGradient(
          overlay.width * 0.5,
          overlay.height * 0.5,
          overlay.width * 0.22,
          overlay.width * 0.5,
          overlay.height * 0.5,
          overlay.width * 0.72
        );
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(1, "rgba(18,18,24,0.88)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, overlay.width, overlay.height);
        ctx.restore();
      }
    }
  }, [visualMode, giAoIntensity]);

  // Apply Visual Mode (Realista PBR+RT / Maquete Clay / Técnico Arestas / Wireframe)
  const applyVisualModeToMaterials = useCallback(
    (mode: StudioVisualMode) => {
      const clayMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#EFECE6"),
        roughness: 0.78,
        metalness: 0.02,
        clearcoat: 0.05,
        envMapIntensity: 0.85 * giAoIntensity,
      });

      const techMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#F7F7F9"),
        roughness: 0.62,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        envMapIntensity: 0.9,
      });

      for (const entry of storedMaterialsRef.current) {
        const { mesh, pbrMaterial } = entry;
        if (mode === "realista-pbr-rt") {
          pbrMaterial.wireframe = false;
          pbrMaterial.envMapIntensity = entry.preset.reflectivity * 1.35 * giAoIntensity;
          mesh.material = pbrMaterial;
        } else if (mode === "clay-maquete") {
          mesh.material = clayMaterial;
        } else if (mode === "tecnico-arestas") {
          mesh.material = techMaterial;
        } else if (mode === "wireframe") {
          pbrMaterial.wireframe = true;
          mesh.material = pbrMaterial;
        }
      }

      if (edgeLinesGroupRef.current) {
        edgeLinesGroupRef.current.visible = mode === "tecnico-arestas";
      }

      wakeRenderLoop();
    },
    [giAoIntensity, wakeRenderLoop]
  );

  // Load HDRI from /assets/3d-templates/hdri/{slug}.hdr with RGBELoader + PMREMGenerator
  const loadHdriEnvironment = useCallback(
    (hdriId: string) => {
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      const pmrem = pmremGeneratorRef.current;
      if (!scene || !renderer || !pmrem) return;

      const entry =
        hdriCatalog.find((h) => h.id === hdriId) || hdriCatalog[0];
      if (!entry) return;

      setSunAzimuthDeg(entry.sunAzimuthDeg);
      setSunElevationDeg(entry.sunElevationDeg);
      setExposure(entry.exposureDefault);

      const rgbeLoader = new RGBELoader();
      rgbeLoader.load(
        entry.compiledUrl,
        (hdrTexture) => {
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
          hdrTexture.dispose();

          if (currentEnvMapRef.current) {
            currentEnvMapRef.current.dispose();
          }
          currentEnvMapRef.current = envMap;
          scene.environment = envMap;
          wakeRenderLoop();
        },
        undefined,
        () => {
          // Fallback to procedural RoomEnvironment if HDR file fails to fetch
          const fallbackEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          if (currentEnvMapRef.current) {
            currentEnvMapRef.current.dispose();
          }
          currentEnvMapRef.current = fallbackEnv;
          scene.environment = fallbackEnv;
          wakeRenderLoop();
        }
      );
    },
    [hdriCatalog, wakeRenderLoop]
  );

  // Load and normalize 3D model + compile Smart PBR Shaders
  const loadAssetModel = useCallback(
    (asset: Studio3DAssetInput) => {
      const scene = sceneRef.current;
      if (!scene) return;

      setIsLoaded(false);
      setLoadError(null);
      setLoadingProgress(12);
      setSelectedPin(null);

      // Strict cleanup of previous model & edges
      if (modelRootRef.current) {
        scene.remove(modelRootRef.current);
        disposeObject3D(modelRootRef.current);
        modelRootRef.current = null;
      }
      if (edgeLinesGroupRef.current) {
        scene.remove(edgeLinesGroupRef.current);
        disposeObject3D(edgeLinesGroupRef.current);
        edgeLinesGroupRef.current = null;
      }
      storedMaterialsRef.current = [];

      if (!asset.glbUrl) {
        setIsLoaded(true);
        setLoadingProgress(100);
        setLoadError(null);
        return;
      }

      const loader = new GLTFLoader();
      try {
        loader.setMeshoptDecoder(MeshoptDecoder);
      } catch {
        // Safe fallback if decoder already initialized
      }

      loader.load(
        asset.glbUrl,
        (gltf) => {
          const root = gltf.scene || new THREE.Group();

          // Universal Scene Normalization check: center at (0,0,0) with floor at Y = 0
          const rawBox = new THREE.Box3().setFromObject(root);
          if (!rawBox.isEmpty()) {
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            rawBox.getSize(size);
            rawBox.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            let scale = 1.0;
            if (maxDim > 800) {
              scale = 0.001; // mm -> m
            } else if (maxDim > 45) {
              scale = 0.01; // cm -> m
            }
            root.scale.setScalar(scale);
            root.updateMatrixWorld(true);

            const scaledBox = new THREE.Box3().setFromObject(root);
            const scaledCenter = new THREE.Vector3();
            scaledBox.getCenter(scaledCenter);
            root.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
            root.updateMatrixWorld(true);
          }

          const edgesGroup = new THREE.Group();
          edgesGroup.visible = visualMode === "tecnico-arestas";
          const edgeMat = new THREE.LineBasicMaterial({
            color: 0x18181b,
            transparent: true,
            opacity: 0.42,
          });

          const presetCounts: Record<string, number> = {};
          const storedList: StoredOriginalMaterial[] = [];

          root.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const matName = Array.isArray(mesh.material)
              ? mesh.material[0]?.name || ""
              : mesh.material?.name || "";
            const preset = classifyMaterialToPbrPreset(matName, mesh.name);
            presetCounts[preset.label] = (presetCounts[preset.label] || 0) + 1;

            const origMat = Array.isArray(mesh.material)
              ? (mesh.material[0] as THREE.MeshStandardMaterial)
              : (mesh.material as THREE.MeshStandardMaterial);

            const baseColor =
              origMat && origMat.color
                ? origMat.color.clone()
                : new THREE.Color(preset.baseColorHex);

            const pbrMat = new THREE.MeshPhysicalMaterial({
              name: `${preset.label} (${matName || mesh.name})`,
              color: baseColor,
              roughness: origMat?.roughness ?? preset.roughness,
              metalness: origMat?.metalness ?? preset.metalness,
              transmission: preset.transmission,
              ior: preset.ior,
              clearcoat: preset.clearcoat,
              clearcoatRoughness: preset.clearcoatRoughness,
              reflectivity: preset.reflectivity,
              envMapIntensity: preset.reflectivity * 1.35 * giAoIntensity,
              transparent: preset.transmission > 0.1 || Boolean(origMat?.transparent),
              opacity: preset.transmission > 0.1 ? 0.42 : origMat?.opacity ?? 1.0,
            });

            if (preset.emissiveHex && preset.emissiveIntensity) {
              pbrMat.emissive = new THREE.Color(preset.emissiveHex);
              pbrMat.emissiveIntensity = preset.emissiveIntensity;
            }

            storedList.push({
              mesh,
              originalMaterial: mesh.material,
              pbrMaterial: pbrMat,
              preset,
            });
            mesh.material = pbrMat;

            if (mesh.geometry) {
              const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 26);
              const line = new THREE.LineSegments(edgesGeo, edgeMat);
              line.position.copy(mesh.getWorldPosition(new THREE.Vector3()));
              line.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));
              line.scale.copy(mesh.getWorldScale(new THREE.Vector3()));
              edgesGroup.add(line);
            }
          });

          storedMaterialsRef.current = storedList;
          setShaderBreakdown(presetCounts);

          scene.add(root);
          scene.add(edgesGroup);
          modelRootRef.current = root;
          edgeLinesGroupRef.current = edgesGroup;

          // Configure initial camera positions from asset normalization
          const normBox = new THREE.Box3().setFromObject(root);
          const normSize = new THREE.Vector3();
          normBox.getSize(normSize);

          const tp = asset.thirdPersonCamera || {
            position: [normSize.x * 0.95 + 3.5, Math.max(normSize.y * 0.85, 2.8), normSize.z * 1.15 + 4.2],
            target: [0, Math.min(normSize.y * 0.4, 1.35), 0],
            fov: 42,
          };
          const fp = asset.firstPersonCamera || {
            position: [0, 1.65, Math.max(normSize.z * 0.55, 2.8)],
            target: [0, 1.6, 0],
            fov: 55,
          };

          const st = camStateRef.current;
          st.target.set(tp.target[0], tp.target[1], tp.target[2]);
          st.desiredTarget.set(tp.target[0], tp.target[1], tp.target[2]);
          const offset = new THREE.Vector3(tp.position[0], tp.position[1], tp.position[2]).sub(st.target);
          st.spherical.setFromVector3(offset);
          st.desiredRadius = st.spherical.radius;
          st.desiredPhi = st.spherical.phi;
          st.desiredTheta = st.spherical.theta;

          st.fpPosition.set(fp.position[0], fp.position[1], fp.position[2]);
          st.fpDesiredPosition.set(fp.position[0], fp.position[1], fp.position[2]);
          st.fpYaw = 0;
          st.fpDesiredYaw = 0;
          st.fpPitch = -0.04;
          st.fpDesiredPitch = -0.04;

          setLoadingProgress(100);
          setIsLoaded(true);
          wakeRenderLoop();
        },
        (xhr) => {
          if (xhr.total > 0) {
            setLoadingProgress(Math.min(95, Math.round((xhr.loaded / xhr.total) * 100)));
          }
        },
        (err) => {
          console.error("[STUDIO_3D_LOAD_ERROR]", err);
          setLoadError("Não foi possível carregar o binário GLB. Verifique o arquivo no Acervo.");
          setIsLoaded(true);
        }
      );
    },
    [disposeObject3D, giAoIntensity, visualMode, wakeRenderLoop]
  );

  // Initialize WebGLRenderer, Scene, Cameras, Lights, Floor Grid & Demand Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    registerUserActivity();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111215");
    scene.fog = new THREE.FogExp2("#111215", 0.015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 250);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    pmremGeneratorRef.current = pmremGenerator;

    // Initial procedural studio environment until HDRI finishes loading
    const initialEnv = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    currentEnvMapRef.current = initialEnv;
    scene.environment = initialEnv;

    // Lights (Sun + Architectural Fill)
    const hemiLight = new THREE.HemisphereLight(0xfffbf2, 0x27272a, 0.65);
    hemiLight.position.set(0, 18, 0);
    scene.add(hemiLight);
    fillLightRef.current = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xfff6e5, 2.6);
    sunLight.position.set(10, 16, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 48;
    const d = 14;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Subtle Infinite Studio Floor & Reference Grid at Y = 0
    const envGroup = new THREE.Group();
    const shadowCatcherGeo = new THREE.PlaneGeometry(80, 80);
    const shadowCatcherMat = new THREE.ShadowMaterial({ opacity: 0.34 });
    const shadowCatcher = new THREE.Mesh(shadowCatcherGeo, shadowCatcherMat);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -0.002;
    shadowCatcher.receiveShadow = true;
    envGroup.add(shadowCatcher);

    const grid = new THREE.GridHelper(36, 36, 0x3f3f46, 0x27272a);
    grid.position.y = -0.001;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    envGroup.add(grid);

    // Smooth Teleport Target Ring on Floor (Y = 0.01m)
    const ringGeo = new THREE.RingGeometry(0.18, 0.26, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xede5d8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const teleportRing = new THREE.Mesh(ringGeo, ringMat);
    teleportRing.rotation.x = -Math.PI / 2;
    teleportRing.position.y = 0.012;
    envGroup.add(teleportRing);
    teleportRingRef.current = teleportRing;

    scene.add(envGroup);
    envGroupRef.current = envGroup;

    // Load initial HDRI and 3D model
    loadHdriEnvironment(activeAsset.defaultHdriId || "dia-claro");
    loadAssetModel(activeAsset);

    // Raycaster for floor click teleport and double-click pivot focus
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      registerUserActivity();
      wakeRenderLoop();
      const st = camStateRef.current;
      st.isDragging = true;
      st.isPanning = e.button === 2 || e.shiftKey;
      st.pointerDownPos = { x: e.clientX, y: e.clientY };
      st.prevPointer = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      registerUserActivity();
      const st = camStateRef.current;
      if (!st.isDragging) return;
      wakeRenderLoop();

      const dx = e.clientX - st.prevPointer.x;
      const dy = e.clientY - st.prevPointer.y;
      st.prevPointer = { x: e.clientX, y: e.clientY };

      if (st.mode === "first-person") {
        st.fpDesiredYaw -= dx * 0.0042;
        st.fpDesiredPitch = THREE.MathUtils.clamp(
          st.fpDesiredPitch - dy * 0.0038,
          -Math.PI / 2.4,
          Math.PI / 2.4
        );
      } else {
        if (st.isPanning) {
          const panSpeed = st.desiredRadius * 0.0014;
          const right = new THREE.Vector3();
          const up = new THREE.Vector3();
          camera.matrix.extractBasis(right, up, new THREE.Vector3());
          st.desiredTarget.addScaledVector(right, -dx * panSpeed);
          st.desiredTarget.addScaledVector(up, dy * panSpeed);
          st.desiredTarget.y = Math.max(0.1, st.desiredTarget.y);
        } else {
          st.desiredTheta -= dx * 0.0065;
          st.desiredPhi = THREE.MathUtils.clamp(
            st.desiredPhi - dy * 0.0055,
            0.12,
            Math.PI / 2 - 0.02
          );
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = camStateRef.current;
      const moveDist = Math.hypot(
        e.clientX - st.pointerDownPos.x,
        e.clientY - st.pointerDownPos.y
      );
      st.isDragging = false;
      st.isPanning = false;

      // In 1st-person mode: short click on floor triggers Smooth Teleport
      if (st.mode === "first-person" && moveDist < 6 && e.button === 0) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);

        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
          if (hitPoint.length() < 28) {
            st.fpDesiredPosition.set(hitPoint.x, 1.65, hitPoint.z);
            if (teleportRingRef.current) {
              teleportRingRef.current.position.set(hitPoint.x, 0.015, hitPoint.z);
              st.teleportRingTimer = 1.0;
            }
            wakeRenderLoop();
          }
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      registerUserActivity();
      if (!modelRootRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const hits = raycaster.intersectObject(modelRootRef.current, true);
      if (hits.length > 0) {
        const hit = hits[0].point;
        const st = camStateRef.current;
        if (st.mode === "third-person") {
          st.desiredTarget.copy(hit);
          st.desiredRadius = Math.max(2.2, st.desiredRadius * 0.72);
        } else {
          st.fpDesiredPosition.set(hit.x, 1.65, hit.z + 1.2);
        }
        wakeRenderLoop();
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      registerUserActivity();
      wakeRenderLoop();
      const st = camStateRef.current;
      if (st.mode === "third-person") {
        st.desiredRadius = THREE.MathUtils.clamp(
          st.desiredRadius * (1 + e.deltaY * 0.001),
          1.2,
          38
        );
      } else {
        const forward = new THREE.Vector3(
          -Math.sin(st.fpYaw),
          0,
          -Math.cos(st.fpYaw)
        ).normalize();
        st.fpDesiredPosition.addScaledVector(forward, -e.deltaY * 0.003);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      registerUserActivity();
      camStateRef.current.keysPressed.add(e.code);
      wakeRenderLoop();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      camStateRef.current.keysPressed.delete(e.code);
      wakeRenderLoop();
    };

    const onResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      wakeRenderLoop();
    };

    const domElem = renderer.domElement;
    domElem.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    domElem.addEventListener("dblclick", onDoubleClick);
    domElem.addEventListener("wheel", onWheel, { passive: false });
    domElem.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);

    // 2-Stage Hybrid Render Loop (60 FPS Navigation -> 300ms Idle RT/GI Convergence -> Demand Freeze)
    const animate = () => {
      rafIdRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const st = camStateRef.current;

      const { movedByKeys, dampingActive: rigDamping } = updateStudioCameraFrame({
        st: st as unknown as Parameters<typeof updateStudioCameraFrame>[0]["st"],
        camera,
        joystick: joystickVectorRef.current,
        avatarRoot: avatarRootRef.current,
        modelRoot: modelRootRef.current,
        raycaster,
      });

      if (movedByKeys) {
        lastInteractionTimeRef.current = now;
        needsRenderRef.current = true;
        rtPassCompletedRef.current = false;
      }

      let dampingActive = rigDamping;

      if (st.teleportRingTimer > 0.01 && teleportRingRef.current) {
        st.teleportRingTimer *= 0.92;
        (teleportRingRef.current.material as THREE.MeshBasicMaterial).opacity =
          st.teleportRingTimer * 0.75;
        dampingActive = true;
      }

      if (dampingActive) {
        lastInteractionTimeRef.current = now;
        needsRenderRef.current = true;
        rtPassCompletedRef.current = false;
      }

      const idleMs = now - lastInteractionTimeRef.current;

      // Stage 1: Navigating at 60 FPS
      if (needsRenderRef.current || idleMs < 300) {
        renderer.render(scene, camera);
        needsRenderRef.current = false;
        return;
      }

      // Stage 2: Camera idle >= 300ms -> Execute High-DPI Ray Tracing & GI pass once, then freeze (0% GPU)
      if (idleMs >= 300 && !rtPassCompletedRef.current) {
        stageRef.current = "CONVERGING_RT_GI";
        setPipelineStage("CONVERGING_RT_GI");
        executeStage2RayTracingPass();
        rtPassCompletedRef.current = true;
        stageRef.current = "CONVERGED_IDLE_0GPU";
        setPipelineStage("CONVERGED_IDLE_0GPU");

        // Project 3D annotation pins to 2D screen coordinates
        if (activeAsset.annotations && activeAsset.annotations.length > 0) {
          const w = renderer.domElement.clientWidth;
          const h = renderer.domElement.clientHeight;
          const mapped = activeAsset.annotations.map((pin) => {
            const worldPos = new THREE.Vector3(pin.x, pin.y, pin.z);
            const projected = worldPos.clone().project(camera);
            const x = (projected.x * 0.5 + 0.5) * w;
            const y = (-projected.y * 0.5 + 0.5) * h;
            const visible = projected.z < 1 && x >= 0 && x <= w && y >= 0 && y <= h;
            return { pin, x, y, visible };
          });
          setProjectedPins(mapped);
        }
      }
      // When rtPassCompletedRef.current === true, the loop does ZERO WebGL draw calls (frameloop="demand" behavior)
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (hudIdleTimerRef.current) clearTimeout(hudIdleTimerRef.current);
      domElem.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      domElem.removeEventListener("dblclick", onDoubleClick);
      domElem.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);

      // Strict WebGL memory disposal on route exit
      disposeObject3D(modelRootRef.current);
      disposeObject3D(edgeLinesGroupRef.current);
      disposeObject3D(envGroupRef.current);
      if (currentEnvMapRef.current) currentEnvMapRef.current.dispose();
      if (pmremGeneratorRef.current) pmremGeneratorRef.current.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  // Turntable rotation effect
  useEffect(() => {
    if (!turntable || cameraMode !== "third-person") return;
    const interval = setInterval(() => {
      camStateRef.current.desiredTheta += 0.008;
      wakeRenderLoop();
    }, 16);
    return () => clearInterval(interval);
  }, [turntable, cameraMode, wakeRenderLoop]);

  // Sync Sun Azimuth, Solar Elevation & Exposure in real time
  useEffect(() => {
    const sun = sunLightRef.current;
    const renderer = rendererRef.current;
    if (sun) {
      const azRad = THREE.MathUtils.degToRad(sunAzimuthDeg);
      const elRad = THREE.MathUtils.degToRad(sunElevationDeg);
      const dist = 18;
      sun.position.set(
        dist * Math.cos(elRad) * Math.sin(azRad),
        Math.max(2.5, dist * Math.sin(elRad)),
        dist * Math.cos(elRad) * Math.cos(azRad)
      );
    }
    if (renderer) {
      renderer.toneMappingExposure = exposure;
    }
    wakeRenderLoop();
  }, [sunAzimuthDeg, sunElevationDeg, exposure, wakeRenderLoop]);

  // Sync GI/AO intensity & visual mode
  useEffect(() => {
    applyVisualModeToMaterials(visualMode);
  }, [visualMode, giAoIntensity, applyVisualModeToMaterials]);

  // Switch between 1st-person (Y = 1.65m, FOV 55°) and 3rd-person (Orbit, FOV 42°)
  const handleSwitchCameraMode = (nextMode: StudioCameraMode) => {
    registerUserActivity();
    setCameraMode(nextMode);
    camStateRef.current.mode = nextMode;
    if (cameraRef.current) {
      cameraRef.current.fov = nextMode === "first-person" ? 55 : 42;
      cameraRef.current.updateProjectionMatrix();
    }
    if (nextMode === "first-person") {
      setTurntable(false);
    }
    wakeRenderLoop();
  };

  // Switch active 3D template/asset
  const handleSelectAsset = (nextAsset: Studio3DAssetInput) => {
    registerUserActivity();
    setActiveAsset(nextAsset);
    if (nextAsset.defaultHdriId) {
      setActiveHdriId(nextAsset.defaultHdriId);
      loadHdriEnvironment(nextAsset.defaultHdriId);
    }
    loadAssetModel(nextAsset);
  };

  // Focus camera on annotation pin
  const handleSelectAnnotation = (pin: Project3DAnnotation) => {
    registerUserActivity();
    setSelectedPin(pin);
    const st = camStateRef.current;
    if (st.mode === "third-person") {
      st.desiredTarget.set(pin.cameraTarget[0], pin.cameraTarget[1], pin.cameraTarget[2]);
      const offset = new THREE.Vector3(
        pin.cameraPosition[0],
        pin.cameraPosition[1],
        pin.cameraPosition[2]
      ).sub(st.desiredTarget);
      const sph = new THREE.Spherical().setFromVector3(offset);
      st.desiredRadius = sph.radius;
      st.desiredPhi = sph.phi;
      st.desiredTheta = sph.theta;
    } else {
      st.fpDesiredPosition.set(pin.cameraPosition[0], 1.65, pin.cameraPosition[2]);
    }
    wakeRenderLoop();
  };

  const stepPinTour = (delta: -1 | 1) => {
    const list = activeAsset.annotations || [];
    if (list.length === 0) return;
    const currentIdx = selectedPin ? list.findIndex((p) => p.id === selectedPin.id) : -1;
    const nextIdx =
      currentIdx === -1
        ? delta > 0
          ? 0
          : list.length - 1
        : (currentIdx + delta + list.length) % list.length;
    handleSelectAnnotation(list[nextIdx]);
  };

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => { });
    } else {
      document.exitFullscreen?.().catch(() => { });
    }
  };

  const handleCaptureVistaPin = async () => {
    if (!cameraRef.current) return;
    const camPos: [number, number, number] = [
      Number(cameraRef.current.position.x.toFixed(2)),
      Number(cameraRef.current.position.y.toFixed(2)),
      Number(cameraRef.current.position.z.toFixed(2)),
    ];
    const tgt = camStateRef.current.target;
    const camTgt: [number, number, number] = [
      Number(tgt.x.toFixed(2)),
      Number(tgt.y.toFixed(2)),
      Number(tgt.z.toFixed(2)),
    ];
    const existing = activeAsset.annotations || [];
    const nextIdx = existing.length + 1;
    const newPin: Project3DAnnotation = {
      id: `pin-vista-${Date.now()}`,
      index: nextIdx,
      x: camTgt[0],
      y: camTgt[1],
      z: camTgt[2],
      cameraPosition: camPos,
      cameraTarget: camTgt,
      title: `Vista Técnica ${nextIdx}`,
      description: "Enquadramento técnico capturado no Studio 3D.",
      materialSpec: "PBR + HDRI Calibrado",
    };
    const updatedAnnotations = [...existing, newPin];
    setActiveAsset((prev) => ({ ...prev, annotations: updatedAnnotations }));
    setSelectedPin(newPin);
    if (/^[0-9a-f-]{36}$/i.test(activeAsset.id)) {
      await fetch(`/api/acervo/3d-assets/${activeAsset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: updatedAnnotations }),
      }).catch(() => { });
    }
  };

  const hudOpacityClass =
    hudIdle && activeDrawer === "none" && !selectedPin
      ? "opacity-15 hover:opacity-100"
      : "opacity-100";

  return (
    <div
      onPointerMove={registerUserActivity}
      onKeyDown={registerUserActivity}
      className="relative h-screen w-screen overflow-hidden bg-[#111215] select-none font-sans"
    >
      {/* 1. CANVAS WEBGL PRINCIPAL (ESTÁGIO 1 & 2) */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing" />

      {/* 2. OVERLAY DE RAY TRACING / CONTACT AO / GI CONVERGIDO (ESTÁGIO 2) */}
      <canvas
        ref={rtOverlayCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300"
        style={{
          opacity: pipelineStage === "CONVERGED_IDLE_0GPU" ? 1 : 0,
        }}
      />

      {/* 3. PINS DE ANOTAÇÃO 3D PROJETADOS */}
      {showHotspots &&
        isLoaded &&
        projectedPins.map(({ pin, x, y, visible }) =>
          visible ? (
            <button
              key={pin.id}
              type="button"
              onClick={() => handleSelectAnnotation(pin)}
              style={{ transform: `translate3d(${x - 16}px, ${y - 16}px, 0)` }}
              className={`absolute left-0 top-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200 ${selectedPin?.id === pin.id
                ? "scale-125 border-[#EDE5D8] bg-[#18181B] text-[#EDE5D8] shadow-[0_0_20px_rgba(237,229,216,0.5)]"
                : "border-white/30 bg-black/45 text-white/95 backdrop-blur-md hover:scale-110 hover:bg-black/75"
                }`}
              title={pin.title}
            >
              {pin.index}
            </button>
          ) : null
        )}

      {/* 4. BARRA SUPERIOR FLUTUANTE (AUTO-HIDE) */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4 sm:px-6 transition-opacity duration-500 ${hudOpacityClass}`}
      >
        {/* Botão Discreto Voltar ao Acervo + Identificação do Modelo */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2.5">
          <Link
            href={returnHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur-xl transition hover:bg-black/45 active:scale-95"
          >
            <span>←</span>
            <span>{returnLabel}</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-white/15 bg-black/25 px-4 py-1.5 text-xs text-white/90 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-[#EDE5D8]" />
            <span className="font-semibold tracking-tight">{activeAsset.title}</span>
            {activeAsset.category && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#EDE5D8]">
                {activeAsset.category}
              </span>
            )}
          </div>
        </div>

        {/* Telemetria do Motor Híbrido (Estágio 1 vs Estágio 2 On-Demand RT) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3.5 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-xl">
            <span
              className={`h-2 w-2 rounded-full ${pipelineStage === "NAVIGATING_60FPS"
                ? "bg-amber-400 animate-pulse"
                : pipelineStage === "CONVERGING_RT_GI"
                  ? "bg-sky-400 animate-ping"
                  : "bg-emerald-400"
                }`}
            />
            <span className="hidden md:inline">
              {pipelineStage === "NAVIGATING_60FPS"
                ? "Estágio 1 · Navegação 60 FPS (DPR 1.5)"
                : pipelineStage === "CONVERGING_RT_GI"
                  ? "Estágio 2 · Convergindo Ray Tracing & GI..."
                  : "Estágio 2 · RT + GI Convergido (0% GPU Idle)"}
            </span>
            <span className="md:hidden">
              {pipelineStage === "CONVERGED_IDLE_0GPU" ? "RT + GI Ativo" : "60 FPS"}
            </span>
          </div>
        </div>
      </div>

      {/* 5. PAINEL DE ESPECIFICAÇÃO DO PIN SELECIONADO */}
      {selectedPin && (
        <div className=" absolute right-6 top-20 z-30 w-80 rounded-3xl border border-white/15 bg-black/55 p-4 text-white/90 shadow-2xl backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EDE5D8] text-xs font-bold text-[#18181B]">
                {selectedPin.index}
              </span>
              <h3 className="text-xs font-bold text-white">{selectedPin.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPin(null)}
              className="rounded-full px-2 py-0.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/75">{selectedPin.description}</p>
          {selectedPin.materialSpec && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-[11px]">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#EDE5D8]">
                Shader / Material PBR Compilado
              </span>
              <span className="font-medium text-white/90">{selectedPin.materialSpec}</span>
            </div>
          )}
          {selectedPin.dimensions && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-white/70">
              <span>Cota / Escala Real:</span>
              <span className="font-mono font-semibold text-[#EDE5D8]">{selectedPin.dimensions}</span>
            </div>
          )}
          {(activeAsset.annotations?.length || 0) > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px]">
              <button
                type="button"
                onClick={() => stepPinTour(-1)}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-semibold text-white/85 hover:bg-white/15 transition"
              >
                ← Anterior
              </button>
              <span className="font-mono text-white/60">
                {selectedPin.index} / {activeAsset.annotations?.length}
              </span>
              <button
                type="button"
                onClick={() => stepPinTour(1)}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-semibold text-white/85 hover:bg-white/15 transition"
              >
                Próximo →
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. JOYSTICK TOUCH MOBILE (QUANDO EM 1ª PESSOA) */}
      {cameraMode === "first-person" && (
        <div
          className={`absolute bottom-24 left-6 z-30 flex flex-col items-center gap-1.5 transition-opacity duration-500 ${hudOpacityClass}`}
        >
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const updateStick = (clientX: number, clientY: number) => {
                const dx = THREE.MathUtils.clamp(clientX - cx, -34, 34);
                const dy = THREE.MathUtils.clamp(clientY - cy, -34, 34);
                setJoystickOffset({ x: dx, y: dy });
                joystickVectorRef.current = {
                  right: dx / 34,
                  forward: -dy / 34,
                };
                wakeRenderLoop();
              };
              updateStick(e.clientX, e.clientY);
              const moveHandler = (ev: PointerEvent) => updateStick(ev.clientX, ev.clientY);
              const upHandler = () => {
                setJoystickOffset({ x: 0, y: 0 });
                joystickVectorRef.current = { forward: 0, right: 0 };
                window.removeEventListener("pointermove", moveHandler);
                window.removeEventListener("pointerup", upHandler);
              };
              window.addEventListener("pointermove", moveHandler);
              window.addEventListener("pointerup", upHandler);
            }}
            className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-black/30 backdrop-blur-xl cursor-pointer touch-none"
            title="Arraste para caminhar em 1ª pessoa (altura 1.65m)"
          >
            <div
              style={{
                transform: `translate3d(${joystickOffset.x}px, ${joystickOffset.y}px, 0)`,
              }}
              className="h-9 w-9 rounded-full border border-[#EDE5D8]/60 bg-[#EDE5D8]/80 shadow-md transition-transform duration-75"
            />
          </div>
          <span className="rounded-full bg-black/35 px-2.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-md">
            Passeio 1.65m · Clique no piso p/ ir
          </span>
        </div>
      )}

      {/* 7. GAVETAS FLUTUANTES DE CONTROLE (ILUMINAÇÃO HDRI / MODELOS / SHADERS PBR) */}
      {activeDrawer !== "none" && (
        <div className="absolute bottom-20 left-1/2 z-30 w-[92vw] max-w-2xl -translate-x-1/2 rounded-3xl border border-white/15 bg-black/60 p-5 text-white/90 shadow-2xl backdrop-blur-2xl animate-in fade-in duration-150">
          {activeDrawer === "lighting" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#EDE5D8]">
                    Iluminação HDRI (\Arquivos\HDRI) & Ray Tracing Solar
                  </h3>
                  <p className="text-[11px] text-white/65">
                    Troca instantânea de mapas Radiance `.hdr` pré-filtrados (PMREM) e posição solar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer("none")}
                  className="rounded-full px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              {/* Seletor de HDRIs compilados */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {hdriCatalog.map((hdri) => {
                  const selected = activeHdriId === hdri.id;
                  return (
                    <button
                      key={hdri.id}
                      type="button"
                      onClick={() => {
                        setActiveHdriId(hdri.id);
                        loadHdriEnvironment(hdri.id);
                      }}
                      className={`rounded-2xl border p-2.5 text-left transition ${selected
                        ? "border-[#EDE5D8] bg-white/15 text-white"
                        : "border-white/10 bg-black/30 text-white/75 hover:bg-white/10"
                        }`}
                    >
                      <p className="text-xs font-bold truncate">{hdri.title}</p>
                      <p className="mt-0.5 text-[10px] text-white/55 truncate">{hdri.sourceFileName}</p>
                    </button>
                  );
                })}
              </div>

              {/* Sliders de Rotação do Sol/HDRI, Elevação, Exposição e GI/AO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <label className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/75">Rotação do Sol / HDRI</span>
                    <span className="font-mono text-[#EDE5D8]">{sunAzimuthDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={sunAzimuthDeg}
                    onChange={(e) => setSunAzimuthDeg(Number(e.target.value))}
                    className="w-full accent-[#EDE5D8]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/75">Elevação Solar</span>
                    <span className="font-mono text-[#EDE5D8]">{sunElevationDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={85}
                    value={sunElevationDeg}
                    onChange={(e) => setSunElevationDeg(Number(e.target.value))}
                    className="w-full accent-[#EDE5D8]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/75">Exposição ACES Filmic</span>
                    <span className="font-mono text-[#EDE5D8]">{exposure.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.4}
                    step={0.05}
                    value={exposure}
                    onChange={(e) => setExposure(Number(e.target.value))}
                    className="w-full accent-[#EDE5D8]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/75">Intensidade GI / Contact AO</span>
                    <span className="font-mono text-[#EDE5D8]">{giAoIntensity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={giAoIntensity}
                    onChange={(e) => setGiAoIntensity(Number(e.target.value))}
                    className="w-full accent-[#EDE5D8]"
                  />
                </label>
              </div>
            </div>
          )}

          {activeDrawer === "shaders" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#EDE5D8]">
                    Modos de Leitura & Compilador Inteligente de Shaders PBR
                  </h3>
                  <p className="text-[11px] text-white/65">
                    Conversão automática de materiais legados (3ds Max/Corona/CAD) em `MeshPhysicalMaterial`.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer("none")}
                  className="rounded-full px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "realista-pbr-rt" as const, label: "Realista PBR + RT", desc: "Clearcoat, vidro IOR 1.52 & GI" },
                  { id: "clay-maquete" as const, label: "Maquete Branca Clay", desc: "Estudo volumétrico puro" },
                  { id: "tecnico-arestas" as const, label: "Técnico com Arestas", desc: "Linhas de projeto + cotas" },
                  { id: "wireframe" as const, label: "Malha Wireframe", desc: "Inspeção topológica GLB" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setVisualMode(m.id)}
                    className={`rounded-2xl border p-2.5 text-left transition ${visualMode === m.id
                      ? "border-[#EDE5D8] bg-white/15 text-white"
                      : "border-white/10 bg-black/30 text-white/75 hover:bg-white/10"
                      }`}
                  >
                    <p className="text-xs font-bold">{m.label}</p>
                    <p className="mt-0.5 text-[10px] text-white/55">{m.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(shaderBreakdown).map(([label, count]) => (
                  <span
                    key={label}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/80"
                  >
                    {label}: <strong className="text-[#EDE5D8]">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === "models" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#EDE5D8]">
                    Templates 3D Compilados (\Arquivos\Modelos & \Projetos)
                  </h3>
                  <p className="text-[11px] text-white/65">
                    Cenas normalizadas em metros (`Y-Up`, piso `Y = 0`) com descarte seguro de memória WebGL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer("none")}
                  className="rounded-full px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {catalogAssets.map((item) => {
                  const selected = activeAsset.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        handleSelectAsset(item);
                        setActiveDrawer("none");
                      }}
                      className={`flex items-start justify-between gap-3 rounded-2xl border p-3 text-left transition ${selected
                        ? "border-[#EDE5D8] bg-white/15 text-white"
                        : "border-white/10 bg-black/30 text-white/80 hover:bg-white/10"
                        }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{item.title}</p>
                        <p className="mt-0.5 text-[10px] text-white/60 line-clamp-1">
                          {item.sourcePath || item.description || "Ativo 3D compilado"}
                        </p>
                      </div>
                      {item.stats?.triangles && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-[#EDE5D8]">
                          {item.stats.triangles} tris
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. DOCK INFERIOR FLUTUANTE TRANSPARENTE (AUTO-HIDE APÓS 3s) */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4 transition-opacity duration-500 ${hudOpacityClass}`}
      >
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {/* Pill 1: Câmera 3ª Pessoa vs 1ª Pessoa (1.65m) */}
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/25 p-1 text-xs text-white/90 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => handleSwitchCameraMode("third-person")}
              className={`rounded-full px-3.5 py-1.5 font-semibold transition ${cameraMode === "third-person"
                ? "bg-[#EDE5D8] text-[#18181B]"
                : "text-white/85 hover:bg-black/45"
                }`}
            >
              Orbit 3ª Pessoa
            </button>
            <button
              type="button"
              onClick={() => handleSwitchCameraMode("first-person")}
              className={`rounded-full px-3.5 py-1.5 font-semibold transition ${cameraMode === "first-person"
                ? "bg-[#EDE5D8] text-[#18181B]"
                : "text-white/85 hover:bg-black/45"
                }`}
            >
              Passeio 1ª Pessoa (1.65m)
            </button>
          </div>

          {/* Pill 2: Controles de Iluminação HDRI, Shaders, Modelos e Giro */}
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === "lighting" ? "none" : "lighting")}
            className={`rounded-full border border-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-xl transition ${activeDrawer === "lighting"
              ? "bg-[#EDE5D8] text-[#18181B]"
              : "bg-black/25 text-white/90 hover:bg-black/45"
              }`}
          >
            ☀️ HDRI & Sol ({hdriCatalog.find((h) => h.id === activeHdriId)?.title.split(" ")[0] || "HDRI"})
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === "shaders" ? "none" : "shaders")}
            className={`rounded-full border border-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-xl transition ${activeDrawer === "shaders"
              ? "bg-[#EDE5D8] text-[#18181B]"
              : "bg-black/25 text-white/90 hover:bg-black/45"
              }`}
          >
            ✨ Shaders ({visualMode === "realista-pbr-rt" ? "PBR + RT" : visualMode === "clay-maquete" ? "Clay" : visualMode === "tecnico-arestas" ? "Técnico" : "Wireframe"})
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === "models" ? "none" : "models")}
            className={`rounded-full border border-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-xl transition ${activeDrawer === "models"
              ? "bg-[#EDE5D8] text-[#18181B]"
              : "bg-black/25 text-white/90 hover:bg-black/45"
              }`}
          >
            🧊 Modelos ({catalogAssets.length})
          </button>

          {cameraMode === "third-person" && (
            <>
              <select
                value={selectedAvatarId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedAvatarId(id);
                  if (id === "none") {
                    setAvatarNotice(null);
                    if (avatarRootRef.current && sceneRef.current) {
                      sceneRef.current.remove(avatarRootRef.current);
                      disposeObject3D(avatarRootRef.current);
                      avatarRootRef.current = null;
                    }
                    return;
                  }
                  const av = avatarCatalog.find((a) => a.id === id);
                  if (!av) return;
                  if (!av.glbUrl) {
                    setAvatarNotice(
                      `${av.name}: aguardando malha .glb/.usdz/.fbx no Pipeline Pré-Build 3D (zero modelagem procedural).`
                    );
                    return;
                  }
                  setAvatarNotice(null);
                  const avLoader = new GLTFLoader();
                  try {
                    avLoader.setMeshoptDecoder(MeshoptDecoder);
                  } catch { }
                  avLoader.load(av.glbUrl, (gltf) => {
                    if (!sceneRef.current) return;
                    if (avatarRootRef.current) {
                      sceneRef.current.remove(avatarRootRef.current);
                      disposeObject3D(avatarRootRef.current);
                    }
                    const avRoot = gltf.scene || new THREE.Group();
                    const box = new THREE.Box3().setFromObject(avRoot);
                    if (!box.isEmpty()) {
                      const sz = new THREE.Vector3();
                      box.getSize(sz);
                      const scale = sz.y > 0.01 ? 1.72 / sz.y : 1;
                      avRoot.scale.setScalar(scale);
                      avRoot.updateMatrixWorld(true);
                      const sb = new THREE.Box3().setFromObject(avRoot);
                      avRoot.position.set(0, -sb.min.y, 1.4);
                    }
                    avatarRootRef.current = avRoot;
                    sceneRef.current.add(avRoot);
                    wakeRenderLoop();
                  });
                }}
                aria-label="Selecionar Avatar 3ª Pessoa"
                className="h-9 rounded-full border border-white/15 bg-black/35 px-3 text-xs font-semibold text-white/90 backdrop-blur-xl outline-none hover:bg-black/50 transition"
              >
                <option value="none" className="bg-[#18181B] text-white">
                  👤 Sem Avatar (Orbit)
                </option>
                {avatarCatalog.map((av) => (
                  <option key={av.id} value={av.id} className="bg-[#18181B] text-white">
                    🧍 {av.name} {av.glbUrl ? "" : "(Exportar 3D)"}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setTurntable((prev) => !prev)}
                className={`rounded-full border border-white/15 px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition ${turntable
                  ? "bg-[#EDE5D8] text-[#18181B]"
                  : "bg-black/25 text-white/90 hover:bg-black/45"
                  }`}
                title="Giro automático da maquete (Turntable)"
              >
                ↻ Turntable
              </button>
            </>
          )}

          {activeAsset.usdzUrl ? (
            <a
              href={activeAsset.usdzUrl}
              rel="ar"
              className="rounded-full border border-white/15 bg-black/25 px-3.5 py-2 text-xs font-semibold text-white/90 backdrop-blur-xl hover:bg-black/45 transition"
            >
              📱 AR
            </a>
          ) : (
            <button
              type="button"
              onClick={() =>
                setArNotice(
                  activeAsset.glbUrl
                    ? `AR QuickLook / SceneViewer pronto para ${activeAsset.title} (.GLB ativo). Anexe .USDZ no Pipeline para iOS.`
                    : "Exporte .GLB / .USDZ no Pipeline Pré-Build 3D para habilitar Realidade Aumentada."
                )
              }
              className="rounded-full border border-white/15 bg-black/25 px-3.5 py-2 text-xs font-semibold text-white/90 backdrop-blur-xl hover:bg-black/45 transition"
            >
              📱 AR
            </button>
          )}

          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/25 p-1 text-xs backdrop-blur-xl">
            <button
              type="button"
              onClick={() => stepPinTour(-1)}
              className="rounded-full px-2 py-1 text-white/75 hover:bg-black/45 hover:text-white transition"
              title="Pino anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setShowHotspots((prev) => !prev)}
              className={`rounded-full px-2.5 py-1 font-semibold transition ${showHotspots
                ? "bg-black/45 text-[#EDE5D8]"
                : "text-white/60 hover:bg-black/45"
                }`}
            >
              📍 {selectedPin ? `${selectedPin.index}/${activeAsset.annotations?.length || 0}` : `Pinos (${activeAsset.annotations?.length || 0})`}
            </button>
            <button
              type="button"
              onClick={() => stepPinTour(1)}
              className="rounded-full px-2 py-1 text-white/75 hover:bg-black/45 hover:text-white transition"
              title="Próximo pino"
            >
              ›
            </button>
          </div>

          {userRole === "ADMIN" && (
            <button
              type="button"
              onClick={() => void handleCaptureVistaPin()}
              className="rounded-full border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold text-[#EDE5D8] backdrop-blur-xl hover:bg-black/45 transition"
              title="Capturar câmera atual como novo pino técnico"
            >
              + Vista
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-full border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold text-white/90 backdrop-blur-xl hover:bg-black/45 transition"
            title="Alternar Tela Cheia"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Avisos não-bloqueantes de Avatar / AR */}
      {(avatarNotice || arNotice) && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/15 bg-black/80 px-4 py-2.5 text-xs text-white/90 backdrop-blur-xl shadow-2xl">
          <span>{avatarNotice || arNotice}</span>
          <Link
            href={pipelineHref}
            className="shrink-0 rounded-lg bg-[#EDE5D8] px-2.5 py-1 text-[11px] font-semibold text-[#18181B] hover:opacity-90"
          >
            Pipeline 3D
          </Link>
          <button
            type="button"
            onClick={() => {
              setAvatarNotice(null);
              setArNotice(null);
            }}
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Aviso explícito NEEDS_EXPORT quando o ativo selecionado não possui .glb/.usdz/.fbx compilado */}
      {!activeAsset.glbUrl && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#111215]/90 p-6 backdrop-blur-md">
          <div className="max-w-md rounded-2xl border border-white/15 bg-[#18181B] p-6 text-center text-white shadow-2xl space-y-4">
            <span className="inline-block rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold text-rose-300">
              NEEDS_EXPORT · Zero Modelagem Procedural
            </span>
            <h2 className="text-base font-semibold">{activeAsset.title}</h2>
            <p className="text-xs text-white/70 leading-relaxed">
              {activeAsset.diagnostics?.[0] ||
                "Este ativo é um arquivo proprietário fechado (.max/.rvt) ou imagem 2D sem malha 3D aberta (.glb/.usdz/.fbx)."}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Link
                href={pipelineHref}
                className="rounded-xl bg-[#EDE5D8] px-4 py-2 text-xs font-semibold text-[#18181B] hover:opacity-90 transition"
              >
                Abrir Pipeline Pré-Build 3D
              </Link>
              <Link
                href={returnHref}
                className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 transition"
              >
                {returnLabel}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 9. OVERLAY DE CARREGAMENTO PROGRESSIVO */}
      {!isLoaded && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#111215]/80 backdrop-blur-md">
          <div className="w-64 space-y-3 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#EDE5D8]">
              Compilando Cena 3D & Shaders PBR...
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#EDE5D8] transition-all duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-white/60">{activeAsset.title}</p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-x-0 top-20 z-40 mx-auto max-w-md rounded-2xl border border-rose-500/40 bg-black/80 p-4 text-center text-xs text-rose-200 backdrop-blur-xl">
          {loadError}
        </div>
      )}
    </div>
  );
}
