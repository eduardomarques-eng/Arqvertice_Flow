"use client";

import React, { Component, useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  DEFAULT_SHOWCASE_ANNOTATIONS,
  DEFAULT_SHOWCASE_CAMERA_PRESET,
  type Project3DAnnotation,
  type Project3DCameraPreset,
  type Project3DOptimizationStats,
} from "@/lib/acervo/showcase-3d-defaults";

export type ShowcaseReadingMode = "PBR_REALISTIC" | "CLAY_MAQUETTE" | "WIREFRAME_TECH";
export type ShowcaseEnvironmentTheme = "WARM_MINIMALIST" | "PURE_WHITE" | "STUDIO_DARK";

export interface SketchfabShowcaseViewerProps {
  assetId?: string;
  projectId: string;
  title: string;
  description?: string | null;
  glbUrl: string;
  posterUrl?: string | null;
  cameraPreset?: Project3DCameraPreset;
  annotations?: Project3DAnnotation[];
  optimizationStats?: Project3DOptimizationStats | null;
  canManageAnnotations?: boolean;
  defaultExpandedViewport?: boolean;
  onAssetUpdated?: (updated: {
    cameraPreset: Project3DCameraPreset;
    annotations: Project3DAnnotation[];
  }) => void;
}

interface ProjectedPinState {
  id: string;
  index: number;
  screenX: number;
  screenY: number;
  visible: boolean;
  occluded: boolean;
}

interface WebGLErrorBoundaryProps {
  posterUrl?: string | null;
  title: string;
  annotations: Project3DAnnotation[];
  onRetry: () => void;
  children: React.ReactNode;
}

interface WebGLErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Error Boundary dedicado para falhas de inicialização ou perda de contexto WebGL.
 * Nunca exibe tela branca quebrada: apresenta o pôster estático e as especificações técnicas.
 */
export class WebGLErrorBoundary extends Component<WebGLErrorBoundaryProps, WebGLErrorBoundaryState> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "Contexto WebGL indisponível neste dispositivo.",
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-[420px] w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/60 bg-[#EDE5D8]/60 p-6">
          {this.props.posterUrl && (
            <img
              src={this.props.posterUrl}
              alt={this.props.title}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
            />
          )}
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="rounded-xl bg-white/90 px-3.5 py-2 backdrop-blur-md border border-slate-200/60 shadow-sm">
              <p className="text-xs font-semibold text-[#18181B]">{this.props.title}</p>
              <p className="text-[11px] text-slate-500">
                Modo Pôster de Segurança · {this.state.errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: "" });
                this.props.onRetry();
              }}
              className="rounded-xl bg-[#18181B] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 transition"
            >
              Restaurar Motor 3D
            </button>
          </div>

          <div className="relative z-10 mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {this.props.annotations.map((ann) => (
              <div
                key={ann.id}
                className="rounded-xl border border-slate-200/60 bg-white/90 p-3 backdrop-blur-md shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#18181B] text-[10px] font-bold text-white">
                    {ann.index}
                  </span>
                  <span className="truncate text-xs font-semibold text-[#18181B]">{ann.title}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{ann.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Descarta recursivamente geometrias, materiais e texturas da GPU para evitar vazamento de VRAM
 */
function disposeObject3D(root: THREE.Object3D | null) {
  if (!root) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        if (!mat) continue;
        const stdMat = mat as THREE.MeshStandardMaterial;
        stdMat.map?.dispose();
        stdMat.normalMap?.dispose();
        stdMat.roughnessMap?.dispose();
        stdMat.metalnessMap?.dispose();
        stdMat.aoMap?.dispose();
        stdMat.emissiveMap?.dispose();
        mat.dispose();
      }
    }
  });
}

/**
 * Gera uma textura radial estática para ContactShadows (frames={1}, 0% custo contínuo de GPU)
 */
function createStaticContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
    grad.addColorStop(0, "rgba(24, 24, 27, 0.34)");
    grad.addColorStop(0.55, "rgba(24, 24, 27, 0.14)");
    grad.addColorStop(1, "rgba(24, 24, 27, 0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function SketchfabShowcaseViewer({
  assetId,
  title,
  description,
  glbUrl,
  posterUrl = "/models/arqvertice-showcase-poster.svg",
  cameraPreset = DEFAULT_SHOWCASE_CAMERA_PRESET,
  annotations: initialAnnotations = DEFAULT_SHOWCASE_ANNOTATIONS,
  optimizationStats,
  canManageAnnotations = false,
  defaultExpandedViewport = false,
  onAssetUpdated,
}: SketchfabShowcaseViewerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [retryCounter, setRetryCounter] = useState<number>(0);

  const [readingMode, setReadingMode] = useState<ShowcaseReadingMode>("PBR_REALISTIC");
  const [envTheme, setEnvTheme] = useState<ShowcaseEnvironmentTheme>("WARM_MINIMALIST");
  const [isFullscreenViewport, setIsFullscreenViewport] = useState<boolean>(defaultExpandedViewport);
  const [showPinTourList, setShowPinTourList] = useState<boolean>(false);

  const [currentCameraPreset, setCurrentCameraPreset] = useState<Project3DCameraPreset>(cameraPreset);
  const [annotations, setAnnotations] = useState<Project3DAnnotation[]>(
    initialAnnotations.length > 0 ? initialAnnotations : DEFAULT_SHOWCASE_ANNOTATIONS
  );
  const [activePinIndex, setActivePinIndex] = useState<number | null>(null);
  const [projectedPins, setProjectedPins] = useState<ProjectedPinState[]>([]);

  // Modo Admin/Coordenador: Capturar Vista ou Adicionar Pino
  const [isPlacingPin, setIsPlacingPin] = useState<boolean>(false);
  const [pendingPinCoords, setPendingPinCoords] = useState<{
    x: number;
    y: number;
    z: number;
    normal: [number, number, number];
    cameraPosition: [number, number, number];
    cameraTarget: [number, number, number];
  } | null>(null);
  const [newPinForm, setNewPinForm] = useState({
    title: "",
    description: "",
    materialSpec: "",
    dimensions: "",
  });
  const [savingAdminAction, setSavingAdminAction] = useState<boolean>(false);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Refs do motor WebGL (frameloop="demand")
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const originalMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const requestRenderRef = useRef<(() => void) | null>(null);
  const flyAnimationIdRef = useRef<number | null>(null);

  const annotationsRef = useRef<Project3DAnnotation[]>(annotations);
  useEffect(() => {
    annotationsRef.current = annotations;
    requestRenderRef.current?.();
  }, [annotations]);

  const activeAnnotation =
    activePinIndex !== null ? annotations.find((a) => a.index === activePinIndex) || null : null;

  /**
   * Voo suave interpolado de câmera (Cubic Ease-In-Out) sob demanda
   */
  const flyCameraTo = useCallback(
    (targetPos: [number, number, number], targetLookAt: [number, number, number], durationMs = 620) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const requestRender = requestRenderRef.current;
      if (!camera || !controls || !requestRender) return;

      if (flyAnimationIdRef.current !== null) {
        cancelAnimationFrame(flyAnimationIdRef.current);
        flyAnimationIdRef.current = null;
      }

      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const endPos = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]);
      const endTarget = new THREE.Vector3(targetLookAt[0], targetLookAt[1], targetLookAt[2]);
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const rawT = Math.min(1, elapsed / durationMs);
        // Cubic ease-in-out
        const easeT = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        camera.position.lerpVectors(startPos, endPos, easeT);
        controls.target.lerpVectors(startTarget, endTarget, easeT);
        controls.update();
        requestRender();

        if (rawT < 1) {
          flyAnimationIdRef.current = requestAnimationFrame(step);
        } else {
          flyAnimationIdRef.current = null;
        }
      };

      flyAnimationIdRef.current = requestAnimationFrame(step);
    },
    []
  );

  const handleSelectPin = useCallback(
    (pin: Project3DAnnotation) => {
      setActivePinIndex(pin.index);
      flyCameraTo(pin.cameraPosition, pin.cameraTarget, 640);
    },
    [flyCameraTo]
  );

  const handleResetCamera = useCallback(() => {
    setActivePinIndex(null);
    flyCameraTo(currentCameraPreset.position, currentCameraPreset.target, 580);
  }, [currentCameraPreset, flyCameraTo]);

  const handleStepPin = useCallback(
    (direction: -1 | 1) => {
      if (annotations.length === 0) return;
      const sorted = [...annotations].sort((a, b) => a.index - b.index);
      if (activePinIndex === null) {
        const first = direction > 0 ? sorted[0] : sorted[sorted.length - 1];
        handleSelectPin(first);
        return;
      }
      const currentIdx = sorted.findIndex((a) => a.index === activePinIndex);
      const nextIdx = (currentIdx + direction + sorted.length) % sorted.length;
      handleSelectPin(sorted[nextIdx]);
    },
    [annotations, activePinIndex, handleSelectPin]
  );

  // Inicialização do motor WebGL com frameloop="demand" (0% GPU ociosa)
  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) return;

    setIsModelReady(false);
    setLoadProgress(12);
    setContextLost(false);

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#EDE5D8");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      currentCameraPreset.fov || 42,
      width / height,
      0.1,
      500
    );
    camera.position.set(
      currentCameraPreset.position[0],
      currentCameraPreset.position[1],
      currentCameraPreset.position[2]
    );
    cameraRef.current = camera;

    // WebGLRenderer calibrado: dpr=[1, 1.75], high-performance, preserveDrawingBuffer=false
    const renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: true,
      preserveDrawingBuffer: false,
      alpha: false,
    });
    const clampedDpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.75);
    renderer.setPixelRatio(clampedDpr);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.95;
    controls.panSpeed = 0.75;
    controls.minDistance = 2.0;
    controls.maxDistance = 120.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.target.set(
      currentCameraPreset.target[0],
      currentCameraPreset.target[1],
      currentCameraPreset.target[2]
    );
    controls.update();
    controlsRef.current = controls;

    // Iluminação PBR Equilibrada (Estilo Estúdio Arquitetônico Sketchfab)
    const hemiLight = new THREE.HemisphereLight(0xfffbf2, 0xd8cfc2, 1.25);
    hemiLight.position.set(0, 35, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7e8, 1.65);
    keyLight.position.set(22, 32, 24);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe2ebf5, 0.75);
    fillLight.position.set(-20, 18, -16);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfbe8c8, 0.45);
    rimLight.position.set(0, 12, -26);
    scene.add(rimLight);

    // ContactShadows estático (frames={1}): plano de sombra suave assado sem custo contínuo
    const shadowTex = createStaticContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 26),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    scene.add(shadowPlane);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    modelRootRef.current = modelRoot;

    const raycaster = new THREE.Raycaster();
    let renderQueued = false;
    let dampingLoopActive = false;

    const projectPinsToScreen = () => {
      if (!container || !cameraRef.current) return;
      const rectW = container.clientWidth || width;
      const rectH = container.clientHeight || height;
      const cam = cameraRef.current;
      const nextPins: ProjectedPinState[] = [];

      for (const ann of annotationsRef.current) {
        const worldPos = new THREE.Vector3(ann.x, ann.y, ann.z);
        const ndc = worldPos.clone().project(cam);
        const visible = ndc.z >= -1 && ndc.z <= 1;
        const screenX = (ndc.x * 0.5 + 0.5) * rectW;
        const screenY = (-(ndc.y * 0.5) + 0.5) * rectH;

        // Verifica oclusão rápida pela geometria
        let occluded = false;
        if (visible && modelRoot.children.length > 0) {
          const dir = worldPos.clone().sub(cam.position);
          const distToPin = dir.length();
          raycaster.set(cam.position, dir.normalize());
          const hits = raycaster.intersectObjects(modelRoot.children, true);
          if (hits.length > 0 && hits[0].distance < distToPin - 0.45) {
            occluded = true;
          }
        }

        nextPins.push({
          id: ann.id,
          index: ann.index,
          screenX,
          screenY,
          visible,
          occluded,
        });
      }

      setProjectedPins(nextPins);
    };

    const renderSingleFrame = () => {
      renderQueued = false;
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      projectPinsToScreen();
    };

    const requestRender = () => {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(renderSingleFrame);
    };
    requestRenderRef.current = requestRender;

    // Loop sob demanda para amortecimento suave (damping) que para imediatamente ao estabilizar
    let lastCamPos = camera.position.clone();
    let lastTargetPos = controls.target.clone();
    const runDampingOnDemand = () => {
      const changed = controls.update();
      const deltaPos = camera.position.distanceToSquared(lastCamPos);
      const deltaTarget = controls.target.distanceToSquared(lastTargetPos);
      lastCamPos.copy(camera.position);
      lastTargetPos.copy(controls.target);

      renderSingleFrame();

      if (changed && (deltaPos > 1e-6 || deltaTarget > 1e-6)) {
        requestAnimationFrame(runDampingOnDemand);
      } else {
        dampingLoopActive = false;
      }
    };

    const onControlsChange = () => {
      if (!dampingLoopActive) {
        dampingLoopActive = true;
        requestAnimationFrame(runDampingOnDemand);
      } else {
        requestRender();
      }
    };
    controls.addEventListener("change", onControlsChange);

    // Context Loss / Restore Listeners
    const domElem = renderer.domElement;
    const onWebGLContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onWebGLContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    domElem.addEventListener("webglcontextlost", onWebGLContextLost, false);
    domElem.addEventListener("webglcontextrestored", onWebGLContextRestored, false);

    // Configura GLTFLoader com MeshoptDecoder, DRACOLoader e KTX2Loader
    const gltfLoader = new GLTFLoader();
    try {
      gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    } catch {
      // Fallback caso o decoder WASM já esteja inicializado
    }

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    gltfLoader.setDRACOLoader(dracoLoader);

    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath("https://unpkg.com/three@0.187.0/examples/jsm/libs/basis/");
    try {
      ktx2Loader.detectSupport(renderer);
      gltfLoader.setKTX2Loader(ktx2Loader);
    } catch {
      // Ignora caso KTX2 transcoder não seja exigido pelo arquivo
    }

    const originalMaterialsMap = originalMaterialsRef.current;
    originalMaterialsMap.clear();

    gltfLoader.load(
      glbUrl,
      (gltf) => {
        const loadedScene = gltf.scene;
        loadedScene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            originalMaterialsMap.set(mesh.uuid, mesh.material);
          }
        });
        modelRoot.add(loadedScene);
        setLoadProgress(100);
        setIsModelReady(true);
        requestRender();
      },
      (progressEvt) => {
        if (progressEvt.total > 0) {
          const pct = Math.min(98, Math.round((progressEvt.loaded / progressEvt.total) * 100));
          setLoadProgress(Math.max(15, pct));
        } else {
          setLoadProgress(65);
        }
      },
      () => {
        // Fallback geométrico imediato caso a URL externa falhe
        const fallbackGroup = new THREE.Group();
        const slabMat = new THREE.MeshStandardMaterial({ color: 0xebe3d5, roughness: 0.72 });
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x88b4c8,
          transparent: true,
          opacity: 0.58,
          roughness: 0.1,
          metalness: 0.2,
        });
        const acmMat = new THREE.MeshStandardMaterial({
          color: 0x18181b,
          roughness: 0.4,
          metalness: 0.45,
        });
        const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 14), slabMat);
        baseMesh.position.set(0, 0.25, 0);
        const towerGlass = new THREE.Mesh(new THREE.BoxGeometry(9.6, 10.4, 9.2), glassMat);
        towerGlass.position.set(0.5, 6.2, 0);
        const towerAcm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 12.2, 10.2), acmMat);
        towerAcm.position.set(4.6, 6.1, -0.3);
        fallbackGroup.add(baseMesh, towerGlass, towerAcm);
        fallbackGroup.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            originalMaterialsMap.set(mesh.uuid, mesh.material);
          }
        });
        modelRoot.add(fallbackGroup);
        setLoadProgress(100);
        setIsModelReady(true);
        requestRender();
      }
    );

    const resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 300);
        const h = Math.max(entry.contentRect.height, 320);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      }
    });
    resizeObs.observe(container);

    requestRender();

    // Cleanup completo na desmontagem ou troca de modelo (Zero Memory Leak WebGL)
    return () => {
      if (flyAnimationIdRef.current !== null) {
        cancelAnimationFrame(flyAnimationIdRef.current);
      }
      resizeObs.disconnect();
      controls.removeEventListener("change", onControlsChange);
      controls.dispose();
      domElem.removeEventListener("webglcontextlost", onWebGLContextLost);
      domElem.removeEventListener("webglcontextrestored", onWebGLContextRestored);

      dracoLoader.dispose();
      ktx2Loader.dispose();
      shadowTex.dispose();
      disposeObject3D(scene);

      renderer.dispose();
      renderer.forceContextLoss();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      modelRootRef.current = null;
    };
  }, [glbUrl, retryCounter]);

  // Atualiza fundo conforme tema selecionado (Warm Minimalist / Pure White / Studio Dark)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const hex =
      envTheme === "WARM_MINIMALIST"
        ? "#EDE5D8"
        : envTheme === "PURE_WHITE"
        ? "#FFFFFF"
        : "#18181B";
    scene.background = new THREE.Color(hex);
    requestRenderRef.current?.();
  }, [envTheme]);

  // Alterna modo de leitura (Realista PBR / Maquete Branca Clay #EDE5D8 / Wireframe Técnico)
  useEffect(() => {
    const modelRoot = modelRootRef.current;
    if (!modelRoot) return;

    const clayMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#EDE5D8"),
      roughness: 0.78,
      metalness: 0.04,
    });
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(envTheme === "STUDIO_DARK" ? "#EDE5D8" : "#18181B"),
      wireframe: true,
    });

    modelRoot.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (readingMode === "PBR_REALISTIC") {
        const orig = originalMaterialsRef.current.get(mesh.uuid);
        if (orig) mesh.material = orig;
      } else if (readingMode === "CLAY_MAQUETTE") {
        mesh.material = clayMat;
      } else if (readingMode === "WIREFRAME_TECH") {
        mesh.material = wireMat;
      }
    });

    requestRenderRef.current?.();

    return () => {
      clayMat.dispose();
      wireMat.dispose();
    };
  }, [readingMode, envTheme, isModelReady]);

  // Duplo-clique para centralizar pivô na superfície 3D + Clique simples para Marcar Pino (Admin)
  const handleViewportPointerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, isDoubleClick: boolean) => {
      const container = canvasHostRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const modelRoot = modelRootRef.current;
      if (!container || !camera || !controls || !modelRoot) return;

      const rect = container.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycaster.intersectObjects(modelRoot.children, true);
      if (hits.length === 0) return;

      const hit = hits[0];
      const pt = hit.point;

      if (!isDoubleClick && isPlacingPin && canManageAnnotations) {
        const normalVec = hit.face?.normal
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
          : new THREE.Vector3(0, 1, 0);
        setPendingPinCoords({
          x: Number(pt.x.toFixed(2)),
          y: Number(pt.y.toFixed(2)),
          z: Number(pt.z.toFixed(2)),
          normal: [
            Number(normalVec.x.toFixed(2)),
            Number(normalVec.y.toFixed(2)),
            Number(normalVec.z.toFixed(2)),
          ],
          cameraPosition: [
            Number(camera.position.x.toFixed(2)),
            Number(camera.position.y.toFixed(2)),
            Number(camera.position.z.toFixed(2)),
          ],
          cameraTarget: [
            Number(pt.x.toFixed(2)),
            Number(pt.y.toFixed(2)),
            Number(pt.z.toFixed(2)),
          ],
        });
        return;
      }

      if (isDoubleClick) {
        const offset = camera.position.clone().sub(controls.target).multiplyScalar(0.78);
        const nextCamPos = pt.clone().add(offset);
        flyCameraTo(
          [nextCamPos.x, nextCamPos.y, nextCamPos.z],
          [pt.x, pt.y, pt.z],
          520
        );
      }
    },
    [isPlacingPin, canManageAnnotations, flyCameraTo]
  );

  // Salvar Vista Inicial da Câmera (Admin/Coordenador)
  async function handleSaveInitialCameraPreset() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const newPreset: Project3DCameraPreset = {
      position: [
        Number(camera.position.x.toFixed(2)),
        Number(camera.position.y.toFixed(2)),
        Number(camera.position.z.toFixed(2)),
      ],
      target: [
        Number(controls.target.x.toFixed(2)),
        Number(controls.target.y.toFixed(2)),
        Number(controls.target.z.toFixed(2)),
      ],
      fov: camera.fov,
    };

    setCurrentCameraPreset(newPreset);
    if (!assetId) {
      setAdminFeedback("Vista inicial atualizada na sessão.");
      setTimeout(() => setAdminFeedback(null), 3000);
      return;
    }

    setSavingAdminAction(true);
    try {
      const res = await fetch(`/api/acervo/3d-assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraPreset: newPreset }),
      });
      if (res.ok) {
        setAdminFeedback("Vista inicial padrão salva no modelo 3D!");
        onAssetUpdated?.({ cameraPreset: newPreset, annotations });
      }
    } finally {
      setSavingAdminAction(false);
      setTimeout(() => setAdminFeedback(null), 3200);
    }
  }

  // Salvar Novo Pino de Especificação (Admin/Coordenador)
  async function handleConfirmNewPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingPinCoords || !newPinForm.title.trim()) return;

    const nextIndex =
      annotations.length > 0 ? Math.max(...annotations.map((a) => a.index)) + 1 : 1;
    const createdPin: Project3DAnnotation = {
      id: `pin-${Date.now()}`,
      index: nextIndex,
      x: pendingPinCoords.x,
      y: pendingPinCoords.y,
      z: pendingPinCoords.z,
      normal: pendingPinCoords.normal,
      cameraPosition: pendingPinCoords.cameraPosition,
      cameraTarget: pendingPinCoords.cameraTarget,
      title: newPinForm.title.trim(),
      description: newPinForm.description.trim() || "Especificação executiva verificada no modelo.",
      materialSpec: newPinForm.materialSpec.trim() || undefined,
      dimensions: newPinForm.dimensions.trim() || undefined,
    };

    const nextList = [...annotations, createdPin];
    setAnnotations(nextList);
    setPendingPinCoords(null);
    setIsPlacingPin(false);
    setNewPinForm({ title: "", description: "", materialSpec: "", dimensions: "" });
    setActivePinIndex(createdPin.index);

    if (assetId) {
      setSavingAdminAction(true);
      try {
        await fetch(`/api/acervo/3d-assets/${assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotations: nextList }),
        });
        setAdminFeedback(`Pino #${createdPin.index} salvo com sucesso!`);
        onAssetUpdated?.({ cameraPreset: currentCameraPreset, annotations: nextList });
      } finally {
        setSavingAdminAction(false);
        setTimeout(() => setAdminFeedback(null), 3200);
      }
    }
  }

  // Alternar Tela Cheia (100% Viewport / Fullscreen API)
  const handleToggleFullscreen = useCallback(() => {
    const nextState = !isFullscreenViewport;
    setIsFullscreenViewport(nextState);
    if (wrapperRef.current && nextState && document.fullscreenEnabled && !document.fullscreenElement) {
      wrapperRef.current.requestFullscreen?.().catch(() => {
        // Fallback CSS 100% viewport já ativo via state
      });
    } else if (!nextState && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setTimeout(() => requestRenderRef.current?.(), 120);
  }, [isFullscreenViewport]);

  // Acionar Visualização AR Mobile (SceneViewer Android / QuickLook iOS)
  const handleOpenMobileAR = useCallback(() => {
    const fullGlbUrl =
      typeof window !== "undefined" ? new URL(glbUrl, window.location.origin).href : glbUrl;
    const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    if (isAndroid) {
      const intentUrl = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
        fullGlbUrl
      )}&mode=ar_preferred&title=${encodeURIComponent(title)}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
      window.location.href = intentUrl;
    } else {
      window.open(fullGlbUrl, "_blank", "noopener,noreferrer");
    }
  }, [glbUrl, title]);

  return (
    <WebGLErrorBoundary
      posterUrl={posterUrl}
      title={title}
      annotations={annotations}
      onRetry={() => setRetryCounter((c) => c + 1)}
    >
      <div
        ref={wrapperRef}
        className={
          isFullscreenViewport
            ? "fixed inset-0 z-50 flex flex-col bg-[#F5F5F7]"
            : "relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
        }
      >
        {/* Barra Superior Minimalista */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#18181B] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              3D Showcase · GLB Meshopt
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[#18181B]">{title}</h3>
              {description && (
                <p className="hidden truncate text-[11px] text-slate-500 sm:block">{description}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Fundo (Warm Minimalist / Pure White / Studio Dark) */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200/70 bg-[#F5F5F7] p-1">
              {(
                [
                  { id: "WARM_MINIMALIST", label: "Warm", swatch: "bg-[#EDE5D8]" },
                  { id: "PURE_WHITE", label: "White", swatch: "bg-white" },
                  { id: "STUDIO_DARK", label: "Dark", swatch: "bg-[#18181B]" },
                ] as const
              ).map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setEnvTheme(theme.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                    envTheme === theme.id
                      ? "bg-white text-[#18181B] shadow-sm font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full border border-slate-300 ${theme.swatch}`} />
                  <span>{theme.label}</span>
                </button>
              ))}
            </div>

            {/* Ações leves de Admin/Coordenador */}
            {canManageAnnotations && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={savingAdminAction}
                  onClick={handleSaveInitialCameraPreset}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                  title="Salva o ângulo atual da câmera como vista padrão de abertura"
                >
                  📷 Capturar Vista Inicial
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlacingPin((v) => !v);
                    setPendingPinCoords(null);
                  }}
                  className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    isPlacingPin
                      ? "bg-amber-500 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {isPlacingPin ? "✕ Cancelar Pino" : "📍 Marcar Pino de Especificação"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Área do Viewport 3D */}
        <div
          className={`relative w-full select-none overflow-hidden ${
            isFullscreenViewport ? "flex-1 min-h-[560px]" : "h-[460px] sm:h-[520px]"
          }`}
          onClick={(e) => handleViewportPointerClick(e, false)}
          onDoubleClick={(e) => handleViewportPointerClick(e, true)}
        >
          {/* Container nativo do Canvas WebGL */}
          <div
            ref={canvasHostRef}
            className={`h-full w-full ${isPlacingPin ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
          />

          {/* Pôster Instantâneo (0ms load) com Crossfade Suave (500ms) */}
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#EDE5D8] transition-opacity duration-500 ${
              isModelReady ? "opacity-0" : "opacity-100"
            }`}
          >
            {posterUrl && (
              <img
                src={posterUrl}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            )}
            <div className="relative z-10 flex flex-col items-center rounded-2xl border border-slate-200/60 bg-white/90 px-6 py-4 shadow-sm backdrop-blur-md">
              <p className="text-xs font-semibold text-[#18181B]">
                Carregando Maquete 3D Otimizada ({loadProgress}%)
              </p>
              <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#18181B] transition-all duration-200"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                Descompactação GPU Meshopt · Frameloop sob demanda
              </p>
            </div>
          </div>

          {/* Alerta se o Contexto WebGL cair */}
          {contextLost && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="rounded-2xl bg-white p-5 text-center shadow-lg max-w-sm">
                <p className="text-sm font-semibold text-[#18181B]">Contexto WebGL Pausado</p>
                <p className="mt-1 text-xs text-slate-500">
                  O navegador suspendeu temporariamente a aceleração gráfica desta aba.
                </p>
                <button
                  type="button"
                  onClick={() => setRetryCounter((c) => c + 1)}
                  className="mt-3 rounded-xl bg-[#18181B] px-4 py-2 text-xs font-semibold text-white"
                >
                  Restaurar Visualizador 3D
                </button>
              </div>
            </div>
          )}

          {/* Banner de instrução quando Admin está posicionando novo pino */}
          {isPlacingPin && !pendingPinCoords && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#18181B]/90 px-4 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur-md">
              Clique em qualquer ponto da superfície 3D para fixar o pino e salvar o ângulo atual da câmera
            </div>
          )}

          {/* Feedback de salvamento Admin */}
          {adminFeedback && (
            <div className="pointer-events-none absolute top-3 right-3 z-20 rounded-xl bg-emerald-900/90 px-3.5 py-2 text-xs font-semibold text-white shadow-md">
              ✓ {adminFeedback}
            </div>
          )}

          {/* Pinos Numerados Estilo Sketchfab (1, 2, 3...) */}
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {projectedPins.map((pin) => {
              if (!pin.visible) return null;
              const ann = annotations.find((a) => a.id === pin.id);
              if (!ann) return null;
              const isSelected = activePinIndex === ann.index;

              return (
                <button
                  key={ann.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPin(ann);
                  }}
                  style={{
                    transform: `translate3d(${pin.screenX}px, ${pin.screenY}px, 0) translate(-50%, -50%)`,
                    opacity: pin.occluded && !isSelected ? 0.35 : 1,
                  }}
                  className={`pointer-events-auto absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-transform duration-150 ${
                    isSelected
                      ? "scale-125 border-white bg-[#18181B] text-white ring-4 ring-[#18181B]/30"
                      : "border-white/90 bg-[#18181B]/90 text-white hover:scale-110 shadow-md"
                  }`}
                  title={`${ann.index}. ${ann.title}`}
                >
                  {ann.index}
                </button>
              );
            })}
          </div>

          {/* Card Flutuante Apple-Minimalista do Pino Selecionado */}
          {activeAnnotation && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-4 top-4 z-20 w-80 max-w-[calc(100%-2rem)] rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-xs font-bold text-white">
                    {activeAnnotation.index}
                  </span>
                  <h4 className="text-xs font-semibold text-[#18181B]">{activeAnnotation.title}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePinIndex(null)}
                  className="rounded-lg px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {activeAnnotation.description}
              </p>

              {(activeAnnotation.materialSpec || activeAnnotation.dimensions) && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-[#F5F5F7]/90 p-2.5 text-[11px]">
                  {activeAnnotation.materialSpec && (
                    <div>
                      <span className="font-semibold text-slate-700">Especificação: </span>
                      <span className="text-slate-600">{activeAnnotation.materialSpec}</span>
                    </div>
                  )}
                  {activeAnnotation.dimensions && (
                    <div>
                      <span className="font-semibold text-slate-700">Dimensões: </span>
                      <span className="text-slate-600">{activeAnnotation.dimensions}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                <button
                  type="button"
                  onClick={() => handleStepPin(-1)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ‹ Anterior
                </button>
                <span className="text-[11px] font-medium text-slate-500">
                  Pino {activeAnnotation.index} de {annotations.length}
                </span>
                <button
                  type="button"
                  onClick={() => handleStepPin(1)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Próximo ›
                </button>
              </div>
            </div>
          )}

          {/* Modal Leve de Criação de Pino (Admin) */}
          {pendingPinCoords && (
            <form
              onSubmit={handleConfirmNewPin}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-4 top-4 z-30 w-80 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lg backdrop-blur-md space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#18181B]">
                  Novo Pino de Especificação 3D
                </span>
                <button
                  type="button"
                  onClick={() => setPendingPinCoords(null)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Título (ex.: Caixilho Minimalista)"
                value={newPinForm.title}
                onChange={(e) => setNewPinForm((s) => ({ ...s, title: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-xs text-slate-800"
              />
              <textarea
                rows={2}
                placeholder="Descrição técnica da solução..."
                value={newPinForm.description}
                onChange={(e) => setNewPinForm((s) => ({ ...s, description: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-xs text-slate-800"
              />
              <input
                type="text"
                placeholder="Material (ex.: Alumínio Anodizado + Vidro 10mm)"
                value={newPinForm.materialSpec}
                onChange={(e) => setNewPinForm((s) => ({ ...s, materialSpec: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-xs text-slate-800"
              />
              <input
                type="text"
                placeholder="Medidas (ex.: Vão 2,40m x 3,00m)"
                value={newPinForm.dimensions}
                onChange={(e) => setNewPinForm((s) => ({ ...s, dimensions: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-xs text-slate-800"
              />
              <button
                type="submit"
                disabled={savingAdminAction}
                className="w-full rounded-xl bg-[#18181B] py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Salvar Pino & Câmera
              </button>
            </form>
          )}

          {/* Lista Rápida do Tour de Pinos */}
          {showPinTourList && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-16 left-1/2 z-20 w-80 -translate-x-1/2 rounded-2xl border border-slate-200/60 bg-white/95 p-3 shadow-lg backdrop-blur-md"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Tour de Especificações ({annotations.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowPinTourList(false)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {annotations.map((ann) => (
                  <button
                    key={ann.id}
                    type="button"
                    onClick={() => {
                      handleSelectPin(ann);
                      setShowPinTourList(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                      activePinIndex === ann.index
                        ? "bg-[#18181B] text-white"
                        : "hover:bg-[#F5F5F7] text-[#18181B]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        activePinIndex === ann.index
                          ? "bg-white text-[#18181B]"
                          : "bg-[#EDE5D8] text-[#18181B]"
                      }`}
                    >
                      {ann.index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{ann.title}</p>
                      {ann.materialSpec && (
                        <p
                          className={`truncate text-[10px] ${
                            activePinIndex === ann.index ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {ann.materialSpec}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* DOCK FLUTUANTE ESSENCIAL NA BASE (4 Controles Intuitivos)             */}
          {/* ===================================================================== */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="
              absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5
              rounded-2xl border border-slate-200/70 bg-white/90 px-2.5 py-1.5
              shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] backdrop-blur-md
              w-[calc(100%-1.5rem)] sm:w-auto
            "
          >
            {/* 1. Resetar Câmera */}
            <button
              type="button"
              onClick={handleResetCamera}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#18181B] transition hover:bg-[#F5F5F7]"
              title="Retornar à vista padrão calibrada"
            >
              <span>🎯</span>
              <span>Resetar Câmera</span>
            </button>

            <span className="hidden h-4 w-px bg-slate-200 sm:inline-block" />

            {/* 2. Tour de Especificações / Pinos (1 / N) */}
            <div className="flex items-center gap-1 rounded-xl bg-[#F5F5F7] px-1.5 py-1">
              <button
                type="button"
                onClick={() => handleStepPin(-1)}
                className="rounded-lg px-1.5 py-0.5 text-xs font-bold text-slate-700 hover:bg-white"
                title="Pino Anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setShowPinTourList((v) => !v)}
                className="px-2 py-0.5 text-xs font-semibold text-[#18181B] hover:underline"
              >
                📍 Pinos ({activePinIndex ?? 0}/{annotations.length})
              </button>
              <button
                type="button"
                onClick={() => handleStepPin(1)}
                className="rounded-lg px-1.5 py-0.5 text-xs font-bold text-slate-700 hover:bg-white"
                title="Próximo Pino"
              >
                ›
              </button>
            </div>

            <span className="hidden h-4 w-px bg-slate-200 sm:inline-block" />

            {/* 3. Inspeção de Leitura (Realista PBR / Maquete Clay #EDE5D8 / Wireframe) */}
            <div className="flex items-center gap-1 rounded-xl bg-[#F5F5F7] p-1">
              {(
                [
                  { id: "PBR_REALISTIC", label: "Realista PBR" },
                  { id: "CLAY_MAQUETTE", label: "Maquete Clay" },
                  { id: "WIREFRAME_TECH", label: "Wireframe" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setReadingMode(m.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    readingMode === m.id
                      ? "bg-[#18181B] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <span className="hidden h-4 w-px bg-slate-200 sm:inline-block" />

            {/* 4. Tela Cheia (100% Viewport) & Ver no Espaço (AR Mobile) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleOpenMobileAR}
                className="rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                title="Abrir em Realidade Aumentada (QuickLook / SceneViewer)"
              >
                📱 Ver no Espaço (AR)
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="rounded-xl bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
              >
                {isFullscreenViewport ? "↙ Sair 100% Viewport" : "⛶ 100% Viewport"}
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé Técnico de Telemetria da Malha (Meshopt / Draw Calls / Dica de Duplo-Clique) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-[#F5F5F7]/70 px-4 py-2 text-[11px] text-slate-500">
          <span>
            💡 <strong>Dica:</strong> Arraste para orbitar, role para zoom e dê{" "}
            <strong>duplo-clique</strong> em qualquer ponto da superfície para centralizar o pivô.
          </span>
          {optimizationStats && (
            <span className="font-mono text-[10px] text-slate-600">
              Meshopt: Ativo (-{optimizationStats.compressionRatio}%) ·{" "}
              {(optimizationStats.optimizedBytes / 1024).toFixed(1)} KB ·{" "}
              {optimizationStats.vertexCount} vértices · {optimizationStats.drawCalls} draw calls
            </span>
          )}
        </div>
      </div>
    </WebGLErrorBoundary>
  );
}

export default SketchfabShowcaseViewer;
