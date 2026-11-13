/**
 * Helpers de autorização modular (RBAC/ABAC) para serviços de src/server/services/**.
 *
 * Substituem o uso residual de `requireRole("ADMIN")` em serviços que devem
 * ser acessíveis por membros da equipe autorizados via getEffectivePermissions.
 *
 * Todas as funções são puras quanto à decisão de permissão (não consultam o
 * banco além do que o caller já passou), e lançam DomainError com código
 * NOT_FOUND para não vazar a existência do recurso a usuários não autorizados.
 */

import { DomainError } from "@/server/errors";
import { currentUser, type AuthRole } from "@/server/auth";
import { getEffectivePermissions, type AppModule } from "./rbac";

export type AuthenticatedUser = {
  id: string;
  name: string;
  role: AuthRole;
  permissions?: string[] | null;
  email?: string | null;
  isActive?: boolean;
};

/**
 * Exige que o usuário possua permissão para o módulo informado.
 * ADMIN sempre tem acesso. Outros papéis dependem do preset / permissões efetivas.
 */
export function requireModulePermission(
  user: AuthenticatedUser,
  module: AppModule,
): AuthenticatedUser {
  if (user.role === "ADMIN") return user;
  const effective = getEffectivePermissions(user);
  if (!effective.includes(module)) {
    throw new DomainError(
      `Você não tem permissão para acessar o módulo "${module}".`,
      "NOT_FOUND",
    );
  }
  return user;
}

/**
 * Exige que o usuário possua uma das permissões informadas (qualquer uma basta).
 */
export function requireAnyModulePermission(
  user: AuthenticatedUser,
  modules: AppModule[],
): AuthenticatedUser {
  if (user.role === "ADMIN") return user;
  const effective = getEffectivePermissions(user);
  const hasAny = modules.some((m) => effective.includes(m));
  if (!hasAny) {
    throw new DomainError(
      "Você não tem permissão para acessar este recurso.",
      "NOT_FOUND",
    );
  }
  return user;
}

/**
 * Wrapper tipo-guarda para currentUser: lança se não houver sessão.
 */
export function requireAuthenticatedUser(
  user: AuthenticatedUser | null,
): AuthenticatedUser {
  if (!user) {
    throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  }
  return user;
}

/**
 * Combina currentUser() + verificação de sessão + requireModulePermission em
 * uma única chamada. Usado pelos serviços de src/server/services/** para
 * substituir o padrão `const user = await currentUser(); await requireModulePermission(user, module)`.
 *
 * Lança DomainError NOT_FOUND se não houver sessão ou se o usuário não tiver
 * permissão para o módulo.
 */
export async function requireModuleAccess(
  module: AppModule,
): Promise<AuthenticatedUser> {
  const user = await currentUser();
  if (!user) {
    throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  }
  return requireModulePermission(user, module);
}
