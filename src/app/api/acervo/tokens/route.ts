import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "ENGENHEIRO" && user.role !== "ARQUITETO")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const tokens = await prisma.acervoApiToken.findMany({
      where: projectId ? { projectId } : undefined,
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        projectId: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, tokens });
  } catch (err: unknown) {
    console.error("[ACERVO_TOKENS_GET_ERROR]", err);
    return NextResponse.json({ error: "Falha ao listar tokens." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "ENGENHEIRO" && user.role !== "ARQUITETO")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { name = "Plugin Revit/AutoCAD", projectId } = body;

    // Gera token aleatório de alta entropia
    const rawSecret = crypto.randomBytes(24).toString("hex");
    const rawToken = `av_cde_${rawSecret}`;
    const tokenPrefix = `av_cde_${rawSecret.slice(0, 6)}...`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const apiToken = await prisma.acervoApiToken.create({
      data: {
        name,
        tokenHash,
        tokenPrefix,
        projectId: projectId || null,
        createdById: user.id,
      },
    });

    // O rawToken só é exibido na resposta de criação
    return NextResponse.json({
      success: true,
      token: {
        id: apiToken.id,
        name: apiToken.name,
        tokenPrefix: apiToken.tokenPrefix,
        rawToken, // Exibido apenas uma vez para o usuário copiar
      },
    });
  } catch (err: unknown) {
    console.error("[ACERVO_TOKENS_POST_ERROR]", err);
    return NextResponse.json({ error: "Falha ao gerar token." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem revogar tokens." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("id");

    if (!tokenId) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    await prisma.acervoApiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Token revogado." });
  } catch (err: unknown) {
    console.error("[ACERVO_TOKENS_DELETE_ERROR]", err);
    return NextResponse.json({ error: "Falha ao revogar token." }, { status: 500 });
  }
}
