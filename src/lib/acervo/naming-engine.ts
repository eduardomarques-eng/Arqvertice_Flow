/**
 * Motor de Validação e Normalização de Nomenclatura CDE (ConstruManager-style)
 * Padrão padrão: [EMPREENDIMENTO]-[DISCIPLINA]-[FASE]-[TIPO]-[SEQUENCIAL]-[REV].[EXT]
 * Exemplo: RES-ARQ-PE-DET-001-R00.pdf
 */

export interface ParsedSheetCode {
  isValid: boolean;
  projectCode?: string;
  discipline?: string;
  phase?: string;
  docType?: string;
  sequential?: string;
  revisionNumber: string;
  fullCode: string;
  error?: string;
}

const DISCIPLINE_MAP: Record<string, string> = {
  ARQ: "ARQUITETURA",
  EST: "ESTRUTURAL",
  ELE: "ELETRICO",
  HID: "HIDROSSANITARIO",
  INC: "COMBATE_INCENDIO",
  BIM: "COMPATIBILIZACAO",
  LEG: "LEGAL",
  EXE: "EXECUTIVO",
  FAC: "FACHADAS",
  INT: "INTERIORES",
};

export function parseAndValidateSheetName(
  fileName: string,
  expectedProjectPrefix?: string
): ParsedSheetCode {
  // Remove extensão
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").trim();

  // Regex padrão com suporte a separadores comuns (- ou _)
  // Ex: EMP-DISC-FASE-TIPO-001-R00
  const match = nameWithoutExt.match(
    /^([A-Z0-9]+)[-_]([A-Z0-9]+)[-_]([A-Z0-9]+)[-_]([A-Z0-9]+)[-_]([0-9]{3,4})[-_](R[0-9]{2})$/i
  );

  if (!match) {
    // Tenta fallback flexível com revisão: ...-R00
    const flexRevMatch = nameWithoutExt.match(/[-_](R[0-9]{2})$/i);
    const rev = flexRevMatch ? flexRevMatch[1].toUpperCase() : "R00";

    return {
      isValid: false,
      revisionNumber: rev,
      fullCode: nameWithoutExt.toUpperCase(),
      error:
        "Nome fora do padrão CDE. Formato recomendado: [EMP]-[DISC]-[FASE]-[TIPO]-[SEQ]-[REV] (Ex: ARQ-EST-PE-DET-001-R00)",
    };
  }

  const [, projectCode, rawDisc, phase, docType, sequential, rawRev] = match;

  const upperDisc = rawDisc.toUpperCase();
  const normalizedDisc = DISCIPLINE_MAP[upperDisc] || upperDisc;

  if (
    expectedProjectPrefix &&
    projectCode.toUpperCase() !== expectedProjectPrefix.toUpperCase()
  ) {
    return {
      isValid: false,
      projectCode: projectCode.toUpperCase(),
      discipline: normalizedDisc,
      phase: phase.toUpperCase(),
      docType: docType.toUpperCase(),
      sequential,
      revisionNumber: rawRev.toUpperCase(),
      fullCode: nameWithoutExt.toUpperCase(),
      error: `Prefixo do empreendimento inconsistente. Esperado: ${expectedProjectPrefix.toUpperCase()}`,
    };
  }

  return {
    isValid: true,
    projectCode: projectCode.toUpperCase(),
    discipline: normalizedDisc,
    phase: phase.toUpperCase(),
    docType: docType.toUpperCase(),
    sequential,
    revisionNumber: rawRev.toUpperCase(),
    fullCode: nameWithoutExt.toUpperCase(),
  };
}

/**
 * Incrementa número de revisão CDE (R00 -> R01 -> R02...)
 */
export function getNextRevisionNumber(currentRevision: string = "R00"): string {
  const match = currentRevision.match(/^R([0-9]{2})$/i);
  if (!match) return "R01";
  const num = parseInt(match[1], 10) + 1;
  return `R${num.toString().padStart(2, "0")}`;
}
