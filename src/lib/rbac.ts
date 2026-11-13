import type { UserRole } from "@prisma/client";

/**
 * Chaves oficiais de módulos do ArqVértice Flow
 */
export type AppModule =
  | "dashboard"
  | "cronograma"
  | "projetos"
  | "financeiro"
  | "clientes"
  | "equipe"
  | "portal";

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
    label: "Empreendimentos & Acervo Técnico",
    description: "Gestão dos projetos, pranchas, entregáveis e acervo de arquivos.",
    icon: "📁",
    defaultRoute: "/admin/projetos",
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
  ADMIN: ["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"],
  ARQUITETO: ["dashboard", "cronograma", "projetos", "clientes"],
  ENGENHEIRO: ["dashboard", "cronograma", "projetos"],
  EQUIPE: ["dashboard", "cronograma", "projetos"],
  OPERADOR: ["dashboard", "cronograma", "projetos"],
  CLIENTE: ["portal"],
  CLIENT: ["portal"],
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
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions as AppModule[];
  }
  return ROLE_PERMISSION_PRESETS[user.role] || ["dashboard"];
}

/**
 * Verifica se um usuário possui permissão para um determinado módulo
 */
export function hasModulePermission(
  user: { role: string; permissions?: string[] | null },
  module: AppModule
): boolean {
  if (user.role === "ADMIN") return true;
  const effective = getEffectivePermissions(user);
  return effective.includes(module);
}

