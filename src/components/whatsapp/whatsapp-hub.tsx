"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BentoKpiStrip } from "@/components/analytics";
import { Card } from "@/components/ui/card";
import { buildWhatsAppTemplates } from "@/lib/whatsapp/multi-session";

export interface WaSessionDTO {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  sessionName: string;
  isStudioOfficial: boolean;
  connectionStatus: string;
  qrCodeDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  onlyKnownContacts: boolean;
  autoSyncProjectTimeline: boolean;
  lastConnectedAt: string | null;
}

export interface WaMessageDTO {
  id: string;
  direction: string;
  bodyText: string;
  status: string;
  createdAt: string;
}

export interface WaConversationDTO {
  id: string;
  sessionId: string;
  ownerUserId: string;
  remoteJid: string;
  contactPhone: string;
  contactName: string | null;
  clientId: string | null;
  projectId: string | null;
  unreadCount: number;
  lastMessageAt: string;
  messages: WaMessageDTO[];
}

interface Props {
  isAdmin: boolean;
  initialMySession: WaSessionDTO;
  initialTeamSessions: WaSessionDTO[];
  initialConversations: WaConversationDTO[];
  initialGatewayUrl: string | null;
  studioPixKey: string;
  studioPixKeyType: string;
  projects: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string; phone: string | null }>;
  acervoDocs: Array<{ id: string; code: string; title: string; projectId: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Diretor / Design & Arquitetura",
  ARCHITECT: "Arquiteto(a)",
  ENGINEER: "Engenheiro(a) Estrutural",
  PARTNER: "Parceiro Técnico",
};

export function WhatsAppMultiSessionHub({
  isAdmin,
  initialMySession,
  initialTeamSessions,
  initialConversations,
  initialGatewayUrl,
  studioPixKey,
  studioPixKeyType,
  projects,
  clients,
  acervoDocs,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"chats" | "team">("chats");
  const [mySession, setMySession] = useState<WaSessionDTO>(initialMySession);
  const [teamSessions, setTeamSessions] = useState<WaSessionDTO[]>(initialTeamSessions);
  const [conversations, setConversations] = useState<WaConversationDTO[]>(initialConversations);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    initialConversations[0]?.id || null
  );

  const [pairingPhone, setPairingPhone] = useState("");
  const [gatewayUrlInput, setGatewayUrlInput] = useState(initialGatewayUrl || "");
  const [composePhone, setComposePhone] = useState("");
  const [composeProjectId, setComposeProjectId] = useState("");
  const [composeText, setComposeText] = useState("");
  const [selectedAcervoCode, setSelectedAcervoCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const templates = useMemo(
    () => buildWhatsAppTemplates(studioPixKey, studioPixKeyType),
    [studioPixKey, studioPixKeyType]
  );

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) || null,
    [conversations, selectedConvId]
  );

  const onlineTeamCount = useMemo(
    () => teamSessions.filter((s) => s.connectionStatus === "CONNECTED").length,
    [teamSessions]
  );

  const refreshState = async () => {
    const res = await fetch("/api/whatsapp/session", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as {
        mySession?: WaSessionDTO;
        teamSessions?: WaSessionDTO[];
        conversations?: WaConversationDTO[];
      };
      if (data.mySession) setMySession(data.mySession);
      if (data.teamSessions) setTeamSessions(data.teamSessions);
      if (data.conversations) setConversations(data.conversations);
    }
    router.refresh();
  };

  const handleSessionAction = async (
    action: "start" | "logout" | "toggle_privacy",
    extra?: Record<string, unknown>
  ) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json()) as { ok?: boolean; session?: WaSessionDTO; error?: string };
      if (!res.ok) {
        setFeedback(data.error || "Erro ao atualizar sessão WhatsApp.");
      } else if (data.session) {
        if (data.session.id === mySession.id) setMySession(data.session);
        setTeamSessions((prev) =>
          prev.map((s) => (s.id === data.session!.id ? data.session! : s))
        );
        setFeedback(
          action === "start"
            ? "QR Code individual gerado. Escaneie no WhatsApp do seu aparelho."
            : action === "logout"
              ? "Sessão desconectada com segurança."
              : "Preferência de privacidade atualizada."
        );
      }
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveGateway = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_gateway",
          gatewayUrl: gatewayUrlInput,
        }),
      });
      if (res.ok) {
        setFeedback("URL do Gateway Railway salva com sucesso.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async () => {
    const targetPhone = activeConv ? activeConv.contactPhone : composePhone;
    if (!targetPhone.trim() || !composeText.trim()) {
      setFeedback("Informe o número de destino e a mensagem.");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          toPhone: targetPhone,
          projectId: activeConv?.projectId || composeProjectId || null,
          text: composeText,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setFeedback(data.error || "Erro ao enviar mensagem.");
      } else {
        setComposeText("");
        setFeedback("Mensagem registrada e enviada pela sua sessão.");
        await refreshState();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConvertToRfi = async (convId: string, bodyText: string) => {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "convert_to_rfi",
        conversationId: convId,
        text: bodyText,
      }),
    });
    if (res.ok) {
      setFeedback("Mensagem convertida em registro de RFI / Pendência de Obra.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center rounded-md bg-emerald-700 dark:bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:text-zinc-950">
            WA-AKG Multi-Sessão • Railway
          </span>
          <h1 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Central WhatsApp Multi-Usuário
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Pareamento QR Code individual por Arquiteto e Engenheiro, filtro de privacidade e templates Pix ({studioPixKeyType}: {studioPixKey}).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "chats"
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "bg-white dark:bg-[#141419] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700"
            }`}
          >
            Minhas Conversas de Projetos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "team"
                ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                : "bg-white dark:bg-[#141419] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700"
            }`}
          >
            Equipe & Status de Conexão ({teamSessions.length})
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <BentoKpiStrip
        columns={4}
        items={[
          {
            id: "wa-my-status",
            label: "Minha Sessão",
            value:
              mySession.connectionStatus === "CONNECTED"
                ? "Conectado"
                : mySession.connectionStatus === "QR_READY"
                  ? "Aguardando QR"
                  : "Desconectado",
            featured: true,
            subtitle: mySession.connectedPhone || mySession.sessionName,
          },
          {
            id: "wa-team-online",
            label: "Sessões Online",
            value: `${onlineTeamCount} / ${teamSessions.length}`,
            subtitle: "Arquitetos & Engenheiros",
          },
          {
            id: "wa-convs",
            label: "Conversas de Projetos",
            value: String(conversations.length),
            subtitle: "Isoladas por profissional",
          },
          {
            id: "wa-privacy",
            label: "Filtro de Privacidade",
            value: mySession.onlyKnownContacts ? "Ativo" : "Aberto",
            subtitle: mySession.onlyKnownContacts
              ? "Oculta grupos e chats pessoais"
              : "Sincronizando todos os contatos",
            deltaTone: mySession.onlyKnownContacts ? "positive" : "neutral",
          },
        ]}
      />

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 dark:border-emerald-500/30 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-medium text-emerald-900 dark:text-emerald-200">
          {feedback}
        </div>
      )}

      {/* Card Individual de Conexão via QR Code */}
      <Card className="p-5 rounded-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EDE5D8] dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-[#18181B] dark:text-[#EDE5D8]">
                {ROLE_LABELS[mySession.userRole] || mySession.userRole}
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                {mySession.sessionName}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-50">
              Minha Conexão WhatsApp — {mySession.userName}
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Escaneie o QR Code exclusivo da sua sessão no aplicativo WhatsApp (Dispositivos Conectados) para enviar cobranças Pix, pranchas do Acervo e alinhamentos diretamente do seu número profissional.
            </p>

            {/* Toggle Privacidade */}
            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200/90 dark:border-zinc-700 bg-[#F4F4F8] dark:bg-[#1E1E27] p-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={mySession.onlyKnownContacts}
                onChange={(e) =>
                  handleSessionAction("toggle_privacy", {
                    onlyKnownContacts: e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-slate-700 dark:text-zinc-200">
                <strong>Modo Número Próprio:</strong> Sincronizar apenas Clientes e Obras do ArqVértice Flow (Ocultar conversas pessoais e grupos)
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={pairingPhone}
                onChange={(e) => setPairingPhone(e.target.value)}
                placeholder="Opcional: DDINúmero p/ código numérico"
                className="h-10 w-56 rounded-xl px-3 text-xs"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  handleSessionAction("start", {
                    phoneNumber: pairingPhone || undefined,
                  })
                }
                className="min-h-[40px] rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] px-4 py-2 text-xs font-bold text-white dark:text-[#18181B] hover:opacity-90 disabled:opacity-50"
              >
                {mySession.connectionStatus === "CONNECTED"
                  ? "Reconectar / Novo QR"
                  : "Gerar Meu QR Code"}
              </button>
              {mySession.connectionStatus !== "DISCONNECTED" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSessionAction("logout")}
                  className="min-h-[40px] rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-500/40 px-4 py-2 text-xs font-bold text-rose-700 dark:text-rose-300"
                >
                  Desconectar
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-[#F4F4F8] dark:bg-[#1E1E27] p-5 min-h-[210px]">
            {mySession.connectionStatus === "CONNECTED" ? (
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold">
                  ✓
                </div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  Aparelho Conectado
                </p>
                <p className="font-mono text-xs text-slate-600 dark:text-zinc-300">
                  {mySession.connectedPhone || mySession.sessionName}
                </p>
              </div>
            ) : mySession.qrCodeDataUrl ? (
              <div className="text-center space-y-2">
                <img
                  src={mySession.qrCodeDataUrl}
                  alt={`QR Code WhatsApp de ${mySession.userName}`}
                  className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
                />
                {mySession.pairingCode && (
                  <p className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">
                    Código: {mySession.pairingCode}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-slate-500 dark:text-zinc-400">
                Clique em <strong>Gerar Meu QR Code</strong> para parear seu WhatsApp pessoal ou corporativo.
              </p>
            )}
          </div>
        </div>
      </Card>

      {activeTab === "chats" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Lista de Conversas */}
          <Card className="lg:col-span-5 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Conversas Vinculadas ({conversations.length})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedConvId(null)}
                className="text-xs font-bold text-[#B45309] dark:text-[#F59E0B]"
              >
                + Nova Mensagem
              </button>
            </div>

            {conversations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-6 text-center text-xs text-slate-500 dark:text-zinc-400">
                Nenhuma conversa registrada ainda. Inicie um disparo ao lado usando um template ou número de cliente.
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {conversations.map((conv) => {
                  const proj = conv.projectId ? projectMap.get(conv.projectId) : null;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        selectedConvId === conv.id
                          ? "border-[#B45309] bg-[#EDE5D8]/50 dark:bg-white/10"
                          : "border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {conv.contactName || conv.contactPhone}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {conv.contactPhone}
                        </span>
                      </div>
                      {proj && (
                        <span className="mt-1 inline-block rounded bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-zinc-200">
                          Projeto: {proj.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Leitor + Compositor */}
          <Card className="lg:col-span-7 p-4 sm:p-5 rounded-2xl space-y-4">
            {activeConv ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-700 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50">
                      {activeConv.contactName || activeConv.contactPhone}
                    </h3>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {activeConv.contactPhone}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activeConv.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl p-3 text-xs ${
                        m.direction === "OUTBOUND"
                          ? "bg-[#EDE5D8]/60 dark:bg-white/10 ml-6"
                          : "bg-[#F4F4F8] dark:bg-[#1E1E27] mr-6"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-slate-900 dark:text-zinc-100">
                        {m.bodyText}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400">
                        <span>{m.status}</span>
                        <button
                          type="button"
                          onClick={() => handleConvertToRfi(activeConv.id, m.bodyText)}
                          className="font-semibold text-[#B45309] dark:text-[#F59E0B] hover:underline"
                        >
                          Converter em RFI / Pendência
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                    Cliente / Telefone (com DDI)
                  </label>
                  <input
                    type="text"
                    value={composePhone}
                    onChange={(e) => setComposePhone(e.target.value)}
                    placeholder="5585999999999"
                    list="wa-clients-phones"
                    className="w-full h-10 rounded-xl px-3 text-xs"
                  />
                  <datalist id="wa-clients-phones">
                    {clients
                      .filter((c) => c.phone)
                      .map((c) => (
                        <option key={c.id} value={c.phone || ""}>
                          {c.name}
                        </option>
                      ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                    Vincular Projeto
                  </label>
                  <select
                    value={composeProjectId}
                    onChange={(e) => setComposeProjectId(e.target.value)}
                    className="w-full h-10 rounded-xl px-3 text-xs"
                  >
                    <option value="">Sem vínculo</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Templates rápidos + Anexar Prancha Acervo CDE */}
            <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-zinc-700">
              <div className="flex flex-wrap gap-1.5">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setComposeText(tpl.text)}
                    className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#F4F4F8] dark:bg-[#1E1E27] px-2.5 py-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-[#EDE5D8] dark:hover:bg-zinc-800 transition"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              {acervoDocs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedAcervoCode}
                    onChange={(e) => setSelectedAcervoCode(e.target.value)}
                    className="h-9 flex-1 min-w-[200px] rounded-xl px-3 text-xs"
                  >
                    <option value="">Anexar Prancha do Acervo CDE...</option>
                    {acervoDocs.map((d) => (
                      <option key={d.id} value={`${d.code} — ${d.title}`}>
                        {d.code} — {d.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedAcervoCode}
                    onClick={() => {
                      if (!selectedAcervoCode) return;
                      setComposeText((prev) =>
                        `${prev ? prev + "\n\n" : ""}Prancha vinculada (Acervo CDE): ${selectedAcervoCode}`
                      );
                    }}
                    className="h-9 rounded-xl border border-slate-300 dark:border-zinc-700 px-3 text-xs font-semibold disabled:opacity-40"
                  >
                    Anexar
                  </button>
                </div>
              )}

              <textarea
                rows={4}
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder="Digite sua mensagem WhatsApp..."
                className="w-full rounded-xl p-3 text-xs"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSendMessage}
                  className="min-h-[42px] rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  Enviar pelo Meu WhatsApp
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* Aba Equipe & Status de Conexão */
        <div className="space-y-4">
          {isAdmin && (
            <Card className="p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50">
                Gateway Multi-Sessão WA-AKG (Railway)
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={gatewayUrlInput}
                  onChange={(e) => setGatewayUrlInput(e.target.value)}
                  placeholder="https://wa-akg-service-production.up.railway.app"
                  className="h-10 flex-1 rounded-xl px-3 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveGateway}
                  className="min-h-[40px] rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] px-4 py-2 text-xs font-bold text-white dark:text-[#18181B]"
                >
                  Salvar URL Railway
                </button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamSessions.map((s) => (
              <Card key={s.id} className="p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-50 truncate">
                      {s.userName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {ROLE_LABELS[s.userRole] || s.userRole}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.connectionStatus === "CONNECTED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : s.connectionStatus === "QR_READY"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {s.connectionStatus}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {s.connectedPhone || s.sessionName}
                </p>
                {isAdmin && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() =>
                        handleSessionAction("start", { targetUserId: s.userId })
                      }
                      className="flex-1 min-h-[34px] rounded-lg border border-slate-300 dark:border-zinc-700 text-[11px] font-semibold"
                    >
                      Gerar QR
                    </button>
                    {s.connectionStatus !== "DISCONNECTED" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSessionAction("logout", { targetUserId: s.userId })
                        }
                        className="min-h-[34px] rounded-lg border border-rose-200 px-2.5 text-[11px] font-semibold text-rose-600"
                      >
                        Resetar
                      </button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
