import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { currentUser, signOut, type AuthRole } from "@/server/auth";
import { SessionGuard } from "@/components/auth/session-guard";
import { InternalMessengerWidget } from "@/components/messenger/internal-messenger-widget";
import { getEffectivePermissions, type AppModule } from "@/lib/rbac";

// Links completos do sistema
const ALL_ADMIN_LINKS: Array<{ label: string; href: string; icon: string; module: AppModule }> = [
  { label: "Painel Geral", href: "/admin", icon: "📊", module: "dashboard" },
  { label: "Cronograma & Operação", href: "/operacao", icon: "📅", module: "cronograma" },
  { label: "Empreendimentos & Acervo", href: "/admin/projetos", icon: "📁", module: "projetos" },
  { label: "Gestão Financeira", href: "/admin/financeiro", icon: "💰", module: "financeiro" },
  { label: "Base de Clientes", href: "/admin/clientes", icon: "👥", module: "clientes" },
  { label: "Equipe & Governança", href: "/admin/equipe", icon: "🛡️", module: "equipe" },
];

const SECONDARY_LINKS: Array<{ label: string; href: string; module: AppModule }> = [
  { label: "Briefing", href: "/admin/briefing", module: "projetos" },
  { label: "Propostas", href: "/admin/propostas", module: "projetos" },
  { label: "Mensagens", href: "/admin/mensagens", module: "dashboard" },
  { label: "Serviços", href: "/admin/servicos", module: "dashboard" },
  { label: "Configurações", href: "/admin/configuracoes", module: "equipe" },
];

/** Links exclusivos da Equipe Técnica (ENGENHEIRO | ARQUITETO | EQUIPE | OPERADOR).
 * Nunca apontam para /admin: os ambientes /admin e /equipe são 100% separados.
 */
const TEAM_LINKS: Array<{ label: string; href: string; icon: string; module: AppModule }> = [
  { label: "Painel Técnico", href: "/equipe", icon: "ðŸ", module: "dashboard" },
  { label: "Projetos", href: "/equipe/projetos", icon: "ðŸ­", module: "projetos" },
  { label: "Cronograma", href: "/equipe/cronograma", icon: "ðŸ“…", module: "cronograma" },
];

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
  const isClient = environment === "client" || effectiveRole === "CLIENTE" || effectiveRole === "CLIENT";

  // Permissões efetivas com fallback no preset do cargo
  const effectivePermissions = user
    ? getEffectivePermissions({ role: user.role, permissions: user.permissions })
    : ["dashboard"];

  let allowedLinks: Array<readonly [string, string]>;
  let bottomNavLinks: Array<{ label: string; href: string; icon: string }>;

  if (isClient) {
    allowedLinks = [["Meu projeto", "/portal"]] as const;
    bottomNavLinks = [{ label: "Meu Projeto", href: "/portal", icon: "🏛️" }];
  } else if (effectiveRole === "ADMIN") {
    allowedLinks = ALL_ADMIN_LINKS.map((item) => [item.label, item.href] as const).concat(
      SECONDARY_LINKS.map((item) => [item.label, item.href] as const)
    );
    bottomNavLinks = ALL_ADMIN_LINKS.slice(0, 5).map((item) => ({
      label: item.label.split(" ")[0],
      href: item.href,
      icon: item.icon,
    }));
  } else {
    // Equipe tÃ©cnica: links apontam exclusivamente para /equipe/* (nunca /admin/*).
    // O filtro por mÃ³dulo preserva o menor-privilÃ©gio; o fallback Ã© /equipe, nunca /admin.
    const primary = TEAM_LINKS.filter((item) => effectivePermissions.includes(item.module));

    allowedLinks = primary.map((item) => [item.label, item.href] as const);

    if (allowedLinks.length === 0) {
      allowedLinks = [["Painel", "/equipe"]];
    }

    bottomNavLinks = primary.slice(0, 4).map((item) => ({
      label: item.label.split(" ")[0],
      href: item.href,
      icon: item.icon,
    }));
  }

  const areaLabel = isClient
    ? "Flow · portal do cliente"
    : effectiveRole === "ADMIN"
    ? "Flow · gestão executiva"
    : "Flow · operação técnica";

  const groupLabel = isClient ? "Meu projeto" : effectiveRole === "ADMIN" ? "Administração" : "Painel Técnico";

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20 lg:pb-0">
      <SessionGuard />

      {/* SIDEBAR DESKTOP */}
      <aside
        className={`fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-7 lg:block ${
          isClient ? "bg-slate-950 text-white" : ""
        }`}
      >
        <Link href="/" className="block px-3">
          <Brand compact showTagline={false} />
        </Link>
        <p className="px-3 pt-2 text-xs text-slate-400">{areaLabel}</p>
        <p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          {groupLabel}
        </p>
        <nav className="mt-2 space-y-1" aria-label="Navegação principal">
          {allowedLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`block rounded-xl px-3 py-3 text-sm font-medium transition ${
                isClient
                  ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f5f5f7]/95 px-5 py-4 backdrop-blur md:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MobileNav
                links={allowedLinks}
                environment={isClient ? "client" : "admin"}
                areaLabel={areaLabel}
                groupLabel={groupLabel}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {eyebrow}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  ArqVértice Flow ·{" "}
                  {isClient
                    ? "Portal do Cliente"
                    : effectiveRole === "ADMIN"
                    ? "ambiente administrativo"
                    : "painel técnico de projetos"}
                </p>
              </div>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">{user.name}</p>
                  <p className="text-[10px] font-medium text-slate-500">
                    {user.specialty || user.role}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                    redirect("/");
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
              <Link
                href="/"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Entrar →
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>

      {/* BOTTOM NAV MOBILE (Fixo em baixo em telas < 1024px) */}
      {!isClient && bottomNavLinks.length > 0 && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg"
          aria-label="Navegação rápida móvel"
        >
          {bottomNavLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 text-[10px] font-bold text-slate-600 hover:text-slate-900 active:scale-95 transition"
            >
              <span className="text-lg leading-none mb-1">{item.icon}</span>
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* MENSAGEIRO INTERNO COMPACTO (Exclusivo para Equipe Técnica · Web & Mobile) */}
      {user && user.role !== "CLIENTE" && user.role !== "CLIENT" && (
        <InternalMessengerWidget
          currentUserId={user.id}
          currentUserName={user.name}
        />
      )}
    </div>
  );
}
