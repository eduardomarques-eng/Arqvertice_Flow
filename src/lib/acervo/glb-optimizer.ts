import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, reorder, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import type { Project3DOptimizationStats } from "./showcase-3d-defaults";

export * from "./showcase-3d-defaults";

/**
 * Executa o funil completo de otimização de um buffer .glb utilizando @gltf-transform e Meshoptimizer:
 * - Desduplicação de accessors, meshes e materiais (dedup)
 * - Remoção de nós e propriedades órfãs (prune)
 * - Reordenação para localidade de cache de vértices (reorder)
 * - Quantização de atributos geométricos (quantize)
 * - Compressão Meshopt (EXT_meshopt_compression)
 */
export async function optimizeGlbBuffer(inputBuffer: Uint8Array): Promise<{
  optimizedBuffer: Uint8Array;
  stats: Project3DOptimizationStats;
}> {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
  });

  const document = await io.readBinary(inputBuffer);

  const root = document.getRoot();
  let vertexCount = 0;
  let drawCalls = 0;

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      drawCalls += 1;
      const pos = prim.getAttribute("POSITION");
      if (pos) {
        vertexCount += pos.getCount();
      }
    }
  }

  await document.transform(
    dedup(),
    prune(),
    reorder({ encoder: MeshoptEncoder }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" })
  );

  const optimizedBuffer = await io.writeBinary(document);
  const originalBytes = inputBuffer.byteLength;
  const optimizedBytes = optimizedBuffer.byteLength;
  const compressionRatio =
    originalBytes > 0 ? Number(((1 - optimizedBytes / originalBytes) * 100).toFixed(1)) : 0;

  return {
    optimizedBuffer,
    stats: {
      originalBytes,
      optimizedBytes,
      compressionRatio: Math.max(0, compressionRatio),
      meshopt: true,
      ktx2: false,
      vertexCount,
      drawCalls,
    },
  };
}
