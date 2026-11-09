import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/server/auth";
import { getReminderDashboardData } from "@/server/actions/notifications";
import { NotificationManagementView } from "@/components/notifications/notification-management-view";

export const metadata = { title: "Central de Notificações & Lembretes — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requirePageRole("ADMIN");

  const { stageRows, recentLogs } = await getReminderDashboardData();

  return (
    <AppShell eyebrow="Gestão Executiva & Prazos">
      <NotificationManagementView initialStageRows={stageRows} initialLogs={recentLogs} />
    </AppShell>
  );
}

