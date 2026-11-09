"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatReminderMessage,
  generateWhatsAppLink,
  logReminderAction,
  sendBatchRemindersAction,
  type ReminderTriggerType,
} from "@/server/actions/notifications";
import { generateGoogleCalendarUrl } from "@/server/actions/calendar-sync";

interface StageRowItem {
  stageId: string;
  stageName: string;
  discipline: string;
  projectId: string;
  projectName: string;
  designerName: string;
  designerPhone: string;
  designerEmail: string;
  dueDate: string;
  dueDateRaw: Date | null;
  completion: number;
  status: string;
  urgency: "ATRASADO" | "HOJE" | "PROXIMO" | "NO_PRAZO";
  daysDiff: number;
  recentReminders: Array<{
    id: string;
    triggerType: string;
    channel: string;
    sentAt: string;
    status: string;
  }>;
}

interface LogItem {
  id: string;
  stageName: string;
  projectName: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  channel: string;
  triggerType: string;
  messageBody: string;
  sentAt: string;
  status: string;
}

interface NotificationManagementViewProps {
  initialStageRows: StageRowItem[];
  initialLogs: LogItem[];
}

export function NotificationManagementView({
  initialStageRows,
  initialLogs,
}: NotificationManagementViewProps) {
  const [stages, setStages] = useState<StageRowItem[]>(initialStageRows);
  const [logs, setLogs] = useState<LogItem[]>(initialLogs);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [activeMessageModal, setActiveMessageModal] = useState<{
    stage: StageRowItem;
    subject: string;
    body: string;
    triggerType: ReminderTriggerType;
    whatsappUrl: string;
  } | null>(null);

  // 1. Abrir modal / preparar disparo
  const handlePrepareReminder = async (stage: StageRowItem) => {
    const triggerType: ReminderTriggerType =
      stage.urgency === "ATRASADO"
        ? "ATRASADO"
        : stage.urgency === "HOJE"
        ? "ENTREGA_HOJE"
        : "PRAZO_PROXIMO";

    const { subject, body } = await formatReminderMessage({
      recipientName: stage.designerName,
      stageName: stage.stageName,
      projectName: stage.projectName,
      dueDate: stage.dueDate,
      progressPercent: stage.completion,
      triggerType,
    });

    const whatsappUrl = await generateWhatsAppLink(stage.designerPhone, body);

    setActiveMessageModal({
      stage,
      subject,
      body,
      triggerType,
      whatsappUrl,
    });
  };

  // 2. Disparar WhatsApp e registrar log
  const handleDispatchWhatsApp = async () => {
    if (!activeMessageModal) return;
    const { stage, body, triggerType, whatsappUrl } = activeMessageModal;

    // Abre no navegador / WhatsApp Web
    window.open(whatsappUrl, "_blank");

    // Registra log no banco Neon
    await logReminderAction({
      stageId: stage.stageId,
      recipientName: stage.designerName,
      recipientPhone: stage.designerPhone,
      recipientEmail: stage.designerEmail,
      channel: "WHATSAPP",
      triggerType,
      messageBody: body,
      status: "ENVIADO",
    });

    // Atualização otimista da lista de logs
    setLogs((prev) => [
      {
        id: `local-${Date.now()}`,
        stageName: stage.stageName,
        projectName: stage.projectName,
        recipientName: stage.designerName,
        recipientPhone: stage.designerPhone,
        recipientEmail: stage.designerEmail,
        channel: "WHATSAPP",
        triggerType,
        messageBody: body,
        sentAt: new Date().toLocaleString("pt-BR"),
        status: "ENVIADO",
      },
      ...prev,
    ]);

    setActiveMessageModal(null);
  };

  // 3. Disparar E-mail
  const handleDispatchEmail = async () => {
    if (!activeMessageModal) return;
    const { stage, subject, body, triggerType } = activeMessageModal;

    const mailtoUrl = `mailto:${stage.designerEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    await logReminderAction({
      stageId: stage.stageId,
      recipientName: stage.designerName,
      recipientPhone: stage.designerPhone,
      recipientEmail: stage.designerEmail,
      channel: "EMAIL",
      triggerType,
      messageBody: body,
      status: "ENVIADO",
    });

    setLogs((prev) => [
      {
        id: `local-${Date.now()}`,
        stageName: stage.stageName,
        projectName: stage.projectName,
        recipientName: stage.designerName,
        recipientPhone: stage.designerPhone,
        recipientEmail: stage.designerEmail,
        channel: "EMAIL",
        triggerType,
        messageBody: body,
        sentAt: new Date().toLocaleString("pt-BR"),
        status: "ENVIADO",
      },
      ...prev,
    ]);

    setActiveMessageModal(null);
  };

  // 4. Disparo em Lote
  const handleSendBatch = async () => {
    setIsSendingBatch(true);
    try {
      const res = await sendBatchRemindersAction();
      alert(`Disparo em lote concluído com sucesso: ${res.count} lembretes registrados!`);
      window.location.reload();
    } catch {
      alert("Falha ao executar disparo em lote.");
    } finally {
      setIsSendingBatch(false);
    }
  };

  // 5. Adicionar etapa específica ao Google Agenda
  const handleAddToCalendar = async (stage: StageRowItem) => {
    const calendarUrl = await generateGoogleCalendarUrl({
      title: `[${stage.projectName}] ${stage.stageName}`,
      description: `Responsável: ${stage.designerName}\\nDisciplina: ${stage.discipline}\\nAvanço: ${stage.completion}%`,
      startDate: stage.dueDateRaw ? new Date(stage.dueDateRaw) : new Date(),
    });
    window.open(calendarUrl, "_blank");
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Topo: Painel de Controle de Notificações & Integrações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h2 className="text-xl font-black tracking-tight text-zinc-950 sm:text-2xl">
            Central de Lembretes Multicanal & Agenda
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Disparos automáticos e sob demanda via WhatsApp, E-mail e sincronização Google Calendar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/api/calendar/export"
            download="arqvertice-cronograma.ics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-2xs hover:bg-zinc-50 transition active:scale-95"
            title="Exportar arquivo .ics padrão para Outlook ou Apple Calendar"
          >
            <span>📅 Baixar Feed .ICS</span>
          </a>

          <a
            href="https://calendar.google.com/calendar/r?cid=https%3A%2F%2Farqvertice-flow.vercel.app%2Fapi%2Fcalendar%2Fexport"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-2 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-100 transition active:scale-95"
            title="Inscrever o Google Calendar do Admin no feed de etapas"
          >
            <span>🗓️ Sincronizar Google Agenda</span>
          </a>

          <button
            type="button"
            onClick={handleSendBatch}
            disabled={isSendingBatch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
          >
            <span>⚡ {isSendingBatch ? "Processando..." : "Disparar Lembretes em Lote"}</span>
          </button>
        </div>
      </div>

      {/* Grid de Estatísticas Rápidas de Prazos */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Atrasadas</span>
          <p className="mt-1 text-2xl font-black text-rose-950 font-mono">
            {stages.filter((s) => s.urgency === "ATRASADO").length}
          </p>
        </Card>

        <Card className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Entrega Hoje</span>
          <p className="mt-1 text-2xl font-black text-amber-950 font-mono">
            {stages.filter((s) => s.urgency === "HOJE").length}
          </p>
        </Card>

        <Card className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Próximos 3 Dias</span>
          <p className="mt-1 text-2xl font-black text-blue-950 font-mono">
            {stages.filter((s) => s.urgency === "PROXIMO").length}
          </p>
        </Card>

        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">No Prazo</span>
          <p className="mt-1 text-2xl font-black text-emerald-950 font-mono">
            {stages.filter((s) => s.urgency === "NO_PRAZO").length}
          </p>
        </Card>
      </div>

      {/* Tabela Operacional de Etapas e Ações de Disparo */}
      <Card className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
        <div className="bg-zinc-50/80 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            Painel Operacional de Notificações de Prazos
          </span>
          <span className="text-[11px] text-zinc-500">
            {stages.length} etapas em monitoramento ativo
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="py-2.5 pl-4 pr-2">Etapa / Empreendimento</th>
                <th className="py-2.5 px-2">Responsável Técnico</th>
                <th className="py-2.5 px-2">Vencimento</th>
                <th className="py-2.5 px-2">Avanço</th>
                <th className="py-2.5 px-2">Status do Prazo</th>
                <th className="py-2.5 pr-4 pl-2 text-right">Ações Imediatas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {stages.map((stage) => {
                return (
                  <tr key={stage.stageId} className="hover:bg-zinc-50/60 transition">
                    <td className="py-3 pl-4 pr-2">
                      <p className="font-bold text-zinc-900">{stage.stageName}</p>
                      <p className="text-[11px] text-zinc-500">{stage.projectName} · {stage.discipline}</p>
                    </td>

                    <td className="py-3 px-2">
                      <p className="font-semibold text-zinc-900">{stage.designerName}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {stage.designerPhone} · {stage.designerEmail}
                      </p>
                    </td>

                    <td className="py-3 px-2 font-mono text-zinc-700 font-semibold">
                      {stage.dueDate}
                    </td>

                    <td className="py-3 px-2 font-mono">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-bold text-zinc-800">
                        {stage.completion}%
                      </span>
                    </td>

                    <td className="py-3 px-2">
                      <Badge
                        tone={
                          stage.urgency === "ATRASADO"
                            ? "red"
                            : stage.urgency === "HOJE"
                            ? "amber"
                            : stage.urgency === "PROXIMO"
                            ? "blue"
                            : "green"
                        }
                      >
                        {stage.urgency === "ATRASADO"
                          ? `Atrasado (${Math.abs(stage.daysDiff)}d)`
                          : stage.urgency === "HOJE"
                          ? "Vence Hoje"
                          : stage.urgency === "PROXIMO"
                          ? `Em ${stage.daysDiff} dias`
                          : "No Prazo"}
                      </Badge>
                    </td>

                    <td className="py-3 pr-4 pl-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePrepareReminder(stage)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 transition"
                          title="Disparar lembrete via WhatsApp"
                        >
                          💬 WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddToCalendar(stage)}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 active:scale-95 transition"
                          title="Adicionar ao Google Agenda"
                        >
                          📅 Agenda
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Histórico Recente de Disparos de Lembretes */}
      <Card className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-950 font-mono">
            Histórico Recente de Disparos Realizados
          </h3>
          <span className="text-xs text-zinc-500">{logs.length} registros</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Nenhum disparo registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="py-2 px-3">Data/Hora</th>
                  <th className="py-2 px-2">Destinatário</th>
                  <th className="py-2 px-2">Canal</th>
                  <th className="py-2 px-2">Gatilho</th>
                  <th className="py-2 px-2">Mensagem</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500">{log.sentAt}</td>
                    <td className="py-2.5 px-2 font-semibold text-zinc-900">{log.recipientName}</td>
                    <td className="py-2.5 px-2 font-mono">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700 font-bold">
                        {log.channel}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge tone={log.triggerType === "ATRASADO" ? "red" : "blue"} className="text-[10px]">
                        {log.triggerType}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-zinc-600 max-w-xs truncate" title={log.messageBody}>
                      {log.messageBody}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-emerald-600 font-bold text-[11px]">✓ Enviado</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Prévia e Disparo do Lembrete */}
      {activeMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h4 className="text-base font-bold text-zinc-950">Prévia do Lembrete</h4>
                <p className="text-xs text-zinc-500">
                  {activeMessageModal.stage.stageName} · {activeMessageModal.stage.projectName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMessageModal(null)}
                className="text-zinc-400 hover:text-zinc-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200/80">
                <span className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                  Destinatário:
                </span>
                <p className="font-semibold text-zinc-900 mt-0.5">
                  {activeMessageModal.stage.designerName} ({activeMessageModal.stage.designerPhone} ·{" "}
                  {activeMessageModal.stage.designerEmail})
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50/60 p-3 border border-emerald-200">
                <span className="font-bold text-emerald-800 uppercase tracking-wider text-[10px]">
                  Texto do Lembrete:
                </span>
                <p className="mt-1 text-emerald-950 leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                  {activeMessageModal.body}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveMessageModal(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDispatchEmail}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 active:scale-95 transition"
              >
                ✉️ Disparar E-mail
              </button>

              <button
                type="button"
                onClick={handleDispatchWhatsApp}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm"
              >
                💬 Abrir no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

