"use client";

import * as THREE from "three";

export type StudioCameraMode = "third-person" | "first-person";

export interface CameraRigState {
  mode: StudioCameraMode;
  target: THREE.Vector3;
  desiredTarget: THREE.Vector3;
  spherical: THREE.Spherical;
  desiredRadius: number;
  desiredPhi: number;
  desiredTheta: number;
  fpPosition: THREE.Vector3;
  fpDesiredPosition: THREE.Vector3;
  fpYaw: number;
  fpDesiredYaw: number;
  fpPitch: number;
  fpDesiredPitch: number;
  isDragging: boolean;
  dragButton: number;
  lastPointerX: number;
  lastPointerY: number;
  pointerDownX: number;
  pointerDownY: number;
  keysPressed: Set<string>;
  teleportRingTimer: number;
  avatarHeading?: number;
}

export function detectFloorHeight(
  raycaster: THREE.Raycaster,
  modelRoot: THREE.Object3D | null,
  x: number,
  z: number
): number {
  if (!modelRoot) return 0;
  raycaster.set(new THREE.Vector3(x, 12, z), new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObject(modelRoot, true);
  if (hits.length === 0) return 0;
  // Usa o ponto mais baixo razoável próximo ao piso (entre -0.2m e 0.6m)
  const floorHit = hits.find((h) => h.point.y >= -0.25 && h.point.y <= 0.6);
  return floorHit ? floorHit.point.y : 0;
}

export function updateStudioCameraFrame(params: {
  st: CameraRigState;
  camera: THREE.PerspectiveCamera;
  joystick: { forward: number; right: number };
  avatarRoot: THREE.Object3D | null;
  modelRoot: THREE.Object3D | null;
  raycaster: THREE.Raycaster;
}): { movedByKeys: boolean; dampingActive: boolean } {
  const { st, camera, joystick, avatarRoot, modelRoot, raycaster } = params;
  const keys = st.keysPressed;
  const moveSpeed = 0.065;
  let movedByKeys = false;

  const forwardInput =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) +
    joystick.forward;
  const rightInput =
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
    joystick.right;

  if (Math.abs(forwardInput) > 0.01 || Math.abs(rightInput) > 0.01) {
    movedByKeys = true;
    if (st.mode === "first-person") {
      const forwardVec = new THREE.Vector3(-Math.sin(st.fpYaw), 0, -Math.cos(st.fpYaw));
      const rightVec = new THREE.Vector3(Math.cos(st.fpYaw), 0, -Math.sin(st.fpYaw));
      st.fpDesiredPosition.addScaledVector(forwardVec, forwardInput * moveSpeed);
      st.fpDesiredPosition.addScaledVector(rightVec, rightInput * moveSpeed);
      const floorY = detectFloorHeight(
        raycaster,
        modelRoot,
        st.fpDesiredPosition.x,
        st.fpDesiredPosition.z
      );
      st.fpDesiredPosition.y = floorY + 1.65;
    } else if (avatarRoot) {
      // Navegação em 3ª pessoa guiada pelo Avatar apoiado em Y = 0
      const camYaw = st.spherical.theta;
      const forwardVec = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      const rightVec = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
      const moveDelta = new THREE.Vector3()
        .addScaledVector(forwardVec, forwardInput * moveSpeed)
        .addScaledVector(rightVec, rightInput * moveSpeed);

      avatarRoot.position.x += moveDelta.x;
      avatarRoot.position.z += moveDelta.z;
      const floorY = detectFloorHeight(
        raycaster,
        modelRoot,
        avatarRoot.position.x,
        avatarRoot.position.z
      );
      avatarRoot.position.y = floorY;

      if (moveDelta.lengthSq() > 0.00001) {
        const targetAngle = Math.atan2(moveDelta.x, moveDelta.z);
        const currentAngle = avatarRoot.rotation.y;
        const deltaAngle = Math.atan2(
          Math.sin(targetAngle - currentAngle),
          Math.cos(targetAngle - currentAngle)
        );
        avatarRoot.rotation.y = currentAngle + deltaAngle * 0.18;
      }

      st.desiredTarget.set(
        avatarRoot.position.x,
        floorY + 1.15,
        avatarRoot.position.z
      );
    } else {
      st.desiredTheta -= rightInput * 0.025;
      st.desiredRadius = THREE.MathUtils.clamp(
        st.desiredRadius - forwardInput * 0.12,
        1.4,
        35
      );
    }
  }

  let dampingActive = false;
  if (st.mode === "first-person") {
    const posDiff = st.fpPosition.distanceTo(st.fpDesiredPosition);
    const yawDiff = Math.abs(st.fpYaw - st.fpDesiredYaw);
    const pitchDiff = Math.abs(st.fpPitch - st.fpDesiredPitch);
    if (posDiff > 0.0015 || yawDiff > 0.0008 || pitchDiff > 0.0008) {
      dampingActive = true;
      st.fpPosition.lerp(st.fpDesiredPosition, 0.14);
      st.fpYaw = THREE.MathUtils.lerp(st.fpYaw, st.fpDesiredYaw, 0.18);
      st.fpPitch = THREE.MathUtils.lerp(st.fpPitch, st.fpDesiredPitch, 0.18);
    }
    camera.position.copy(st.fpPosition);
    const lookDir = new THREE.Vector3(
      -Math.sin(st.fpYaw) * Math.cos(st.fpPitch),
      Math.sin(st.fpPitch),
      -Math.cos(st.fpYaw) * Math.cos(st.fpPitch)
    );
    camera.lookAt(camera.position.clone().add(lookDir));
  } else {
    const radDiff = Math.abs(st.spherical.radius - st.desiredRadius);
    const phiDiff = Math.abs(st.spherical.phi - st.desiredPhi);
    const thetaDiff = Math.abs(st.spherical.theta - st.desiredTheta);
    const targetDiff = st.target.distanceTo(st.desiredTarget);

    if (radDiff > 0.002 || phiDiff > 0.001 || thetaDiff > 0.001 || targetDiff > 0.002) {
      dampingActive = true;
      st.spherical.radius = THREE.MathUtils.lerp(st.spherical.radius, st.desiredRadius, 0.14);
      st.spherical.phi = THREE.MathUtils.lerp(st.spherical.phi, st.desiredPhi, 0.14);
      st.spherical.theta = THREE.MathUtils.lerp(st.spherical.theta, st.desiredTheta, 0.14);
      st.target.lerp(st.desiredTarget, 0.14);
    }
    const offset = new THREE.Vector3().setFromSpherical(st.spherical);
    camera.position.copy(st.target).add(offset);
    camera.lookAt(st.target);
  }

  return { movedByKeys, dampingActive };
}
