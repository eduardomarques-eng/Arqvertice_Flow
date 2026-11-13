import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { currentUser, signOut, type AuthRole } from "@/server/auth";
import { SessionGuard } from "@/components/auth/session-guard";
import { TeamInternalMessenger } from "@/components/chat/team-internal-messenger";

// Navegação administrativa completa (dono/ADMIN).
const ADMIN_LINKS = [
  ["Painel", "/admin"],
  ["Clientes", "/admin/clientes"],
  ["Briefing", "/admin/briefing"],
  ["Projetos", "/admin/projetos"],
  ["💰 Gestão Financeira", "/admin/financeiro"],
  ["Operação / Cronograma", "/operacao"],
  ["Propostas", "/admin/propostas"],
  ["👥 Equipe & Governança", "/admin/equipe"],
  ["Mensagens", "/admin/mensagens"],
  ["Serviços", "/admin/servicos"],
  ["Configurações", "/admin/configuracoes"],
] as const;

// Mapeamento de rotas para módulos de permissão granular RBAC
const ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  "/admin": ["dashboard"],
  "/admin/clientes": ["clientes"],
  "/admin/briefing": ["briefing", "projetos"],
  "/admin/projetos": ["projetos"],
  "/admin/financeiro": ["financeiro"],
  "/operacao": ["cronograma"],
  "/admin/propostas": ["propostas", "comercial"],
  "/admin/equipe": ["equipe"],
  "/admin/mensagens": ["mensagens"],
  "/admin/servicos": ["servicos", "configuracoes"],
  "/admin/configuracoes": ["configuracoes"],
};

// Navegação do funcionário da equipa (OPERADOR): apenas a operação do cronograma.
const OPERADOR_LINKS = [
  ["Operação", "/operacao"],
] as const;

/**
 * `role` e `permissions` decidem a navegação de forma estrita e em tempo real.
 */
export async function AppShell({
  children,
  eyebrow = "Estúdio",
  environment = "admin",
  role,
}: {
  children: ReactNode;
  eyebrow?: string;
  environment?: "admin" | "client";
  role?: AuthRole;
}) {
  const user = await currentUser();
  const effectiveRole = role || (user?.role as AuthRole) || "ADMIN";
  const isOperador = effectiveRole === "OPERADOR" || effectiveRole === "EQUIPE";
  const userPermissions = user?.permissions || [];

  // Filtra links conforme permissões granulares do usuário
  let allowedLinks: readonly (readonly [string, string])[] = ADMIN_LINKS;

  if (environment === "client") {
    allowedLinks = [["Meu projeto", "/portal"]] as const;
  } else if (effectiveRole === "ADMIN") {
    allowedLinks = ADMIN_LINKS;
  } else if (userPermissions.length > 0) {
    allowedLinks = ADMIN_LINKS.filter(([, href]) => {
      const required = ROUTE_PERMISSION_MAP[href];
      if (!required) return true;
      return required.some((perm) => userPermissions.includes(perm));
    });
    // Se nenhuma permissão bateu, garante ao menos o Dashboard ou Cronograma
    if (allowedLinks.length === 0) {
      allowedLinks = isOperador ? OPERADOR_LINKS : [["Painel", "/admin"]];
    }
  } else if (isOperador) {
    allowedLinks = OPERADOR_LINKS;
  }

  const areaLabel = environment === "client"
    ? "Flow · portal do cliente"
    : isOperador
      ? "Flow · operação de cronograma"
      : "Flow · gestão de projetos";
  const groupLabel = environment === "client" ? "Meu projeto" : isOperador ? "Equipe técnica" : "Administração";

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <SessionGuard />

      <aside className={`fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-7 lg:block ${environment === "client" ? "bg-slate-950 text-white" : ""}`}>
        <Link href="/" className="block px-3">
          <Brand compact showTagline={false} />
        </Link>
        <p className="px-3 pt-2 text-xs text-slate-400">{areaLabel}</p>
        <p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{groupLabel}</p>
        <nav className="mt-2 space-y-1" aria-label="Navegação principal">
          {allowedLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`block rounded-xl px-3 py-3 text-sm font-medium ${
                environment === "client"
                  ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f5f5f7]/95 px-5 py-4 backdrop-blur md:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MobileNav
                links={allowedLinks}
                environment={environment}
                areaLabel={areaLabel}
                groupLabel={groupLabel}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
                <p className="mt-1 text-sm text-slate-600">
                  ArqVértice Flow · {environment === "client" ? "Portal do Cliente" : isOperador ? "operação de cronograma" : "ambiente administrativo"}
                </p>
              </div>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">{user.name}</p>
                  <p className="text-[10px] font-medium text-slate-500">{user.specialty || user.role}</p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                    redirect("/login");
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 active:scale-95 transition shadow-2xs"
                  >
                    Sair
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Entrar →
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>

      {/* Mensageiro Interno Flutuante Exclusivo para Profissionais */}
      {user && user.role !== "CLIENTE" && user.role !== "CLIENT" && (
        <TeamInternalMessenger
          currentUserId={user.id}
          currentUserName={user.name}
        />
      )}
    </div>
  );
}
