"use client";

import * as THREE from "three";
import {
  STUDIO_GROUND_PRESETS,
  type StudioGroundMaterialId,
} from "@/lib/acervo/scene-compiler";

export interface StudioGroundSystemController {
  group: THREE.Group;
  groundPlaneMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
  shadowCatcherMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  skyDomeMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  gridHelper: THREE.GridHelper;
  focusRingMesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  updateSkyDome: (options: {
    visible: boolean;
    texture?: THREE.Texture | null;
    sunAzimuthDeg: number;
    blurNormalized: number; // 0..1
    tintHex?: string;
  }) => void;
  updateGroundPreset: (
    presetId: StudioGroundMaterialId,
    loadedTexture?: THREE.Texture | null,
    maxAnisotropy?: number,
    options?: {
      scale?: number;
      rotationDeg?: number;
      colorHex?: string;
    }
  ) => void;
  setGridVisible: (visible: boolean) => void;
  triggerFocusRing: (point: THREE.Vector3, normal?: THREE.Vector3) => void;
  stepFocusRing: (dt: number) => boolean;
  dispose: () => void;
}

function createRadialFadeAlphaTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, size * 0.08, half, half, half * 0.98);
  grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.45, "rgba(255, 255, 255, 0.92)");
  grad.addColorStop(0.75, "rgba(255, 255, 255, 0.38)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Gera mapas procedurais tileable leves (albedo, normalMap e roughnessMap) em Canvas 256x256
 * para responder fisicamente à luz solar nos presets Concreto, Deck, Asfalto, Relva e Pedra.
 */
function createProceduralGroundMaps(presetId: StudioGroundMaterialId): {
  albedoTex: THREE.CanvasTexture | null;
  normalTex: THREE.CanvasTexture | null;
  roughnessTex: THREE.CanvasTexture | null;
} {
  if (typeof document === "undefined" || presetId === "shadow-catcher") {
    return { albedoTex: null, normalTex: null, roughnessTex: null };
  }

  const size = 256;
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext("2d");

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext("2d");

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext("2d");

  if (!aCtx || !nCtx || !rCtx) {
    return { albedoTex: null, normalTex: null, roughnessTex: null };
  }

  const preset = STUDIO_GROUND_PRESETS[presetId] || STUDIO_GROUND_PRESETS.concreto;

  // Base fill
  aCtx.fillStyle = preset.baseColorHex;
  aCtx.fillRect(0, 0, size, size);

  // Neutral tangent-space normal (#8080FF)
  nCtx.fillStyle = "rgb(128, 128, 255)";
  nCtx.fillRect(0, 0, size, size);

  const baseRoughByte = Math.round(preset.roughness * 255);
  rCtx.fillStyle = `rgb(${baseRoughByte}, ${baseRoughByte}, ${baseRoughByte})`;
  rCtx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random generator
  let seed = presetId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0) * 31, 1337);
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  if (presetId === "cumaru") {
    // Réguas de deck de madeira com frisos longitudinais
    const planks = 6;
    const plankH = size / planks;
    for (let i = 0; i < planks; i++) {
      const y = i * plankH;
      const shade = Math.round((rand() - 0.5) * 18);
      aCtx.fillStyle = shade >= 0 ? `rgba(255,235,210,0.08)` : `rgba(30,15,5,0.12)`;
      aCtx.fillRect(0, y, size, plankH - 2);
      // Junta de dilatação escura
      aCtx.fillStyle = "rgba(24, 16, 10, 0.72)";
      aCtx.fillRect(0, y + plankH - 2, size, 2);
      // Normal groove on plank seam
      nCtx.fillStyle = "rgb(128, 92, 245)";
      nCtx.fillRect(0, y + plankH - 3, size, 2);
      nCtx.fillStyle = "rgb(128, 164, 245)";
      nCtx.fillRect(0, y, size, 2);
      // Roughness variation per plank
      const rVal = Math.min(255, Math.max(80, baseRoughByte + shade));
      rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      rCtx.fillRect(0, y, size, plankH - 2);
    }
  } else if (presetId === "asfalto") {
    // Granulometria mineral de asfalto betuminoso
    for (let i = 0; i < 1800; i++) {
      const x = Math.floor(rand() * size);
      const y = Math.floor(rand() * size);
      const w = 1 + Math.floor(rand() * 3);
      const bright = rand() > 0.5;
      aCtx.fillStyle = bright ? "rgba(220,225,235,0.11)" : "rgba(10,12,15,0.18)";
      aCtx.fillRect(x, y, w, w);
      const nx = 110 + Math.floor(rand() * 36);
      const ny = 110 + Math.floor(rand() * 36);
      nCtx.fillStyle = `rgb(${nx},${ny},250)`;
      nCtx.fillRect(x, y, w, w);
      const rv = Math.min(255, Math.max(150, baseRoughByte + Math.floor((rand() - 0.5) * 45)));
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x, y, w, w);
    }
  } else if (presetId === "relva") {
    // Micro-fibras de relva sintética / paisagismo
    for (let i = 0; i < 2000; i++) {
      const x = Math.floor(rand() * size);
      const y = Math.floor(rand() * size);
      const h = 2 + Math.floor(rand() * 5);
      aCtx.fillStyle = rand() > 0.45 ? "rgba(110,175,85,0.16)" : "rgba(25,55,25,0.18)";
      aCtx.fillRect(x, y, 1, h);
      const nx = 108 + Math.floor(rand() * 40);
      const ny = 108 + Math.floor(rand() * 40);
      nCtx.fillStyle = `rgb(${nx},${ny},248)`;
      nCtx.fillRect(x, y, 2, 2);
    }
  } else {
    // Concreto arquitetônico / Pedra com juntas modulares sutis
    aCtx.strokeStyle = "rgba(40, 40, 44, 0.16)";
    aCtx.lineWidth = 2;
    aCtx.strokeRect(1, 1, size - 2, size - 2);
    nCtx.strokeStyle = "rgb(112, 112, 245)";
    nCtx.lineWidth = 2;
    nCtx.strokeRect(1, 1, size - 2, size - 2);
    for (let i = 0; i < 700; i++) {
      const x = Math.floor(rand() * size);
      const y = Math.floor(rand() * size);
      const r = 1 + Math.floor(rand() * 3);
      aCtx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      aCtx.fillRect(x, y, r, r);
      const nx = 122 + Math.floor(rand() * 12);
      const ny = 122 + Math.floor(rand() * 12);
      nCtx.fillStyle = `rgb(${nx},${ny},254)`;
      nCtx.fillRect(x, y, r, r);
    }
  }

  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  const normalTex = new THREE.CanvasTexture(normalCanvas);
  const roughnessTex = new THREE.CanvasTexture(roughnessCanvasOrFallback(roughCanvas));

  for (const t of [albedoTex, normalTex, roughnessTex]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  albedoTex.colorSpace = THREE.SRGBColorSpace;

  return { albedoTex, normalTex, roughnessTex };
}

function roughnessCanvasOrFallback(c: HTMLCanvasElement): HTMLCanvasElement {
  return c;
}

function createGroundedDomeGeometry(radius = 85, groundRadius = 42): THREE.SphereGeometry {
  const geom = new THREE.SphereGeometry(radius, 64, 40);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < 0) {
      const flattenFactor = Math.max(0.02, 1.0 - Math.min(1.0, -v.y / (radius * 0.45)));
      v.y = v.y * 0.06 * flattenFactor - 0.03;
      const horizDist = Math.hypot(v.x, v.z);
      if (horizDist > 0.001) {
        const clampedDist = Math.min(radius, groundRadius + (horizDist / radius) * (radius - groundRadius));
        const scaleXZ = clampedDist / horizDist;
        v.x *= scaleXZ;
        v.z *= scaleXZ;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

export function createStudioGroundSystem(): StudioGroundSystemController {
  const group = new THREE.Group();
  group.name = "StudioGroundAndSkySystem";

  // 1. Ground-Projected Skybox Dome (Céu Real HDRI 360°)
  const skyDomeGeom = createGroundedDomeGeometry(88, 38);
  const skyDomeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const skyDomeMesh = new THREE.Mesh(skyDomeGeom, skyDomeMat);
  skyDomeMesh.name = "StudioGroundedSkyDome";
  skyDomeMesh.renderOrder = -10;
  skyDomeMesh.visible = false;
  group.add(skyDomeMesh);

  // 2. Plano de Chão Físico PBR com Fade Radial Infinito no Horizonte
  const radialAlphaTex = createRadialFadeAlphaTexture();
  const groundGeom = new THREE.PlaneGeometry(56, 56, 1, 1);
  const defaultPreset = STUDIO_GROUND_PRESETS.concreto;

  const groundMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(defaultPreset.baseColorHex),
    roughness: defaultPreset.roughness,
    metalness: defaultPreset.metalness,
    clearcoat: defaultPreset.clearcoat,
    clearcoatRoughness: 0.25,
    normalScale: new THREE.Vector2(0.45, 0.45),
    alphaMap: radialAlphaTex,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });

  const groundPlaneMesh = new THREE.Mesh(groundGeom, groundMat);
  groundPlaneMesh.name = "StudioPhysicalGroundPlane";
  groundPlaneMesh.rotation.x = -Math.PI / 2;
  groundPlaneMesh.position.y = -0.003;
  groundPlaneMesh.receiveShadow = true;
  group.add(groundPlaneMesh);

  // 3. Shadow Catcher Puro (garante sombras solares nítidas em todos os modos de solo)
  const shadowGeom = new THREE.PlaneGeometry(48, 48);
  const shadowMat = new THREE.ShadowMaterial({
    opacity: 0.28,
    color: 0x18181b,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const shadowCatcherMesh = new THREE.Mesh(shadowGeom, shadowMat);
  shadowCatcherMesh.name = "StudioShadowCatcher";
  shadowCatcherMesh.rotation.x = -Math.PI / 2;
  shadowCatcherMesh.position.y = -0.001;
  shadowCatcherMesh.receiveShadow = true;
  group.add(shadowCatcherMesh);

  // 4. Grid de Referência Arquitetônica 1m × 1m (Atalho 'G' do 3ds Max)
  const gridHelper = new THREE.GridHelper(32, 32, 0x18181b, 0x71717a);
  gridHelper.name = "StudioArchitecturalGrid1m";
  gridHelper.position.y = 0.001;
  const gridMaterials = Array.isArray(gridHelper.material)
    ? gridHelper.material
    : [gridHelper.material];
  for (const gm of gridMaterials) {
    gm.transparent = true;
    gm.opacity = 0.24;
    gm.depthWrite = false;
  }
  gridHelper.visible = false;
  group.add(gridHelper);

  // 5. Anel de Foco Dinâmico (Duplo-Clique estilo Sketchfab)
  const focusRingGeom = new THREE.RingGeometry(0.09, 0.14, 36);
  const focusRingMat = new THREE.MeshBasicMaterial({
    color: 0xede5d8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const focusRingMesh = new THREE.Mesh(focusRingGeom, focusRingMat);
  focusRingMesh.name = "StudioDynamicFocusRing";
  focusRingMesh.renderOrder = 999;
  focusRingMesh.visible = false;
  group.add(focusRingMesh);

  const proceduralCache = new Map<
    StudioGroundMaterialId,
    {
      albedoTex: THREE.CanvasTexture | null;
      normalTex: THREE.CanvasTexture | null;
      roughnessTex: THREE.CanvasTexture | null;
    }
  >();

  let focusRingTimer = 0;
  const focusRingDuration = 0.65;

  const updateSkyDome: StudioGroundSystemController["updateSkyDome"] = ({
    visible,
    texture,
    sunAzimuthDeg,
    blurNormalized,
    tintHex,
  }) => {
    skyDomeMesh.visible = visible && Boolean(texture);
    if (texture) {
      skyDomeMat.map = texture;
      const baseColor = new THREE.Color(tintHex || "#FFFFFF");
      const white = new THREE.Color("#FFFFFF");
      skyDomeMat.color.copy(white).lerp(baseColor, Math.min(0.65, blurNormalized * 0.65));
      skyDomeMat.opacity = 1.0 - Math.min(0.35, blurNormalized * 0.35);
      skyDomeMat.transparent = blurNormalized > 0.01;
      skyDomeMat.needsUpdate = true;
    }
    skyDomeMesh.rotation.y = THREE.MathUtils.degToRad(sunAzimuthDeg - 135);
  };

  const updateGroundPreset: StudioGroundSystemController["updateGroundPreset"] = (
    presetId,
    loadedTexture,
    maxAnisotropy = 8,
    options
  ) => {
    const preset = STUDIO_GROUND_PRESETS[presetId] || STUDIO_GROUND_PRESETS.concreto;
    if (preset.isShadowCatcherOnly) {
      groundPlaneMesh.visible = false;
      shadowMat.opacity = 0.34;
      return;
    }

    groundPlaneMesh.visible = true;
    shadowMat.opacity = 0.24;

    const repeatTiling = options?.scale ?? preset.repeatTiling;
    const rotationRad = THREE.MathUtils.degToRad(options?.rotationDeg ?? 0);
    const tintColor = options?.colorHex || preset.baseColorHex;

    let procMaps = proceduralCache.get(presetId);
    if (!procMaps) {
      procMaps = createProceduralGroundMaps(presetId);
      proceduralCache.set(presetId, procMaps);
    }

    const activeAlbedo = loadedTexture || procMaps.albedoTex;
    const applyTransform = (tex: THREE.Texture | null) => {
      if (!tex) return;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.center.set(0.5, 0.5);
      tex.rotation = rotationRad;
      tex.repeat.set(repeatTiling, repeatTiling);
      tex.anisotropy = maxAnisotropy;
      tex.needsUpdate = true;
    };

    applyTransform(activeAlbedo);
    applyTransform(procMaps.normalTex);
    applyTransform(procMaps.roughnessTex);

    groundMat.map = activeAlbedo;
    groundMat.normalMap = procMaps.normalTex;
    groundMat.roughnessMap = procMaps.roughnessTex;
    groundMat.color.set(tintColor);
    groundMat.roughness = preset.roughness;
    groundMat.metalness = preset.metalness;
    groundMat.clearcoat = preset.clearcoat;
    groundMat.needsUpdate = true;
  };

  const setGridVisible = (visible: boolean) => {
    gridHelper.visible = visible;
  };

  const triggerFocusRing = (point: THREE.Vector3, normal?: THREE.Vector3) => {
    focusRingMesh.position.copy(point);
    if (normal && normal.lengthSq() > 0.0001) {
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal.clone().normalize()
      );
      focusRingMesh.quaternion.copy(targetQuat);
      focusRingMesh.position.addScaledVector(normal, 0.012);
    } else {
      focusRingMesh.rotation.set(-Math.PI / 2, 0, 0);
      focusRingMesh.position.y += 0.012;
    }
    focusRingMesh.scale.setScalar(0.35);
    focusRingMat.opacity = 0.95;
    focusRingMesh.visible = true;
    focusRingTimer = focusRingDuration;
  };

  const stepFocusRing = (dt: number): boolean => {
    if (focusRingTimer <= 0) {
      if (focusRingMesh.visible) {
        focusRingMesh.visible = false;
      }
      return false;
    }
    focusRingTimer = Math.max(0, focusRingTimer - dt);
    const progress = 1.0 - focusRingTimer / focusRingDuration;
    const scale = 0.35 + progress * 1.45;
    focusRingMesh.scale.setScalar(scale);
    focusRingMat.opacity = Math.max(0, (1.0 - progress) * 0.95);
    if (focusRingTimer <= 0) {
      focusRingMesh.visible = false;
    }
    return true;
  };

  const dispose = () => {
    skyDomeGeom.dispose();
    skyDomeMat.dispose();
    groundGeom.dispose();
    if (radialAlphaTex) radialAlphaTex.dispose();
    for (const maps of proceduralCache.values()) {
      maps.albedoTex?.dispose();
      maps.normalTex?.dispose();
      maps.roughnessTex?.dispose();
    }
    proceduralCache.clear();
    groundMat.dispose();
    shadowGeom.dispose();
    shadowMat.dispose();
    gridHelper.geometry.dispose();
    for (const gm of gridMaterials) {
      gm.dispose();
    }
    focusRingGeom.dispose();
    focusRingMat.dispose();
  };

  return {
    group,
    groundPlaneMesh,
    shadowCatcherMesh,
    skyDomeMesh,
    gridHelper,
    focusRingMesh,
    updateSkyDome,
    updateGroundPreset,
    setGridVisible,
    triggerFocusRing,
    stepFocusRing,
    dispose,
  };
}
