"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getProjectAccessLogs } from "@/server/actions/deliverables";

export interface AccessLogItem {
  id: string;
  projectId: string;
  deliverableId: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: "VIEW" | "DOWNLOAD";
  sheetTitle: string;
  createdAt: Date | string;
  deliverable?: {
    id: string;
    sheetCode: string | null;
    title: string;
    subtitle: string | null;
    discipline: string;
    version: string;
  } | null;
}

interface DeliverableAccessLogsCardProps {
  projectId: string;
  initialLogs?: AccessLogItem[];
}

export function DeliverableAccessLogsCard({
  projectId,
  initialLogs = [],
}: DeliverableAccessLogsCardProps) {
  const [logs, setLogs] = useState<AccessLogItem[]>(initialLogs);
  const [loading, setLoading] = useState(false);

  const reloadLogs = async () => {
    try {
      setLoading(true);
      const res = await getProjectAccessLogs(projectId);
      setLogs(res as AccessLogItem[]);
    } catch (err) {
      console.error("Erro ao recarregar logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLogs.length === 0) {
      reloadLogs();
    }
  }, [projectId]);

  // Contadores Rápidos no Topo do Log
  const totalViews = logs.filter((l) => l.action === "VIEW").length;
  const totalDownloads = logs.filter((l) => l.action === "DOWNLOAD").length;
  const clientLogs = logs.filter(
    (l) => l.userRole === "CLIENT" || l.userRole === "CLIENTE",
  );
  const lastClientAccess = clientLogs[0];

  return (
    <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm overflow-hidden font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Auditoria de Segurança & Acessos
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Rastreamento em tempo real
            </span>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900">
            Painel de Controle de Logs (Downloads & Visualizações)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Histórico cronológico de conferência visual e download de pranchas por clientes e equipe técnica.
          </p>
        </div>

        <button
          type="button"
          onClick={reloadLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs active:scale-95 transition"
        >
          <svg
            className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {loading ? "Sincronizando..." : "Atualizar Logs"}
        </button>
      </div>

      {/* Contadores Rápidos no Topo do Log */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Total de Visualizações
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-950 font-mono">
            {totalViews}
          </p>
          <p className="mt-0.5 text-[11px] text-blue-600">
            Consultas no visualizador em tela cheia
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Downloads Realizados
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-950 font-mono">
            {totalDownloads}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-600">
            Baixas diretas de arquivos técnicos PDF
          </p>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
            Último Acesso do Cliente
          </p>
          <p className="mt-1 text-sm font-bold text-purple-950 truncate">
            {lastClientAccess
              ? new Date(lastClientAccess.createdAt).toLocaleString("pt-BR")
              : "Sem registros recentes"}
          </p>
          <p className="mt-0.5 text-[11px] text-purple-600 truncate">
            {lastClientAccess
              ? `${lastClientAccess.userName} (${lastClientAccess.action})`
              : "Aguardando primeiro acesso no portal"}
          </p>
        </div>
      </div>

      {/* Tabela de Auditoria de Acessos */}
      <div className="mt-5">
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <p className="text-xs font-semibold text-slate-600">
              Nenhum acesso registrado até o momento.
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Cada visualização em tela cheia ou download no portal gerará um registro nesta tabela.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-4 pr-2">Data e Hora</th>
                  <th className="py-2.5 px-2">Usuário / Perfil</th>
                  <th className="py-2.5 px-2">Ação</th>
                  <th className="py-2.5 pr-4 pl-2">Planta / Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {logs.slice(0, 30).map((log) => {
                  const isClient =
                    log.userRole === "CLIENT" || log.userRole === "CLIENTE";
                  const isAdmin = log.userRole === "ADMIN";

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 pl-4 pr-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </td>

                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">
                            {log.userName}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              isClient
                                ? "bg-emerald-100 text-emerald-800"
                                : isAdmin
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isClient ? "Cliente" : isAdmin ? "Admin" : "Equipe"}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-2">
                        {log.action === "DOWNLOAD" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            📥 BAIXOU PDF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            👁️ VISUALIZOU
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 pr-4 pl-2 font-medium text-slate-800">
                        {log.sheetTitle}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

