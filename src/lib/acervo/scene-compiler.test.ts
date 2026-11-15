import { describe, expect, it } from "vitest";
import {
  DEFAULT_3D_TEMPLATES_MANIFEST,
  STUDIO_GROUND_PRESETS,
  STUDIO_INSPECTOR_MODES,
  classifyMaterialToPbrPreset,
  classifyPipeline3DAsset,
  detectSceneNormalization,
  findTemplate3DAvatar,
  findTemplate3DModel,
  normalizeVertexPosition,
  resolve3dsMaxShortcut,
} from "./scene-compiler";
import { resolvePointerDragAction } from "@/engines/studio-3d/StudioCameraRig";

describe("scene-compiler — Universal Scene Normalization & Smart PBR Shader Compiler", () => {
  it("converts millimeter scenes (3ds Max/CAD) to meters with floor at Y = 0 and 1st-person camera at Y = 1.65m", () => {
    const rawBounds = {
      min: [-1500, 0, -1200] as [number, number, number],
      max: [1500, 3000, 1200] as [number, number, number],
    };

    const norm = detectSceneNormalization(rawBounds, { forceUpAxis: "Y_UP" });
    expect(norm.detectedUnit).toBe("mm");
    expect(norm.unitScaleFactor).toBe(0.001);
    expect(norm.firstPersonCamera.position[1]).toBe(1.65);
    expect(norm.firstPersonCamera.fov).toBe(55);
    expect(norm.thirdPersonCamera.fov).toBe(42);

    const floorVertex = normalizeVertexPosition(0, 0, 0, norm);
    expect(floorVertex[1]).toBeCloseTo(0, 4);

    const ceilingVertex = normalizeVertexPosition(0, 3000, 0, norm);
    expect(ceilingVertex[1]).toBeCloseTo(3.0, 3);
  });

  it("classifies legacy 3ds Max wirecolor and material names into calibrated PBR presets", () => {
    expect(classifyMaterialToPbrPreset("Vidro_Temperado_10mm", "GuardaCorpo").id).toBe(
      "vidro_pele_de_vidro"
    );
    expect(classifyMaterialToPbrPreset("Aluminio_Preto_Fosco", "Caixilho").id).toBe(
      "metal_matte_black"
    );
    expect(classifyMaterialToPbrPreset("Marmore_Dekton_Bancada", "Ilha").id).toBe(
      "pedra_bancada_clearcoat"
    );
    expect(classifyMaterialToPbrPreset("Deck_Madeira_Cumaru", "Piso").id).toBe(
      "madeira_deck_natural"
    );
    expect(classifyMaterialToPbrPreset("wire_028028028", "Frame_Preto").id).toBe(
      "metal_matte_black"
    );
  });

  it("resolves compiled 3D template models by slug or id and enforces zero procedural fallback for NEEDS_EXPORT", () => {
    const kitchen = findTemplate3DModel("cozinha-interna");
    expect(kitchen).not.toBeNull();
    expect(kitchen?.glbUrl).toBe("/assets/3d-templates/models/cozinha-interna.glb");
    expect(kitchen?.status).toBe("READY");
    expect(kitchen?.usedProceduralFallback).toBe(false);

    const facade = findTemplate3DModel("fachada-deck-lazer");
    expect(facade).not.toBeNull();
    expect(facade?.status).toBe("NEEDS_EXPORT");
    expect(facade?.usedProceduralFallback).toBe(false);
    expect(facade?.glbUrl).toBeNull();
  });

  it("classifies 3D pipeline assets into READY, WARNING and ERROR and resolves avatars", () => {
    expect(
      classifyPipeline3DAsset({
        format: ".glb",
        compiledUrl: "/assets/3d-templates/models/cozinha-interna.glb",
        compiledSizeBytes: 120_000,
        uvIntact: true,
        texturesOptimized: true,
        scaleNormalized: true,
      }).status
    ).toBe("READY");

    expect(
      classifyPipeline3DAsset({
        format: ".fbx",
        compiledUrl: "/assets/3d-templates/models/movel.glb",
        compiledSizeBytes: 3_500_000,
        uvIntact: true,
        texturesOptimized: false,
        scaleNormalized: true,
      }).status
    ).toBe("WARNING");

    expect(
      classifyPipeline3DAsset({
        format: ".max",
        compiledUrl: null,
        compiledSizeBytes: 0,
        uvIntact: false,
        texturesOptimized: false,
        scaleNormalized: false,
      }).status
    ).toBe("ERROR");

    const fem = findTemplate3DAvatar("avatar-feminino");
    expect(fem).not.toBeNull();
    expect(fem?.status).toBe("NEEDS_EXPORT");
    expect(fem?.glbUrl).toBeNull();
  });

  it("exposes 2K WebP skyboxUrl on all 4 HDRIs, 4 PBR ground presets, and 5 Sketchfab Model Inspector modes", () => {
    expect(DEFAULT_3D_TEMPLATES_MANIFEST.hdris).toHaveLength(4);
    for (const hdri of DEFAULT_3D_TEMPLATES_MANIFEST.hdris) {
      expect(hdri.skyboxUrl).toBe(`/assets/3d-templates/hdri/${hdri.id}-sky.webp`);
    }

    expect(Object.keys(STUDIO_GROUND_PRESETS)).toEqual([
      "concreto",
      "cumaru",
      "pedra",
      "shadow-catcher",
    ]);
    expect(STUDIO_GROUND_PRESETS.concreto.textureUrl).toBe(
      "/assets/3d-templates/hdri/ground-concreto.webp"
    );
    expect(STUDIO_GROUND_PRESETS["shadow-catcher"].isShadowCatcherOnly).toBe(true);

    expect(STUDIO_INSPECTOR_MODES.map((m) => m.id)).toEqual([
      "realista-pbr-rt",
      "shaded-edged-f4",
      "clay-maquete",
      "wireframe",
      "base-color-albedo",
    ]);
  });

  it("maps native 3ds Max and Sketchfab keyboard & mouse shortcuts (Z, F3, F4, G, C/V, Alt+MMB, MMB)", () => {
    // 1. Mouse buttons: 3ds Max Alt+MMB -> orbit, MMB -> pan, Ctrl+Alt+MMB -> zoom; Sketchfab LMB -> orbit, RMB -> pan
    expect(resolvePointerDragAction(1, true, false, false)).toBe("orbit");
    expect(resolvePointerDragAction(1, false, false, false)).toBe("pan");
    expect(resolvePointerDragAction(1, true, true, false)).toBe("zoom");
    expect(resolvePointerDragAction(0, false, false, false)).toBe("orbit");
    expect(resolvePointerDragAction(2, false, false, false)).toBe("pan");

    // 2. Keyboard shortcuts: Z (Zoom Extents), F3 (Wireframe <-> PBR), F4 (Edged Faces), G (Grid), C/V (Camera)
    const baseState = {
      visualMode: "realista-pbr-rt" as const,
      showGrid: false,
      cameraMode: "third-person" as const,
    };

    const zRes = resolve3dsMaxShortcut("Z", baseState);
    expect(zRes.handled).toBe(true);
    expect(zRes.triggerZoomExtents).toBe(true);

    const f3Res = resolve3dsMaxShortcut("F3", baseState);
    expect(f3Res.visualMode).toBe("wireframe");
    expect(resolve3dsMaxShortcut("F3", f3Res).visualMode).toBe("realista-pbr-rt");

    const f4Res = resolve3dsMaxShortcut("F4", baseState);
    expect(f4Res.visualMode).toBe("shaded-edged-f4");
    expect(resolve3dsMaxShortcut("F4", f4Res).visualMode).toBe("realista-pbr-rt");

    const gRes = resolve3dsMaxShortcut("G", baseState);
    expect(gRes.showGrid).toBe(true);

    const cRes = resolve3dsMaxShortcut("C", baseState);
    expect(cRes.cameraMode).toBe("first-person");
  });
});
