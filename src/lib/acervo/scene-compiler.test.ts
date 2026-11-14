import { describe, expect, it } from "vitest";
import {
  classifyMaterialToPbrPreset,
  detectSceneNormalization,
  findTemplate3DModel,
  normalizeVertexPosition,
} from "./scene-compiler";

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

  it("resolves compiled 3D template models by slug or id", () => {
    const kitchen = findTemplate3DModel("cozinha-interna");
    expect(kitchen).not.toBeNull();
    expect(kitchen?.glbUrl).toBe("/assets/3d-templates/models/cozinha-interna.glb");
  });
});
