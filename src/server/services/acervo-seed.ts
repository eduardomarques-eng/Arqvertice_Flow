import { prisma } from "@/server/db";
import { ProjectDiscipline, ProjectStagePhase, AcervoCategory, AcervoWorkflowStatus } from "@prisma/client";

export async function seedAcervoManagerDemo() {
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!project) return;

  const demoSheets = [
    {
      code: "ARQ-PE-PLN-001",
      title: "Planta Baixa — Pavimento Térreo",
      discipline: ProjectDiscipline.ARQUITETURA,
      phase: ProjectStagePhase.PROJETO_EXECUTIVO,
      rev: "R02",
      status: AcervoWorkflowStatus.BOM_PARA_OBRA,
      fileName: "ARQ-PE-PLN-001-R02.pdf",
    },
    {
      code: "EST-PE-FOR-001",
      title: "Locação e Cargas de Pilares",
      discipline: ProjectDiscipline.ESTRUTURAL,
      phase: ProjectStagePhase.PROJETO_EXECUTIVO,
      rev: "R01",
      status: AcervoWorkflowStatus.APROVADO_COM_RESSALVAS,
      fileName: "EST-PE-FOR-001-R01.pdf",
    },
    {
      code: "ELE-PE-DIA-001",
      title: "Diagrama Unifilar e Quadro Geral",
      discipline: ProjectDiscipline.ELETRICO,
      phase: ProjectStagePhase.PROJETO_EXECUTIVO,
      rev: "R00",
      status: AcervoWorkflowStatus.EM_REVISAO_TECNICA,
      fileName: "ELE-PE-DIA-001-R00.pdf",
    },
    {
      code: "FAC-PE-DET-001",
      title: "Detalhamento de Brises e Pele de Vidro",
      discipline: ProjectDiscipline.ARQUITETURA,
      phase: ProjectStagePhase.PROJETO_EXECUTIVO,
      rev: "R00",
      status: AcervoWorkflowStatus.EM_ELABORACAO,
      fileName: "FAC-PE-DET-001-R00.pdf",
    },
  ];

  for (const sheet of demoSheets) {
    const existing = await prisma.acervoDocument.findUnique({
      where: {
        projectId_code: {
          projectId: project.id,
          code: sheet.code,
        },
      },
    });

    if (!existing) {
      const doc = await prisma.acervoDocument.create({
        data: {
          projectId: project.id,
          code: sheet.code,
          title: sheet.title,
          discipline: sheet.discipline,
          phase: sheet.phase,
          category: AcervoCategory.PLANTA_TECNICA_PDF,
        },
      });

      const rev = await prisma.acervoRevision.create({
        data: {
          documentId: doc.id,
          revisionNumber: sheet.rev,
          isCurrent: true,
          status: sheet.status,
          fileName: sheet.fileName,
          fileUrl: `https://storage.arqvertice.com.br/acervo/${sheet.fileName}`,
          fileSize: "4.2 MB",
          description: "Prancha técnica de referência inserida na fundação do Acervo Manager.",
        },
      });

      await prisma.acervoDocument.update({
        where: { id: doc.id },
        data: { currentRevisionId: rev.id },
      });

      await prisma.acervoWorkflowLog.create({
        data: {
          revisionId: rev.id,
          toStatus: sheet.status,
          action: "CARGA_INICIAL_SISTEMA",
          notes: "Homologação do Acervo Manager CDE.",
          performedByName: "Sistema ArqVértice",
          performedByRole: "ADMIN",
        },
      });
    }
  }
}
