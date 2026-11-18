import { AppShell } from "@/components/app-shell";
import { WhatsAppMultiSessionHub } from "@/components/whatsapp/whatsapp-hub";
import { ensureWhatsAppBootstrapForUser } from "@/lib/whatsapp/multi-session";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";
import { getStudioSettings } from "@/server/services/settings-service";

export const metadata = { title: "Central WhatsApp Multi-Usuário — ArqVértice Flow" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminWhatsAppPage() {
  const user = await requirePageAdminRole();
  const mySession = await ensureWhatsAppBootstrapForUser(user);

  const [teamSessions, gatewayConfig, conversations, studioSettings, projects, clients, acervoDocs] =
    await Promise.all([
      prisma.whatsAppUserSession.findMany({
        orderBy: [{ isStudioOfficial: "desc" }, { userName: "asc" }],
      }),
      prisma.whatsAppGatewayConfig.findUnique({ where: { id: "default" } }),
      prisma.whatsAppConversation.findMany({
        orderBy: { lastMessageAt: "desc" },
        take: 60,
        include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
      }),
      getStudioSettings(),
      prisma.project.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.client.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
      }),
      prisma.acervoDocument.findMany({
        select: { id: true, code: true, title: true, projectId: true },
        take: 40,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  const serializeSession = (s: typeof mySession) => ({
    ...s,
    lastConnectedAt: s.lastConnectedAt ? s.lastConnectedAt.toISOString() : null,
  });

  return (
    <AppShell eyebrow="Comunicação WhatsApp" environment="admin">
      <WhatsAppMultiSessionHub
        isAdmin={true}
        initialMySession={serializeSession(mySession)}
        initialTeamSessions={teamSessions.map(serializeSession)}
        initialConversations={conversations.map((c) => ({
          ...c,
          lastMessageAt: c.lastMessageAt.toISOString(),
          messages: c.messages.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
          })),
        }))}
        initialGatewayUrl={gatewayConfig?.gatewayUrl || null}
        studioPixKey={studioSettings.pixKey}
        studioPixKeyType={studioSettings.pixKeyType}
        projects={projects}
        clients={clients}
        acervoDocs={acervoDocs}
      />
    </AppShell>
  );
}
