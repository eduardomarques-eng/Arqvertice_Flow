/**
 * Cores oficiais da ARQVERTICE por disciplina — usadas nos portais de
 * acompanhamento (cliente, equipe e admin).
 *
 * Cores Oficiais:
 * - Arquitetura: Roxo Índigo
 * - Estrutura: Âmbar / Laranja
 * - Projeto 3D: Magenta
 * - Complementares: Azul Elétrico
 * - Obra: Verde Esmeralda
 */
export type DisciplineKey =
  | "Arquitetura"
  | "Projeto 3D"
  | "3D"
  | "Estrutura"
  | "Estrutural"
  | "Complementares"
  | "Obra"
  | "Obras"
  | "Execução de Obra"
  | string;

export interface DisciplineColor {
  badge: string;
  border: string;
  progress: string;
  text: string;
}

const DISCIPLINE_COLORS: Record<string, DisciplineColor> = {
  Arquitetura: {
    badge: "border-indigo-200 bg-indigo-50 text-indigo-800",
    border: "border-l-indigo-600",
    progress: "bg-indigo-600",
    text: "text-indigo-700",
  },
  "Projeto 3D": {
    badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
    border: "border-l-fuchsia-500",
    progress: "bg-fuchsia-600",
    text: "text-fuchsia-700",
  },
  "3D": {
    badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
    border: "border-l-fuchsia-500",
    progress: "bg-fuchsia-600",
    text: "text-fuchsia-700",
  },
  Estrutura: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    border: "border-l-amber-500",
    progress: "bg-amber-500",
    text: "text-amber-700",
  },
  Estrutural: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    border: "border-l-amber-500",
    progress: "bg-amber-500",
    text: "text-amber-700",
  },
  Complementares: {
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    border: "border-l-sky-500",
    progress: "bg-sky-500",
    text: "text-sky-700",
  },
  Obra: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    border: "border-l-emerald-500",
    progress: "bg-emerald-600",
    text: "text-emerald-700",
  },
  Obras: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    border: "border-l-emerald-500",
    progress: "bg-emerald-600",
    text: "text-emerald-700",
  },
  "Execução de Obra": {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    border: "border-l-emerald-500",
    progress: "bg-emerald-600",
    text: "text-emerald-700",
  },
};

/**
 * Retorna o estilo de cores para uma dada disciplina. Desconhecidas caem para
 * um tom neutro de slate.
 */
export function disciplineColor(discipline: string | null): DisciplineColor {
  const key = (discipline ?? "").trim() || "Geral";
  return (
    DISCIPLINE_COLORS[key] ?? {
      badge: "border-slate-200 bg-slate-50 text-slate-600",
      border: "border-l-slate-400",
      progress: "bg-slate-400",
      text: "text-slate-500",
    }
  );
}
