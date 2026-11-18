"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { BentoKpiStrip } from "@/components/analytics";
import { Card } from "@/components/ui/card";

export interface EmailMailboxItem {
  id: string;
  address: string;
  displayName: string;
  department: string;
  isShared: boolean;
}

export interface EmailMessageItem {
  id: string;
  threadId: string;
  direction: string;
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  bodyText: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailThreadItem {
  id: string;
  mailboxId: string;
  subject: string;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  snoozedUntil: string | null;
  clientId: string | null;
  projectId: string | null;
  participantEmail: string;
  participantName: string | null;
  snippet: string | null;
  lastMessageAt: string;
  mailbox: { id: string; address: string; displayName: string };
  messages: EmailMessageItem[];
}

export interface EmailDomainConfigItem {
  domain: string;
  cloudflareZoneId: string | null;
  resendDomainId: string | null;
  mailflareWorkerUrl: string | null;
  mailflareMcpUrl: string | null;
  gmailMirrorAddress: string;
  gmailMirrorEnabled: boolean;
  mxVerified: boolean;
  spfVerified: boolean;
  dkimVerified: boolean;
  dmarcVerified: boolean;
  lastSyncAt: string | null;
}

interface Props {
  isAdmin: boolean;
  initialMailboxes: EmailMailboxItem[];
  initialThreads: EmailThreadItem[];
  initialConfig: EmailDomainConfigItem | null;
  monthlyUsage: { sentThisMonth: number; monthlyLimit: number; remaining: number };
  projects: Array<{ id: string; name: string; clientName: string }>;
  clients: Array<{ id: string; name: string; email: string | null }>;
}

const FOLDERS = [
  { id: "INBOX", label: "Entrada" },
  { id: "SNOOZED", label: "Adiados / Snooze" },
  { id: "SCHEDULED", label: "Agendados" },
  { id: "SENT", label: "Enviados" },
  { id: "ARCHIVED", label: "Arquivo" },
] as const;

const TEMPLATES = [
  {
    id: "proposta",
    label: "Proposta Comercial",
    subject: "Proposta Comercial — Projeto Arquitetônico ArqVértice",
    body: "Olá,\n\nSegue o link da sua Proposta Comercial interativa elaborada pelo ArqVértice Studio.\n\nQualquer dúvida sobre o escopo ou cronograma, estou à disposição.\n\nAtenciosamente,\nEduardo Marques — ArqVértice Studio",
  },
  {
    id: "grd",
    label: "GRD Pranchas",
    subject: "GRD — Emissão de Pranchas Técnicas (Bom para Obra)",
    body: "Prezados,\n\nInformamos que a nova revisão das pranchas técnicas já está liberada no Acervo Manager CDE com QR Code de autenticidade.\n\nAcesse o portal para download das revisões vigentes.\n\nCoordenação BIM — ArqVértice",
  },
  {
    id: "pix",
    label: "Cobrança Pix CPF",
    subject: "Lembrete de Parcela — Chave Pix CPF 021.502.003-09",
    body: "Olá,\n\nSegue o lembrete referente à parcela do seu projeto.\n\nPagamento via Pix:\n• Chave CPF: 021.502.003-09\n• Favorecido: Eduardo César Costa Marques / ArqVértice Studio\n\nApós o pagamento, envie o comprovante respondendo a este e-mail.\n\nFinanceiro ArqVértice",
  },
  {
    id: "reuniao",
    label: "Convite Reunião",
    subject: "Agendamento de Reunião de Alinhamento — ArqVértice",
    body: "Olá,\n\nPara agilizar nossa próxima reunião de alinhamento, escolha o melhor horário diretamente na nossa agenda pública:\nhttps://arqvertice-flow.vercel.app/agendar\n\nAguardamos você!\nArqVértice Studio",
  },
];

export function EmailWorkspaceHub({
  isAdmin,
  initialMailboxes,
  initialThreads,
  initialConfig,
  monthlyUsage,
  projects,
  clients,
}: Props) {
  const [activeTab, setActiveTab] = useState<"inbox" | "infra">("inbox");
  const [threads, setThreads] = useState<EmailThreadItem[]>(initialThreads);
  const [config, setConfig] = useState<EmailDomainConfigItem | null>(initialConfig);
  const [usage, setUsage] = useState(monthlyUsage);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>(
    initialMailboxes[0]?.id || "ALL"
  );
  const [selectedFolder, setSelectedFolder] = useState<string>("INBOX");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreads[0]?.id || null
  );
  const [mobilePanel, setMobilePanel] = useState<"list" | "reader" | "compose">("list");

  // Composer state
  const [isComposing, setIsComposing] = useState(false);
  const [composeMailboxId, setComposeMailboxId] = useState(
    initialMailboxes[0]?.id || ""
  );
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeScheduledFor, setComposeScheduledFor] = useState("");
  const [composeProjectId, setComposeProjectId] = useState("");

  // 30s Undo Send Toast
  const [undoToast, setUndoToast] = useState<{
    messageId: string;
    to: string;
    secondsLeft: number;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync & Feedback
  const [isSyncingInfra, setIsSyncingInfra] = useState(false);
  const [infraStatusMsg, setInfraStatusMsg] = useState<string | null>(null);
  const [workerUrlInput, setWorkerUrlInput] = useState(
    initialConfig?.mailflareWorkerUrl || ""
  );
  const [gmailMirrorInput, setGmailMirrorInput] = useState(
    initialConfig?.gmailMirrorAddress || "eduardo.marques.arq@gmail.com"
  );
  const [copiedMcp, setCopiedMcp] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, []);

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  const unreadCount = useMemo(
    () => threads.filter((t) => !t.isRead && t.folder === "INBOX").length,
    [threads]
  );
  const followUpCount = useMemo(
    () =>
      threads.filter((t) => t.folder === "SNOOZED" || t.folder === "SCHEDULED")
        .length,
    [threads]
  );

  const dnsHealthOk = Boolean(
    config?.mxVerified && config?.spfVerified && config?.dkimVerified
  );

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const mailboxMatch =
        selectedMailboxId === "ALL" || t.mailboxId === selectedMailboxId;
      const folderMatch = t.folder === selectedFolder;
      return mailboxMatch && folderMatch;
    });
  }, [threads, selectedMailboxId, selectedFolder]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const handleSelectThread = async (thread: EmailThreadItem) => {
    setSelectedThreadId(thread.id);
    setMobilePanel("reader");
    if (!thread.isRead) {
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, isRead: true } : t))
      );
      await fetch("/api/email/mailflare-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_thread",
          threadId: thread.id,
          isRead: true,
        }),
      }).catch(() => {});
    }
  };

  const handleThreadAction = async (
    threadId: string,
    patch: { folder?: string; isRead?: boolean; snoozedUntil?: string | null }
  ) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, ...patch } : t))
    );
    await fetch("/api/email/mailflare-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_thread",
        threadId,
        ...patch,
      }),
    }).catch(() => {});
  };

  const handleSendWithUndo = async () => {
    const recipients = composeTo
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0 || !composeSubject.trim() || !composeBody.trim()) {
      return;
    }

    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "queue",
        mailboxId: composeMailboxId || initialMailboxes[0]?.id,
        to: recipients,
        subject: composeSubject.trim(),
        bodyText: composeBody,
        scheduledFor: composeScheduledFor || null,
        projectId: composeProjectId || null,
        undoWindowSeconds: composeScheduledFor ? 0 : 30,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      messageId?: string;
      status?: string;
      error?: string;
    };

    if (!res.ok || !data.ok || !data.messageId) {
      setInfraStatusMsg(data.error || "Erro ao preparar envio.");
      return;
    }

    setIsComposing(false);
    setMobilePanel("list");
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeScheduledFor("");

    if (data.status === "PENDING_UNDO") {
      const msgId = data.messageId;
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      setUndoToast({ messageId: msgId, to: recipients[0], secondsLeft: 30 });

      let left = 30;
      undoTimerRef.current = setInterval(async () => {
        left -= 1;
        if (left <= 0) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          setUndoToast(null);
          const dispatchRes = await fetch("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "dispatch", messageId: msgId }),
          });
          if (dispatchRes.ok) {
            setUsage((u) => ({
              ...u,
              sentThisMonth: u.sentThisMonth + 1,
              remaining: Math.max(0, u.remaining - 1),
            }));
          }
        } else {
          setUndoToast((curr) => (curr ? { ...curr, secondsLeft: left } : null));
        }
      }, 1000);
    }

    // Refresh threads list
    const listRes = await fetch("/api/email/mailflare-bridge");
    if (listRes.ok) {
      const listData = (await listRes.json()) as { threads?: EmailThreadItem[] };
      if (listData.threads) setThreads(listData.threads);
    }
  };

  const handleCancelSend = async () => {
    if (!undoToast) return;
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    const msgId = undoToast.messageId;
    setUndoToast(null);
    await fetch(`/api/email/cancel/${msgId}`, { method: "POST" });
    setInfraStatusMsg("Envio cancelado dentro da janela de 30 segundos.");
  };

  const handleImportEml = async (file: File) => {
    const rawEml = await file.text();
    const res = await fetch("/api/email/mailflare-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import_eml",
        mailboxId:
          selectedMailboxId !== "ALL"
            ? selectedMailboxId
            : initialMailboxes[0]?.id,
        rawEml,
      }),
    });
    if (res.ok) {
      const listRes = await fetch("/api/email/mailflare-bridge");
      if (listRes.ok) {
        const listData = (await listRes.json()) as { threads?: EmailThreadItem[] };
        if (listData.threads) setThreads(listData.threads);
      }
      setInfraStatusMsg(`Arquivo ${file.name} importado com sucesso.`);
    }
  };

  const handleSyncInfra = async () => {
    setIsSyncingInfra(true);
    setInfraStatusMsg(null);
    try {
      const res = await fetch("/api/email/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailflareWorkerUrl: workerUrlInput.trim() || null,
          gmailMirrorAddress: gmailMirrorInput.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        config?: EmailDomainConfigItem;
        diagnostics?: { warnings?: string[] };
        error?: string;
      };
      if (!res.ok) {
        setInfraStatusMsg(data.error || "Erro ao sincronizar APIs.");
      } else {
        if (data.config) setConfig(data.config);
        const warn = data.diagnostics?.warnings?.[0];
        setInfraStatusMsg(
          warn || "Sincronização com Cloudflare API, Resend API e Mailflare concluída."
        );
      }
    } finally {
      setIsSyncingInfra(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-md bg-[#18181B] dark:bg-[#EDE5D8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:text-[#18181B]">
            Mailflare + Cloudflare + Resend
          </span>
          <h1 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            E-mail Profissional & Caixa Compartilhada
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Caixas corporativas @{config?.domain || "arqvertice.com.br"} com envio autenticado, snooze, importação .eml e vínculo automático de projetos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "inbox"
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "bg-white dark:bg-[#18181B] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10"
            }`}
          >
            Caixa de Entrada
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("infra")}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "infra"
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "bg-white dark:bg-[#18181B] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10"
            }`}
          >
            Infraestrutura API & Gmail
          </button>
          <button
            type="button"
            onClick={() => {
              setIsComposing(true);
              setActiveTab("inbox");
              setMobilePanel("compose");
            }}
            className="min-h-[40px] rounded-xl bg-[#B45309] dark:bg-[#F59E0B] px-4 py-2 text-xs font-bold text-white dark:text-[#18181B] shadow-sm hover:opacity-90 transition"
          >
            + Novo E-mail
          </button>
        </div>
      </div>

      {/* Strip Bento de 4 KPIs (HorizontalScrollTrack no Mobile 375px) */}
      <BentoKpiStrip
        columns={4}
        items={[
          {
            id: "email-unread",
            label: "Não Lidos",
            value: String(unreadCount),
            featured: true,
            subtitle: "Na caixa de entrada",
          },
          {
            id: "email-followups",
            label: "Follow-ups Pendentes",
            value: String(followUpCount),
            subtitle: "Adiados (Snooze) & Agendados",
          },
          {
            id: "email-quota",
            label: "Envios no Mês (Resend)",
            value: `${usage.sentThisMonth} / ${usage.monthlyLimit}`,
            subtitle: `${usage.remaining} envios grátis restantes`,
          },
          {
            id: "email-health",
            label: "Saúde DNS & APIs",
            value: dnsHealthOk ? "Saudável" : "Pendente",
            delta: config?.mailflareWorkerUrl ? "Mailflare Ativo" : "Configurar DNS",
            deltaTone: dnsHealthOk ? "positive" : "neutral",
          },
        ]}
      />

      {infraStatusMsg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/30 px-4 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-200">
          {infraStatusMsg}
        </div>
      )}

      {activeTab === "inbox" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Coluna 1: Caixas e Pastas */}
          <Card className="lg:col-span-3 p-4 rounded-2xl border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#18181B] space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Caixas Autorizadas
              </p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMailboxId("ALL");
                    setMobilePanel("list");
                  }}
                  className={`w-full text-left rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    selectedMailboxId === "ALL"
                      ? "bg-[#EDE5D8] dark:bg-white/15 text-[#18181B] dark:text-[#EDE5D8]"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  Todas as Caixas ({initialMailboxes.length})
                </button>
                {initialMailboxes.map((mb) => (
                  <button
                    key={mb.id}
                    type="button"
                    onClick={() => {
                      setSelectedMailboxId(mb.id);
                      setMobilePanel("list");
                    }}
                    className={`w-full text-left rounded-xl px-3 py-2 text-xs transition ${
                      selectedMailboxId === mb.id
                        ? "bg-[#EDE5D8] dark:bg-white/15 font-semibold text-[#18181B] dark:text-[#EDE5D8]"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="truncate">{mb.address}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {mb.department}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Pastas
              </p>
              <div className="space-y-1">
                {FOLDERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setSelectedFolder(f.id);
                      setMobilePanel("list");
                    }}
                    className={`w-full text-left rounded-xl px-3 py-2 text-xs transition ${
                      selectedFolder === f.id
                        ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B] font-semibold"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10">
              <input
                ref={fileInputRef}
                type="file"
                accept=".eml,message/rfc822"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportEml(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[38px] rounded-xl border border-dashed border-slate-300 dark:border-white/20 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition"
              >
                Importar arquivo .eml
              </button>
            </div>
          </Card>

          {/* Coluna 2: Lista de Threads */}
          <Card
            className={`lg:col-span-4 p-4 rounded-2xl border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#18181B] ${
              mobilePanel !== "list" ? "hidden lg:block" : "block"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Conversas ({filteredThreads.length})
              </h2>
            </div>

            {filteredThreads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-center text-xs text-slate-500">
                Nenhuma mensagem nesta pasta. Clique em <strong>+ Novo E-mail</strong> ou importe um <code>.eml</code>.
              </div>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {filteredThreads.map((t) => {
                  const proj = t.projectId ? projectMap.get(t.projectId) : null;
                  const cli = t.clientId ? clientMap.get(t.clientId) : null;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setIsComposing(false);
                        handleSelectThread(t);
                      }}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        selectedThreadId === t.id && !isComposing
                          ? "border-[#B45309] bg-[#EDE5D8]/40 dark:bg-white/10"
                          : "border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-xs ${
                            t.isRead
                              ? "font-medium text-slate-700 dark:text-slate-300"
                              : "font-bold text-slate-900 dark:text-white"
                          }`}
                        >
                          {t.participantName || t.participantEmail}
                        </span>
                        {!t.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#B45309]" />
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {t.subject}
                      </p>
                      {t.snippet && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {t.snippet}
                        </p>
                      )}
                      {(proj || cli) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {proj && (
                            <span className="rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                              Projeto: {proj.name}
                            </span>
                          )}
                          {cli && (
                            <span className="rounded bg-[#EDE5D8] dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-[#18181B] dark:text-amber-200">
                              {cli.name}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Coluna 3: Leitor ou Compositor */}
          <Card
            className={`lg:col-span-5 p-4 sm:p-5 rounded-2xl border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#18181B] ${
              mobilePanel === "list" ? "hidden lg:block" : "block"
            }`}
          >
            <div className="lg:hidden mb-3">
              <button
                type="button"
                onClick={() => {
                  setIsComposing(false);
                  setMobilePanel("list");
                }}
                className="text-xs font-bold text-[#B45309] dark:text-[#F59E0B]"
              >
                ← Voltar para conversas
              </button>
            </div>

            {isComposing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Compor E-mail
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsComposing(false)}
                    className="text-xs text-slate-400 hover:text-slate-700"
                  >
                    Fechar
                  </button>
                </div>

                {/* Templates rápidos */}
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setComposeSubject(tpl.subject);
                        setComposeBody(tpl.body);
                      }}
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-[#F5F5F7] dark:bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#EDE5D8] dark:hover:bg-white/15 transition"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Remetente
                  </label>
                  <select
                    value={composeMailboxId}
                    onChange={(e) => setComposeMailboxId(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {initialMailboxes.map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.displayName} ({mb.address})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Para (separe por vírgula)
                  </label>
                  <input
                    type="text"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="cliente@empresa.com"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Assunto
                  </label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Assunto do e-mail"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Vincular Projeto (opcional)
                    </label>
                    <select
                      value={composeProjectId}
                      onChange={(e) => setComposeProjectId(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sem vínculo</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Agendar Envio (opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={composeScheduledFor}
                      onChange={(e) => setComposeScheduledFor(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Mensagem
                  </label>
                  <textarea
                    rows={7}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Escreva sua mensagem..."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] p-3 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSendWithUndo}
                    className="min-h-[42px] rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] px-5 py-2 text-xs font-bold text-white dark:text-[#18181B] hover:opacity-90 transition"
                  >
                    {composeScheduledFor
                      ? "Agendar Envio"
                      : "Enviar (Desfazer 30s)"}
                  </button>
                </div>
              </div>
            ) : activeThread ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeThread.subject}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Caixa: {activeThread.mailbox.address} • Contato:{" "}
                      {activeThread.participantEmail}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleThreadAction(activeThread.id, {
                          folder: "SNOOZED",
                          snoozedUntil: new Date(
                            Date.now() + 86_400_000
                          ).toISOString(),
                        })
                      }
                      className="rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      Adiar 24h
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleThreadAction(activeThread.id, { folder: "ARCHIVED" })
                      }
                      className="rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      Arquivar
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {activeThread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl p-3.5 text-xs ${
                        m.direction === "OUTBOUND"
                          ? "bg-[#EDE5D8]/50 dark:bg-white/10 border border-[#EDE5D8] dark:border-white/10"
                          : "bg-[#F5F5F7] dark:bg-[#09090B] border border-slate-200/60 dark:border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {m.fromAddress}
                        </span>
                        <span className="uppercase text-[10px] font-bold">
                          {m.status}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {m.bodyText}
                      </pre>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setComposeMailboxId(activeThread.mailboxId);
                    setComposeTo(activeThread.participantEmail);
                    setComposeSubject(
                      activeThread.subject.startsWith("Re:")
                        ? activeThread.subject
                        : `Re: ${activeThread.subject}`
                    );
                    setComposeBody("");
                    setIsComposing(true);
                    setMobilePanel("compose");
                  }}
                  className="min-h-[40px] rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] px-4 py-2 text-xs font-bold text-white dark:text-[#18181B]"
                >
                  Responder
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Selecione uma conversa para ler ou clique em + Novo E-mail.
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* Aba Infraestrutura API & Gmail */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 rounded-2xl border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#18181B] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Status Cloudflare API + Resend API + Mailflare Worker
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  disabled={isSyncingInfra}
                  onClick={handleSyncInfra}
                  className="min-h-[38px] rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] px-4 py-1.5 text-xs font-bold text-white dark:text-[#18181B] disabled:opacity-50"
                >
                  {isSyncingInfra
                    ? "Sincronizando..."
                    : "Sincronizar DNS & APIs Agora"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-slate-200/60 dark:border-white/10 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-bold">
                  MX (Email Routing)
                </span>
                <p className="mt-1 font-bold">
                  {config?.mxVerified ? "✅ Verificado" : "⏳ Pendente"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-white/10 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-bold">
                  SPF (Resend)
                </span>
                <p className="mt-1 font-bold">
                  {config?.spfVerified ? "✅ Verificado" : "⏳ Pendente"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-white/10 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-bold">
                  DKIM (Assinatura)
                </span>
                <p className="mt-1 font-bold">
                  {config?.dkimVerified ? "✅ Verificado" : "⏳ Pendente"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-white/10 p-3">
                <span className="text-[10px] uppercase text-slate-400 font-bold">
                  DMARC
                </span>
                <p className="mt-1 font-bold">
                  {config?.dmarcVerified ? "✅ Verificado" : "⏳ Pendente"}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  URL do Worker Mailflare
                </label>
                <input
                  type="url"
                  value={workerUrlInput}
                  onChange={(e) => setWorkerUrlInput(e.target.value)}
                  placeholder="https://mailflare.<subdominio>.workers.dev"
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {config?.mailflareWorkerUrl && (
                  <a
                    href={config.mailflareWorkerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[38px] items-center rounded-xl bg-[#B45309] dark:bg-[#F59E0B] px-4 py-2 text-xs font-bold text-white dark:text-[#18181B]"
                  >
                    Abrir Webmail Mailflare ↗
                  </a>
                )}
                {(config?.mailflareMcpUrl || workerUrlInput) && (
                  <button
                    type="button"
                    onClick={() => {
                      const url =
                        config?.mailflareMcpUrl ||
                        `${workerUrlInput.replace(/\/$/, "")}/api/mcp`;
                      navigator.clipboard?.writeText(url);
                      setCopiedMcp(true);
                      setTimeout(() => setCopiedMcp(false), 2500);
                    }}
                    className="inline-flex min-h-[38px] items-center rounded-xl border border-slate-200 dark:border-white/15 px-4 py-2 text-xs font-semibold"
                  >
                    {copiedMcp ? "URL MCP Copiada!" : "Copiar URL MCP"}
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#18181B] space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Vínculo Gmail (smtp.resend.com:465 + Espelhamento)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Para enviar e receber diretamente pelo Gmail usando seu domínio corporativo sem custo mensal:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li>
                No Cloudflare Email Routing, o espelho está apontado para{" "}
                <strong className="font-mono">{gmailMirrorInput}</strong>.
              </li>
              <li>
                No Gmail: <strong>Configurações → Contas e importação → Enviar e-mail como</strong> → Adicionar <code>eduardo@{config?.domain || "arqvertice.com.br"}</code>.
              </li>
              <li>
                Servidor SMTP: <code>smtp.resend.com</code> • Porta: <code>465</code> (SSL) • Usuário: <code>resend</code> • Senha: sua <code>RESEND_API_KEY</code>.
              </li>
            </ol>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                E-mail Gmail de Espelhamento
              </label>
              <input
                type="email"
                value={gmailMirrorInput}
                onChange={(e) => setGmailMirrorInput(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs"
              />
            </div>
          </Card>
        </div>
      )}

      {/* Barra Toast "Desfazer envio (30s)" */}
      {undoToast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[70] flex items-center gap-3 rounded-xl border border-[#18181B] bg-[#18181B] px-4 py-3 text-xs font-semibold text-white shadow-2xl"
        >
          <span>
            Enviando para <strong>{undoToast.to}</strong> em{" "}
            <span className="tabular-nums text-[#F59E0B]">
              {undoToast.secondsLeft}s
            </span>
            ...
          </span>
          <button
            type="button"
            onClick={handleCancelSend}
            className="rounded-lg bg-[#EDE5D8] px-3 py-1 text-[11px] font-bold text-[#18181B] hover:opacity-90"
          >
            Cancelar Envio
          </button>
        </div>
      )}
    </div>
  );
}
