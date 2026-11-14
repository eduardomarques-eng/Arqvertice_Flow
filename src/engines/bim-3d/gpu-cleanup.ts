import * as THREE from "three";

function disposeMaterial(mat: THREE.Material) {
  const std = mat as THREE.MeshStandardMaterial;
  const maps = [
    std.map,
    std.normalMap,
    std.roughnessMap,
    std.metalnessMap,
    std.aoMap,
    std.emissiveMap,
    std.alphaMap,
    std.bumpMap,
    std.displacementMap,
    std.envMap,
  ];
  for (const tex of maps) {
    if (tex && typeof tex.dispose === "function") {
      tex.dispose();
    }
  }
  mat.dispose();
}

export function disposeObject3D(root: THREE.Object3D | null | undefined) {
  if (!root) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && typeof mesh.geometry.dispose === "function") {
      mesh.geometry.dispose();
    }
    const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) {
      mat.forEach(disposeMaterial);
    } else if (mat) {
      disposeMaterial(mat);
    }
  });
}
