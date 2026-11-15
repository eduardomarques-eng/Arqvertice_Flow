"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export interface MiniPreviewModelInfo {
  id: string;
  slug: string;
  name: string;
  category: string;
  sourceFormat: string;
  glbUrl: string | null;
  status: string;
  fileSizeBytes: number;
  triangleCount: number;
  textureCount: number;
  diagnostics?: string[];
}

export function MiniPreviewCanvas({
  model,
  workspaceHref,
}: {
  model: MiniPreviewModelInfo | null;
  workspaceHref: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const wireframeRef = useRef(wireframe);
  wireframeRef.current = wireframe;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const glbUrl = model?.glbUrl;
    if (!glbUrl) {
      container.innerHTML = "";
      setLoading(false);
      setLoadErr(null);
      return;
    }

    setLoading(true);
    setLoadErr(null);

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 240;

    const scene = new THREE.Scene();
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    scene.background = new THREE.Color(isDark ? "#141417" : "#ECEAE4");

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.2, 2.8, 4.5);
    camera.lookAt(0, 0.8, 0);

    // Micro-canvas com dpr={0.5} para inspeção ultra-leve antes de abrir o estúdio completo
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "low-power",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(0.5);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff5e4, 2.0);
    dir.position.set(6, 10, 6);
    scene.add(dir);

    const grid = new THREE.GridHelper(10, 10, 0x71717a, 0xa1a1aa);
    grid.position.y = -0.01;
    const gMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const gm of gMats) {
      gm.transparent = true;
      gm.opacity = 0.25;
    }
    scene.add(grid);

    let loadedRoot: THREE.Object3D | null = null;
    let rafId: number | null = null;
    let theta = Math.PI / 4;
    let phi = 1.15;
    let radius = 5.5;
    const target = new THREE.Vector3(0, 0.8, 0);
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const loader = new GLTFLoader();
    try {
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch {}

    loader.load(
      glbUrl,
      (gltf) => {
        const root = gltf.scene || new THREE.Group();
        const box = new THREE.Box3().setFromObject(root);
        if (!box.isEmpty()) {
          const sz = new THREE.Vector3();
          const ct = new THREE.Vector3();
          box.getSize(sz);
          box.getCenter(ct);
          const maxD = Math.max(sz.x, sz.y, sz.z, 0.001);
          const scale = 2.6 / maxD;
          root.scale.setScalar(scale);
          root.updateMatrixWorld(true);

          const sb = new THREE.Box3().setFromObject(root);
          const sc = new THREE.Vector3();
          sb.getCenter(sc);
          root.position.set(-sc.x, -sb.min.y, -sc.z);
          target.set(0, Math.max(0.4, (sb.max.y - sb.min.y) * 0.45), 0);
          radius = 3.8;
        }

        root.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              if ("wireframe" in m) {
                (m as THREE.MeshStandardMaterial).wireframe = wireframeRef.current;
              }
            }
          }
        });

        loadedRoot = root;
        scene.add(root);
        setLoading(false);
      },
      undefined,
      () => {
        setLoading(false);
        setLoadErr("Pré-visualização indisponível para este arquivo.");
      }
    );

    const onDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      theta -= dx * 0.008;
      phi = THREE.MathUtils.clamp(phi - dy * 0.007, 0.05, Math.PI - 0.05);
    };
    const onUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let lastFrame = 0;
    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      if (now - lastFrame < 32) return; // ~30 FPS cap for lightweight mini-preview
      lastFrame = now;

      if (autoRotateRef.current && !isDragging) {
        theta += 0.009;
      }

      if (loadedRoot) {
        loadedRoot.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              if ("wireframe" in m) {
                (m as THREE.MeshStandardMaterial).wireframe = wireframeRef.current;
              }
            }
          }
        });
      }

      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.sin(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (loadedRoot) {
        loadedRoot.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
        });
      }
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [model?.glbUrl, model?.id]);

  return (
    <div
      data-testid="mini-preview-window"
      className="sticky top-20 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181B] space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE5D8]/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#18181B] dark:bg-white/10 dark:text-[#EDE5D8]">
            <span>🔍</span> Mini-Preview 3D (dpr=0.5)
          </span>
          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {model?.name || "Selecione um modelo"}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWireframe((w) => !w)}
            className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
              wireframe
                ? "border-[#18181B] bg-[#18181B] text-[#EDE5D8] dark:border-[#EDE5D8] dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-300"
            }`}
            title="Alternar Wireframe na Pré-Visualização"
          >
            F3 Wire
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
              autoRotate
                ? "border-[#18181B] bg-[#EDE5D8] text-[#18181B]"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-[#09090B] dark:text-slate-300"
            }`}
            title="Giro Automático"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Micro-Canvas WebGL (dpr=0.5) */}
      <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-[#ECEAE4] dark:border-white/10 dark:bg-[#141417]">
        <div
          ref={mountRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-xs font-semibold text-white backdrop-blur-xs">
            Carregando malha .GLB (dpr=0.5)...
          </div>
        )}

        {!model?.glbUrl && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500 dark:text-slate-400">
            <span className="text-2xl mb-1">🧊</span>
            <p className="font-semibold">Sem malha .GLB pronta</p>
            <p className="text-[11px] opacity-80">
              Converta ou envie um arquivo `.glb`, `.fbx` ou `.usdz` para pré-visualizar aqui.
            </p>
          </div>
        )}

        {loadErr && (
          <div className="absolute inset-x-2 bottom-2 rounded-xl bg-rose-950/85 px-3 py-1.5 text-[11px] text-rose-200">
            {loadErr}
          </div>
        )}
      </div>

      {model && (
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F5F5F7] p-2.5 text-center text-[11px] dark:bg-[#09090B]">
          <div>
            <span className="block text-[9px] uppercase font-bold text-slate-400">Formato</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              .{model.sourceFormat.toLowerCase()}
            </span>
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-slate-400">Triângulos</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {model.triangleCount > 0 ? model.triangleCount.toLocaleString("pt-BR") : "—"}
            </span>
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-slate-400">Mapas PBR</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {model.textureCount}
            </span>
          </div>
        </div>
      )}

      {model?.glbUrl ? (
        <Link
          href={workspaceHref}
          data-testid="open-workspace-from-preview"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#18181B] px-4 text-xs font-bold text-[#EDE5D8] shadow-sm hover:opacity-95 active:scale-[0.99] transition dark:bg-[#EDE5D8] dark:text-[#18181B]"
        >
          <span>🚀</span>
          <span>Abrir no Workspace 3D Completo →</span>
        </Link>
      ) : null}
    </div>
  );
}
