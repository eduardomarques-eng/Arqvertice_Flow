import type { ProjectDiscipline, DeliverableType, ApprovalStatus } from "@prisma/client";

export interface ParsedSheetMetadata {
  sheetCode: string;
  subject: string;
  title: string;
  discipline: ProjectDiscipline;
  type: DeliverableType;
  version: string;
  suggestedStageName?: string;
  environmentName?: string;
}

/**
 * Heurística inteligente para decodificar metadados de arquivos de pranchas técnicas.
 * Ex: "ARQ_01_04_Plantas_Baixas_Layout_R01.pdf" ->
 *   sheetCode: "ARQ-01/04"
 *   discipline: "ARQUITETURA"
 *   type: "PLANTA_BAIXA"
 *   version: "R01"
 *   subject: "Plantas Baixas Layout"
 */
export function parseSheetFileName(fileName: string): ParsedSheetMetadata {
  const cleanName = fileName.replace(/\.[^/.]+$/, ""); // remove extension

  // 1. Extração de Versão (R00, R01, REV-02, V1, etc.)
  const versionMatch = cleanName.match(/(?:[-_ ])?(?:R|REV|V)[-_ ]?(\d{1,2})/i);
  const version = versionMatch ? `R${versionMatch[1].padStart(2, "0")}` : "R00";

  // 2. Extração de Disciplina
  let discipline: ProjectDiscipline = "ARQUITETURA";
  const upper = cleanName.toUpperCase();

  if (/(EST|ESTRUT|FORMA|ARMADURA|PILAR|VIGA|FUNDAC)/i.test(upper)) {
    discipline = "ESTRUTURAL";
  } else if (/(ELE|ELETR|ILUM|TOMADA|DPS|FORCA|SPDA)/i.test(upper)) {
    discipline = "ELETRICO";
  } else if (/(HID|ESGOTO|AGUA|SAN|PLUV|DREN)/i.test(upper)) {
    discipline = "HIDROSSANITARIO";
  } else if (/(HVAC|CLIMAT|AR_COND|VENTIL)/i.test(upper)) {
    discipline = "HVAC";
  } else if (/(INT|INTERIOR|MARCEN|DECOR)/i.test(upper)) {
    discipline = "INTERIORES";
  } else if (/(COMPAT|BIM|MEP|CLASH)/i.test(upper)) {
    discipline = "COMPATIBILIZACAO";
  } else if (/(OBRA|EXEC|CANTEIRO)/i.test(upper)) {
    discipline = "EXECUCAO_OBRA";
  } else if (/(ARQ|PLANTA|CORTE|FACHADA|LAYOUT|PRELIM)/i.test(upper)) {
    discipline = "ARQUITETURA";
  } else {
    discipline = "GERAL";
  }

  // 3. Extração de Tipo de Entregável
  let type: DeliverableType = "PRANCHA_EXECUTIVA";
  if (/(PLANTA|LAYOUT|BAIXA)/i.test(upper)) {
    type = "PLANTA_BAIXA";
  } else if (/(CORTE|FACHADA|ELEVAC)/i.test(upper)) {
    type = "CORTE_FACHADA";
  } else if (/(DET|DETALHE|AMPLIAC|AMPLIACAO)/i.test(upper)) {
    type = "DETALHAMENTO";
  } else if (/(3D|RENDER|PERSPECTIVA|IMAGEM)/i.test(upper)) {
    type = "RENDER_3D";
  } else if (/(MEMORIAL|DESC)/i.test(upper)) {
    type = "MEMORIAL_DESCRITIVO";
  } else if (/(ESPEC|CADERNO|QUANT)/i.test(upper)) {
    type = "ESPECIFICACAO_TECNICA";
  }

  // 4. Extração do Código da Prancha (ex: ARQ-01, ARQ-01/04, EST-E01, HID-01, ELE-01)
  let sheetCode = "";
  const codeMatch = cleanName.match(/\b(ARQ|EST|HID|ELE|HVAC|INT|MEP)[-_ ]?([A-Z0-9]+(?:[\/_][A-Z0-9]+)?)\b/i);
  if (codeMatch) {
    const prefix = codeMatch[1].toUpperCase();
    const numPart = codeMatch[2].replace(/_/g, "/").toUpperCase();
    sheetCode = `${prefix}-${numPart}`;
  } else {
    // Código genérico baseado na disciplina
    const prefixMap: Record<ProjectDiscipline, string> = {
      ARQUITETURA: "ARQ",
      ESTRUTURAL: "EST",
      ESTRUTURA: "EST",
      ELETRICO: "ELE",
      HIDROSSANITARIO: "HID",
      HVAC: "VAC",
      INTERIORES: "INT",
      COMPATIBILIZACAO: "MEP",
      EXECUCAO_OBRA: "OBR",
      COMBATE_INCENDIO: "INC",
      RENDER_3D: "RND",
      LEGAL_APROVACAO: "LEG",
      GERAL: "PRJ",
    };
    sheetCode = `${prefixMap[discipline]}-01`;
  }

  // 5. Extração do Assunto (limpeza do nome)
  let subject = cleanName
    // Remove códigos comuns
    .replace(/\b(ARQ|EST|HID|ELE|HVAC|INT|MEP)[-_ ]?[A-Z0-9]+(?:[\/_][A-Z0-9]+)?\b/gi, "")
    // Remove versão
    .replace(/(?:[-_ ])?(?:R|REV|V)[-_ ]?\d{1,2}\b/gi, "")
    // Remove datas (ex: 2026-06-12 ou 12-06-2026)
    .replace(/\b\d{4}[-_]\d{2}[-_]\d{2}\b/g, "")
    .replace(/\b\d{2}[-_]\d{2}[-_]\d{4}\b/g, "")
    // Substitui separadores por espaços
    .replace(/[-_.]+/g, " ")
    .trim();

  // Se ficou vazio, cria um assunto padrão
  if (!subject || subject.length < 3) {
    const defaultSubjectMap: Record<ProjectDiscipline, string> = {
      ARQUITETURA: "Plantas Baixas e Layout Operacional",
      ESTRUTURAL: "Formas e Armaduras Estruturais",
      ESTRUTURA: "Formas e Armaduras Estruturais",
      ELETRICO: "Projeto Luminotécnico e Pontos de Força",
      HIDROSSANITARIO: "Instalações de Esgotamento e Abastecimento",
      HVAC: "Climatização e Renovação de Ar",
      INTERIORES: "Detalhamento de Marcenaria e Paginação",
      COMPATIBILIZACAO: "Compatibilização Global de Disciplinas",
      EXECUCAO_OBRA: "Plantas de Canteiro e Liberação Executiva",
      COMBATE_INCENDIO: "Prevenção e Combate a Incêndio (PPCI)",
      RENDER_3D: "Perspectivas e Renders 3D Realistas",
      LEGAL_APROVACAO: "Plantas e Documentos para Aprovação Legal",
      GERAL: "Documentação Técnica de Engenharia",
    };
    subject = defaultSubjectMap[discipline];
  } else {
    // Capitalizar palavras
    subject = subject
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // 6. Título Completo
  const title = `${sheetCode} - ${subject}`;

  // 7. Sugestão de Etapa do Cronograma
  let suggestedStageName = "";
  if (discipline === "ARQUITETURA") {
    if (/Preliminar/i.test(subject)) suggestedStageName = "Estudo Preliminar";
    else if (/Básico|Basico/i.test(subject)) suggestedStageName = "Projeto Básico";
    else suggestedStageName = "Projeto Executivo";
  } else if (discipline === "ESTRUTURAL") {
    if (/Fundação|Fundacao|SPT|Sapata/i.test(subject)) suggestedStageName = "Projeto Fundação";
    else if (/Armadura|Aço|TQS/i.test(subject)) suggestedStageName = "Projeto Armaduras";
    else if (/Pré Formas|Pre Formas/i.test(subject)) suggestedStageName = "Projeto Pré Formas";
    else suggestedStageName = "Projeto Formas Finais";
  } else if (discipline === "ELETRICO") {
    suggestedStageName = "Projeto Elétrico";
  } else if (discipline === "HIDROSSANITARIO") {
    if (/Drenagem|Pluvial/i.test(subject)) suggestedStageName = "Projeto Hidrossanitário - Drenagem";
    else if (/Abastecimento|Água|Agua/i.test(subject)) suggestedStageName = "Projeto Hidrossanitário - Abastecimento";
    else suggestedStageName = "Projeto Hidrossanitário - Esgotamento";
  } else if (type === "RENDER_3D") {
    if (/Render/i.test(subject)) suggestedStageName = "Renderização 3D - Imagens Finais";
    else suggestedStageName = "Modelagem 3D";
  } else if (discipline === "EXECUCAO_OBRA") {
    suggestedStageName = "Execução de Obras";
  }

  // 8. Sugestão de Ambiente (se houver no nome)
  let environmentName = "";
  const envMatches = [
    { regex: /Fachada/i, name: "Fachada Principal" },
    { regex: /Living|Estar|Sala/i.test(subject), name: "Living Integrado" },
    { regex: /Gourmet|Churrasqu/i.test(subject), name: "Varanda Gourmet" },
    { regex: /Piscina|Deck|Lazer/i.test(subject), name: "Área Externa & Lazer" },
    { regex: /Master|Casal/i.test(subject), name: "Suíte Master" },
    { regex: /Cozinha/i.test(subject), name: "Cozinha Funcional" },
    { regex: /Térreo|Terreo/i.test(subject), name: "Pavimento Térreo" },
    { regex: /Superior/i.test(subject), name: "Pavimento Superior" },
    { regex: /Cobertura|Telhado/i.test(subject), name: "Cobertura & Telhado" },
  ];
  for (const item of envMatches) {
    if (typeof item.regex === "boolean" ? item.regex : item.regex.test(subject)) {
      environmentName = item.name;
      break;
    }
  }

  return {
    sheetCode,
    subject,
    title,
    discipline,
    type,
    version,
    suggestedStageName,
    environmentName,
  };
}

export const DISCIPLINE_LABELS: Record<ProjectDiscipline, string> = {
  ARQUITETURA: "Arquitetura",
  ESTRUTURAL: "Estrutural",
  ESTRUTURA: "Estrutura",
  ELETRICO: "Elétrico (MEP)",
  HIDROSSANITARIO: "Hidrossanitário (MEP)",
  HVAC: "Climatização (HVAC)",
  INTERIORES: "Interiores & Marcenaria",
  COMPATIBILIZACAO: "Compatibilização Global",
  EXECUCAO_OBRA: "Execução & Canteiro",
  COMBATE_INCENDIO: "Combate a Incêndio (PPCI)",
  RENDER_3D: "Renders & Imagens 3D",
  LEGAL_APROVACAO: "Projeto Legal & Aprovação",
  GERAL: "Coordenação Geral",
};

export const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  PLANTA_BAIXA: "Planta Baixa",
  CORTE_FACHADA: "Cortes & Fachadas",
  DETALHAMENTO: "Detalhamento Construtivo",
  RENDER_3D: "Render 3D / Perspectiva",
  MEMORIAL_DESCRITIVO: "Memorial Descritivo",
  ESPECIFICACAO_TECNICA: "Especificação Técnica",
  PRANCHA_EXECUTIVA: "Prancha Executiva Completa",
  OUTRO: "Outro Documento",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, { label: string; tone: "blue" | "green" | "amber" | "red" | "neutral" }> = {
  EM_ELABORACAO: { label: "Em Elaboração", tone: "blue" },
  REVISAO_INTERNA: { label: "Revisão Interna", tone: "amber" },
  APROVADO_INTERNO: { label: "Aprovado Interno", tone: "blue" },
  APROVADO_CLIENTE: { label: "Aprovado pelo Cliente", tone: "green" },
  LIBERADO_OBRA: { label: "Liberado para Obra", tone: "green" },
  REJEITADO: { label: "Rejeitado / Revisar", tone: "red" },
};

