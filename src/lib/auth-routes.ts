/**
 * Helper canônico de roteamento por papel (RBAC).
 *
 * Usado por:
 *  - Login client-side (src/components/auth/login-form.tsx)
 *  - Server Component da raiz (src/app/page.tsx)
 *  - Página de login legado (src/app/login/page.tsx)
 *  - Middleware (src/middleware.ts) — como referência de rota padrão
 *
 * Regras oficiais ArqVértice Flow:
 *  - ADMIN        → /admin  (Painel Executivo da Diretoria)
 *  - CLIENTE      → /portal (Portal do Cliente)
 *  - ENGENHEIRO   → /equipe (Ambiente Técnico Operacional)
 *  - ARQUITETO    → /equipe
 *  - EQUIPE       → /equipe
 *  - OPERADOR     → /equipe
 *  - null/undefined → /equipe (fallback seguro, nunca /admin)
 */
export function getDefaultRouteForRole(role?: string | null): string {
  if (role === "ADMIN") return "/admin";
  if (role === "CLIENTE" || role === "CLIENT") return "/portal";
  return "/equipe";
}

/**
 * Retorna o prefixo de ambiente baseado no papel do usuário.
 * Útil para construir links dinâmicos na Sidebar/Menu.
 */
export function getBasePathForRole(role?: string | null): string {
  if (role === "ADMIN") return "/admin";
  if (role === "CLIENTE" || role === "CLIENT") return "/portal";
  return "/equipe";
}

/**
 * Verifica se um caminho pertence ao ambiente exclusivo de ADMIN.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Verifica se um caminho pertence ao ambiente da Equipe Técnica.
 */
export function isEquipePath(pathname: string): boolean {
  return pathname === "/equipe" || pathname.startsWith("/equipe/");
}

/**
 * Verifica se um caminho pertence ao ambiente do Cliente.
 */
export function isPortalPath(pathname: string): boolean {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}
