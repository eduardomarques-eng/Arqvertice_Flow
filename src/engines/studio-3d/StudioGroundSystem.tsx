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
    maxAnisotropy?: number
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

function createGroundedDomeGeometry(radius = 85, groundRadius = 42): THREE.SphereGeometry {
  const geom = new THREE.SphereGeometry(radius, 64, 40);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < 0) {
      // Ground-Projection: flatten the lower hemisphere onto a smooth bowl near Y = -0.04
      // so the horizon and ground of the HDRI anchor the model rather than floating in space.
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
      // Simula suavização/desfoque misturando tintura atmosférica quando blurNormalized > 0
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
    maxAnisotropy = 8
  ) => {
    const preset = STUDIO_GROUND_PRESETS[presetId] || STUDIO_GROUND_PRESETS.concreto;
    if (preset.isShadowCatcherOnly) {
      groundPlaneMesh.visible = false;
      shadowMat.opacity = 0.34;
      return;
    }

    groundPlaneMesh.visible = true;
    shadowMat.opacity = 0.24;
    groundMat.color.set(preset.baseColorHex);
    groundMat.roughness = preset.roughness;
    groundMat.metalness = preset.metalness;
    groundMat.clearcoat = preset.clearcoat;

    if (loadedTexture) {
      loadedTexture.wrapS = THREE.RepeatWrapping;
      loadedTexture.wrapT = THREE.RepeatWrapping;
      loadedTexture.repeat.set(preset.repeatTiling, preset.repeatTiling);
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.anisotropy = maxAnisotropy;
      loadedTexture.needsUpdate = true;
      groundMat.map = loadedTexture;
      groundMat.color.set("#FFFFFF");
    } else {
      groundMat.map = null;
    }
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
