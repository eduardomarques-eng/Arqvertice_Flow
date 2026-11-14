import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authenticatePluginRequest } from "@/lib/acervo/plugin-auth";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePluginRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") || auth.ctx.tokenProjectId;
    if (!projectId) {
      return NextResponse.json({ error: "Parâmetro projectId obrigatório." }, { status: 400 });
    }

    const [project, folders, namingRules] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, status: true },
      }),
      prisma.acervoFolder.findMany({
        where: { projectId },
        select: { id: true, name: true, phase: true, discipline: true, parentId: true },
        orderBy: [{ phase: "asc" }, { name: "asc" }],
      }),
      prisma.acervoNamingRule.findMany({
        where: { OR: [{ projectId }, { projectId: null }] },
        select: { id: true, mask: true, example: true, policy: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Empreendimento não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project,
      phases: [
        { code: "EP", enum: "ESTUDO_PRELIMINAR", label: "Estudo Preliminar" },
        { code: "AP", enum: "ANTEPROJETO", label: "Anteprojeto" },
        { code: "EX", enum: "PROJETO_EXECUTIVO", label: "Projeto Executivo" },
        { code: "AB", enum: "AS_BUILT", label: "As Built" },
      ],
      disciplines: [
        { code: "ARQ", enum: "ARQUITETURA", label: "Arquitetura" },
        { code: "EST", enum: "ESTRUTURAL", label: "Estrutura" },
        { code: "ELE", enum: "ELETRICO", label: "Instalações Elétricas" },
        { code: "HID", enum: "HIDROSSANITARIO", label: "Instalações Hidrossanitárias" },
        { code: "INT", enum: "INTERIORES", label: "Interiores" },
        { code: "FAC", enum: "RENDER_3D", label: "Fachadas / Render 3D" },
      ],
      folders,
      namingMask: namingRules[0] || {
        mask: "EMP-DIS-FASE-PRANCHA-R00",
        example: "RES-ARQ-EXE-001-R00",
        policy: "STRICT_BLOCK",
      },
      titleBlockMapping: {
        sheetCode: ["CODIGO_PRANCHA", "Sheet Number", "PRANCHA", "COD"],
        sheetTitle: ["TITULO_PRANCHA", "Sheet Name", "TITULO", "TITLE"],
        discipline: ["DISCIPLINA", "Discipline", "DIS"],
        phase: ["FASE", "Phase", "ETAPA"],
        revision: ["REVISAO", "Current Revision", "REV"],
        scale: ["ESCALA", "Scale"],
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao carregar contexto do plugin." },
      { status: 500 }
    );
  }
}
