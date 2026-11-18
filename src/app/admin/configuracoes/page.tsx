import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { AdminSettingsHub } from "@/components/settings/admin-settings-hub";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";
import { getInfrastructureHealth, getStudioSettings } from "@/server/services/settings-service";

export const metadata = { title: "Configurações do Estúdio — ArqVértice Flow" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function checkLocalOllamaOnline(): Promise<boolean> {
  const baseUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(700) });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function ConfiguracoesPage() {
  const admin = await requirePageAdminRole();
  const [settings, health, rawLogs, ollamaOnline] = await Promise.all([
    getStudioSettings(),
    getInfrastructureHealth(),
    prisma.agentActionLog
      .findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          source: true,
          actionName: true,
          status: true,
          actorEmail: true,
          resultSummary: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    checkLocalOllamaOnline(),
  ]);

  const recentAgentLogs = rawLogs.map((log: (typeof rawLogs)[number]) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <AppShell eyebrow="Administração" role={admin.role}>
      <SectionHeading
        title="Central de Configurações do Estúdio"
        description="Perfil do Administrador, dados institucionais de faturamento, parâmetros comerciais e governança de segurança."
      />
      <AdminSettingsHub
        initialSettings={settings}
        initialProfile={{
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone ?? "",
          whatsapp: admin.whatsapp ?? "",
          professionalReg: admin.professionalReg ?? "",
        }}
        initialHealth={health}
        recentAgentLogs={recentAgentLogs}
        openbotAgentKey={process.env.OPENBOT_AGENT_KEY ?? ""}
        ollamaOnline={ollamaOnline}
      />
    </AppShell>
  );
}
