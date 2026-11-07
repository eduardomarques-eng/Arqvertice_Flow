import { briefingSections, allBriefingQuestions } from "./briefing-definition";

export interface BriefingStepGroup {
  id: string;
  title: string;
  description?: string;
  sectionIndex: number;
  questionIds: string[];
}

// Agrupamento dos passos por secoes do briefing
export const briefingStepGroups: BriefingStepGroup[] = (briefingSections || []).map((sec, idx) => ({
  id: sec.id || section- + idx,
  title: sec.title || Etapa  + (idx + 1),
  description: sec.description || "",
  sectionIndex: idx,
  questionIds: sec.questionIds || []
}));

// Retorna o indice da secao correspondente a uma etapa ou pergunta
export function stepIndexOfSection(sectionIdOrIndex: string | number): number {
  if (typeof sectionIdOrIndex === "number") {
    return Math.max(0, Math.min(sectionIdOrIndex, (briefingSections?.length || 1) - 1));
  }
  const foundIndex = briefingSections?.findIndex((s) => s.id === sectionIdOrIndex);
  return foundIndex !== undefined && foundIndex >= 0 ? foundIndex : 0;
}

// Calcula o percentual de progresso com base no indice do passo atual
export function stepProgress(currentStepIndex: number, totalSteps?: number): number {
  const total = totalSteps || (briefingStepGroups?.length > 0 ? briefingStepGroups.length : 1);
  if (total <= 1) return 100;
  const progress = Math.round((currentStepIndex / (total - 1)) * 100);
  return Math.max(0, Math.min(100, progress));
}

export default briefingStepGroups;