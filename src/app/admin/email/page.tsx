import { AppShell } from "@/components/app-shell";
import { EmailWorkspaceHub } from "@/components/email/email-workspace-hub";
import {
  ensureEmailBootstrap,
  getAccessibleMailboxes,
  getMonthlyResendUsage,
} from "@/lib/email/email-infra";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";

export const metadata = { title: "E-mail Profissional" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEmailPage() {
  const user = await requirePageAdminRole();
  await ensureEmailBootstrap();

  const [mailboxes, config, usage, projects, clients] = await Promise.all([
    getAccessibleMailboxes(user),
    prisma.emailDomainConfig.findUnique({ where: { id: "default" } }),
    getMonthlyResendUsage(),
    prisma.project.findMany({
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const threads = await prisma.emailThread.findMany({
    where: { mailboxId: { in: mailboxes.map((m) => m.id) } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      mailbox: { select: { id: true, address: true, displayName: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <AppShell eyebrow="Comunicação Corporativa" environment="admin">
      <EmailWorkspaceHub
        isAdmin={true}
        initialMailboxes={mailboxes}
        initialThreads={threads.map((t) => ({
          ...t,
          snoozedUntil: t.snoozedUntil ? t.snoozedUntil.toISOString() : null,
          lastMessageAt: t.lastMessageAt.toISOString(),
          messages: t.messages.map((m) => ({
            ...m,
            sentAt: m.sentAt ? m.sentAt.toISOString() : null,
            createdAt: m.createdAt.toISOString(),
          })),
        }))}
        initialConfig={
          config
            ? {
                ...config,
                lastSyncAt: config.lastSyncAt ? config.lastSyncAt.toISOString() : null,
              }
            : null
        }
        monthlyUsage={usage}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          clientName: p.client?.name || "Cliente",
        }))}
        clients={clients}
      />
    </AppShell>
  );
}
