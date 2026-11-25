import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { currentUser, signOut, type AuthRole } from "@/server/auth";
import { SessionGuard } from "@/components/auth/session-guard";
import { InternalMessengerWidget } from "@/components/messenger/internal-messenger-widget";
import { getEffectivePermissions, type AppModule } from "@/lib/rbac";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/server/db";

// Links completos do sistema para o Administrador (Painel Executivo)
const ALL_ADMIN_LINKS: Array<{ label: string; href: string; icon: string; module: AppModule }> = [
  { label: "Painel Geral", href: "/admin", icon: "📊", module: "dashboard" },
  { label: "Projetos", href: "/admin/projetos", icon: "📋", module: "projetos" },
  { label: "Cronograma & Operação", href: "/admin/cronograma", icon: "📅", module: "cronograma" },
  { label: "Acervo Manager", href: "/admin/acervo", icon: "📁", module: "acervo" },
  { label: "EAP", href: "/admin/eap", icon: "🧱", module: "projetos" },
  { label: "Gestão Financeira", href: "/admin/financeiro", icon: "💰", module: "financeiro" },
  { label: "Base de Clientes", href: "/admin/clientes", icon: "👥", module: "clientes" },
  { label: "Central WhatsApp", href: "/admin/whatsapp", icon: "💬", module: "dashboard" },
  { label: "E-mail Profissional", href: "/admin/email", icon: "✉️", module: "dashboard" },
  { label: "Equipe & Governança", href: "/admin/equipe", icon: "🛡️", module: "equipe" },
];

const SECONDARY_LINKS: Array<{ label: string; href: string; module: AppModule }> = [
  { label: "Briefing", href: "/admin/briefing", module: "projetos" },
  { label: "Propostas", href: "/admin/propostas", module: "projetos" },
  { label: "Contratos", href: "/admin/contratos", module: "projetos" },
  { label: "Mensagens", href: "/admin/mensagens", module: "dashboard" },
  { label: "Serviços", href: "/admin/servicos", module: "dashboard" },
  { label: "Plugins & Downloads", href: "/admin/acervo/plugins", module: "acervo" },
  { label: "Configurações", href: "/admin/configuracoes", module: "equipe" },
];

/** Links modulares da Equipe Técnica e Governança Unificada.
 * Nunca apontam para /admin: os ambientes /admin e /equipe são 100% isolados.
 */
const TEAM_MODULE_LINKS: Array<{ label: string; href: string; icon: string; module: AppModule }> = [
  { label: "Painel Técnico", href: "/equipe", icon: "🏗️", module: "dashboard" },
  { label: "Projetos", href: "/equipe/projetos", icon: "📋", module: "projetos" },
  { label: "Cronograma & Operação", href: "/equipe/cronograma", icon: "📅", module: "cronograma" },
  { label: "Acervo Manager", href: "/equipe/acervo", icon: "📁", module: "acervo" },
  { label: "Gestão Financeira", href: "/equipe/financeiro", icon: "💰", module: "financeiro" },
  { label: "Base de Clientes", href: "/equipe/clientes", icon: "👥", module: "clientes" },
  { label: "Central WhatsApp", href: "/equipe/whatsapp", icon: "💬", module: "dashboard" },
  { label: "E-mail Profissional", href: "/equipe/email", icon: "✉️", module: "dashboard" },
  { label: "Equipe & Governança", href: "/equipe/equipe", icon: "🛡️", module: "equipe" },
];

const TEAM_SECONDARY_LINKS: Array<{ label: string; href: string; module: AppModule }> = [
  { label: "Briefing", href: "/equipe/briefing", module: "projetos" },
  { label: "Propostas", href: "/equipe/propostas", module: "projetos" },
  { label: "Mensagens", href: "/equipe/mensagens", module: "dashboard" },
  { label: "Serviços", href: "/equipe/servicos", module: "dashboard" },
  { label: "Plugins & Downloads", href: "/equipe/acervo/plugins", module: "acervo" },
  { label: "Configurações", href: "/equipe/configuracoes", module: "equipe" },
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

  let unreadEmailCount = 0;
  if (user && !isClient) {
    unreadEmailCount = await prisma.emailThread
      .count({
        where: {
          isRead: false,
          folder: "INBOX",
          mailbox:
            effectiveRole === "ADMIN"
              ? { isActive: true }
              : { isActive: true, allowedUserIds: { has: user.id } },
        },
      })
      .catch(() => 0);
  }

  let allowedLinks: Array<readonly [string, string] | readonly [string, string, number]>;
  let bottomNavLinks: Array<{ label: string; href: string; icon: string }>;

  if (isClient) {
    allowedLinks = [
      ["Meu projeto", "/portal"],
      ["Acervo Manager", "/equipe/acervo"],
    ] as const;
    bottomNavLinks = [
      { label: "Meu Projeto", href: "/portal", icon: "🏛️" },
      { label: "Acervo", href: "/equipe/acervo", icon: "📁" },
    ];
  } else if (effectiveRole === "ADMIN") {
    allowedLinks = ALL_ADMIN_LINKS.map((item) =>
      item.href === "/admin/email"
        ? ([item.label, item.href, unreadEmailCount] as const)
        : ([item.label, item.href] as const)
    ).concat(SECONDARY_LINKS.map((item) => [item.label, item.href] as const));
    bottomNavLinks = ALL_ADMIN_LINKS.slice(0, 6).map((item) => ({
      label: item.label.split(" ")[0],
      href: item.href,
      icon: item.icon,
    }));
  } else {
    // Equipe técnica: links dinâmicos apontando exclusivamente para /equipe/*
    // Painel Técnico (/equipe) e Acervo Manager (/equipe/acervo) são sempre visíveis;
    // a restrição ocorre estritamente por empreendimento atribuído (ProjectAccess) e FeatureVisibility.
    const primary = TEAM_MODULE_LINKS.filter(
      (item) =>
        item.module === "dashboard" ||
        item.module === "acervo" ||
        effectivePermissions.includes(item.module)
    );
    const secondary = TEAM_SECONDARY_LINKS.filter(
      (item) =>
        item.module === "dashboard" ||
        item.module === "acervo" ||
        effectivePermissions.includes(item.module)
    );

    allowedLinks = primary
      .map((item) =>
        item.href === "/equipe/email"
          ? ([item.label, item.href, unreadEmailCount] as const)
          : ([item.label, item.href] as const)
      )
      .concat(secondary.map((item) => [item.label, item.href] as const));

    if (allowedLinks.length === 0) {
      allowedLinks = [["Painel Técnico", "/equipe"]];
    }

    bottomNavLinks = primary.slice(0, 6).map((item) => ({
      label: item.label.split(" ")[0],
      href: item.href,
      icon: item.icon,
    }));
  }

  const areaLabel = isClient
    ? "OS · portal do cliente"
    : effectiveRole === "ADMIN"
    ? "OS · gestão executiva"
    : "OS · operação técnica";

  const groupLabel = isClient ? "Meu projeto" : effectiveRole === "ADMIN" ? "Administração" : "Painel Técnico";

  return (
    <div className="min-h-dvh max-w-full overflow-x-clip bg-[#f5f5f7] dark:bg-[#09090B] dark:text-slate-300 pb-20 lg:pb-0 transition-colors duration-200">
      {/* Tab Guard de Sessão Efêmera no Cliente */}
      <SessionGuard />

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-zinc-200/70 dark:lg:border-white/10 lg:bg-white/80 dark:lg:bg-[#141419]/85 lg:backdrop-blur-xl">
        <div className="flex h-16 items-center px-6 border-b border-zinc-200/70 dark:border-white/10">
          <Brand compact />
        </div>

        <div className="px-6 py-3">
          <span className="text-[11px] font-medium tracking-[0.06em] uppercase text-zinc-500 dark:text-zinc-400">
            {areaLabel}
          </span>
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          <div className="pb-2">
            <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
              {groupLabel}
            </span>
          </div>

          <SidebarNav links={allowedLinks} />
        </nav>

        {user ? (
          <div className="p-4 border-t border-zinc-200/70 dark:border-white/10 bg-zinc-50/60 dark:bg-[#09090B]/50">
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</p>
                <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{user.role}</p>
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
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors duration-150"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:pl-72 min-w-0 max-w-full">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200/70 dark:border-white/10 bg-white/80 dark:bg-[#141419]/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <MobileNav links={allowedLinks} areaLabel={areaLabel} groupLabel={groupLabel} />
            <span className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.1em]">
              {eyebrow}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {user.name} <span className="text-zinc-400">({user.role})</span>
                </span>

                <form
                  action={async () => {
                    "use server";
                    await signOut();
                    redirect("/");
                  }}
                >
                  <button
                    type="submit"
                    className="apple-glass-btn min-h-[38px] px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50/90 dark:hover:bg-rose-950/40"
                  >
                    Sair
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/"
                className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Entrar →
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] min-w-0 px-5 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>

      {/* BOTTOM NAV MOBILE (Fixo em baixo em telas < 1024px) */}
      {!isClient && bottomNavLinks.length > 0 && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 dark:bg-[#141419]/90 backdrop-blur-xl border-t border-zinc-200/70 dark:border-white/10 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)]"
          aria-label="Navegação rápida móvel"
        >
          {bottomNavLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition"
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
