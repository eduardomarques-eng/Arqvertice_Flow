import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;
    const row = await prisma.pipeline3DAssetState.findUnique({
      where: { id },
      select: { binaryBase64: true, sourceFormat: true, name: true },
    });

    if (!row?.binaryBase64) {
      return NextResponse.json({ error: "Ativo 3D não encontrado no armazenamento." }, { status: 404 });
    }

    const buf = Buffer.from(row.binaryBase64, "base64");
    const fmt = row.sourceFormat.toLowerCase();
    const contentType = fmt.includes("usdz")
      ? "model/vnd.usdz+zip"
      : "model/gltf-binary";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro ao servir ativo 3D.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
