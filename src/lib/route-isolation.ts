/**
 * Isolamento de ambiente por rota (RBAC).
 *
 * Funcoes puras e deterministicas: nao consultam o banco. Sao usadas pelo
 * middleware (filtro antecipado na borda) e pelos testes de regressao. A
 * prova definitiva de autorizacao continua nas paginas via `requirePage*`,
 * porque o middleware nao tem acesso ao Prisma.
 *
 * Regras oficiais ArqVertice Flow:
 *  - /admin e /admin/*   -> APENAS role === "ADMIN" (Eduardo Marques)
 *  - /equipe e /equipe/* -> Equipe Tecnica: "ENGENHEIRO" | "ARQUITETO" | "EQUIPE" | "OPERADOR"
 *  - /portal e /portal/* -> APENAS role === "CLIENTE" | "CLIENT"
 */

export type Role =
  | "ADMIN"
  | "ARQUITETO"
  | "ENGENHEIRO"
  | "EQUIPE"
  | "OPERADOR"
  | "CLIENTE"
  | "CLIENT"
  | "OPERATOR"
  | null;

const ADMIN_ROLE = "ADMIN";
const TEAM_ROLES = new Set<string>([
  "ENGENHEIRO",
  "ARQUITETO",
  "EQUIPE",
  "OPERADOR",
]);
const CLIENT_ROLES = new Set<string>(["CLIENTE", "CLIENT"]);

export function isTeamRole(role: string | null): boolean {
  if (role === null) return false;
  return TEAM_ROLES.has(role);
}

export function isClientRole(role: string | null): boolean {
  if (role === null) return false;
  return CLIENT_ROLES.has(role);
}

export function isAdminRole(role: string | null): boolean {
  return role === ADMIN_ROLE;
}

/**
 * Dado um caminho protegido e o papel do usuario (lido do cookie `arqvertice_role`),
 * retorna o caminho para o qual o usuario DEVE ser redirecionado, ou `null` se o
 * acesso ao caminho solicitado for permitido.
 *
 * Um usuario sem papel (null) nunca tem acesso a rotas protegidas: vai para /login.
 */
export function resolveRedirectForPath(
  pathname: string,
  role: string | null,
): string | null {
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isEquipePath =
    pathname === "/equipe" || pathname.startsWith("/equipe/");
  const isPortalPath =
    pathname === "/portal" || pathname.startsWith("/portal/");

  if (!isAdminPath && !isEquipePath && !isPortalPath) {
    return null;
  }

  if (role === null) {
    return "/login";
  }

  if (isAdminPath && !isAdminRole(role)) {
    return isTeamRole(role) ? "/equipe" : "/portal";
  }

  if (isEquipePath && !isTeamRole(role)) {
    return role === "ADMIN" ? "/admin" : "/portal";
  }

  if (isPortalPath && !isClientRole(role)) {
    if (role === "ADMIN") return "/admin";
    if (isTeamRole(role)) return "/equipe";
    return "/login";
  }

  return null;
}

/**
 * Verdadeiro se o papel tem acesso ao caminho protegido (sem redirecionamento).
 */
export function isPathAllowed(pathname: string, role: string | null): boolean {
  return resolveRedirectForPath(pathname, role) === null;
}
