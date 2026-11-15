import type { UserRole } from "@prisma/client";

/**
 * Chaves oficiais de módulos do ArqVértice Flow
 */
export type AppModule =
  | "dashboard"
  | "cronograma"
  | "projetos"
  | "acervo"
  | "3d-viewer"
  | "financeiro"
  | "clientes"
  | "equipe"
  | "portal";

export type Viewer3DFeatureMode =
  | "READ_ONLY"
  | "PROCEDURAL_EDIT"
  | "FULL_RENDER_EXPORT";

export interface AppModuleDefinition {
  id: AppModule;
  label: string;
  description: string;
  icon: string;
  defaultRoute: string;
}

export const APP_MODULES: AppModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Visão Geral & Minhas Tarefas",
    description: "Painel geral, estatísticas de entregas e visão consolidada.",
    icon: "📊",
    defaultRoute: "/admin",
  },
  {
    id: "cronograma",
    label: "Cronograma Mestre & Quadro Kanban",
    description: "Operação do cronograma físico, etapas e Kanban de projetos.",
    icon: "📅",
    defaultRoute: "/operacao",
  },
  {
    id: "projetos",
    label: "Empreendimentos & Fichas Técnicas",
    description: "Gestão dos projetos, dados executivos e Ficha Técnica 360.",
    icon: "📋",
    defaultRoute: "/admin/projetos",
  },
  {
    id: "acervo",
    label: "Acervo Manager (CDE)",
    description: "Controle de pranchas, revisões R00/R01, workflow Bom para Obra e GRD.",
    icon: "📁",
    defaultRoute: "/admin/acervo",
  },
  {
    id: "3d-viewer",
    label: "3D Viewer (Estúdio & Pipeline)",
    description: "Importação, tratamento Meshopt/PBR, visualização procedural e exportação de renders.",
    icon: "🧊",
    defaultRoute: "/admin/3d-viewer",
  },
  {
    id: "financeiro",
    label: "Gestão Financeira & Parcelas",
    description: "Controle de parcelas, valores, vencimentos e relatórios comerciais.",
    icon: "💰",
    defaultRoute: "/admin/financeiro",
  },
  {
    id: "clientes",
    label: "Base de Clientes",
    description: "Cadastro de clientes, contatos e liberação de acessos.",
    icon: "👥",
    defaultRoute: "/admin/clientes",
  },
  {
    id: "equipe",
    label: "Equipe, Lembretes & Governança (Admin)",
    description: "Governança de colaboradores, disparador de avisos e logs de tráfego.",
    icon: "🛡️",
    defaultRoute: "/admin/equipe",
  },
  {
    id: "portal",
    label: "Portal do Cliente",
    description: "Ambiente externo do cliente para acompanhamento do seu projeto.",
    icon: "🏛️",
    defaultRoute: "/portal",
  },
];

/**
 * Presets de permissão atribuídos automaticamente conforme o Cargo (Role)
 */
export const ROLE_PERMISSION_PRESETS: Record<string, AppModule[]> = {
  ADMIN: ["dashboard", "cronograma", "projetos", "acervo", "3d-viewer", "financeiro", "clientes", "equipe"],
  ARQUITETO: ["dashboard", "cronograma", "projetos", "acervo", "3d-viewer", "clientes"],
  ENGENHEIRO: ["dashboard", "cronograma", "projetos", "acervo", "3d-viewer"],
  EQUIPE: ["dashboard", "cronograma", "projetos", "acervo", "3d-viewer"],
  OPERADOR: ["dashboard", "cronograma", "projetos", "acervo", "3d-viewer"],
  CLIENTE: ["portal", "acervo", "3d-viewer"],
  CLIENT: ["portal", "acervo", "3d-viewer"],
};

/**
 * Retorna as permissões efetivas do usuário.
 * Caso o array user.permissions esteja vazio (usuários legados ou recém-criados sem checkbox marcado),
 * aplica o preset correspondente ao user.role.
 */
export function getEffectivePermissions(user: {
  role: string;
  permissions?: string[] | null;
}): AppModule[] {
  const isClient = user.role === "CLIENTE" || user.role === "CLIENT";
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    const base = [...(user.permissions as AppModule[])];
    if (!isClient) {
      if (!base.includes("acervo")) base.push("acervo");
      if (!base.includes("3d-viewer")) base.push("3d-viewer");
    }
    return base;
  }
  const preset = [...(ROLE_PERMISSION_PRESETS[user.role] || ["dashboard"])];
  if (!isClient) {
    if (!preset.includes("acervo")) preset.push("acervo");
    if (!preset.includes("3d-viewer")) preset.push("3d-viewer");
  }
  return preset;
}

/**
 * Verifica se um usuário possui permissão para um determinado módulo
 */
export function hasModulePermission(
  user: { role: string; permissions?: string[] | null },
  module: AppModule
): boolean {
  if (user.role === "ADMIN") return true;
  if ((module === "acervo" || module === "3d-viewer") && user.role !== "CLIENTE" && user.role !== "CLIENT") {
    return true;
  }
  const effective = getEffectivePermissions(user);
  return effective.includes(module);
}

