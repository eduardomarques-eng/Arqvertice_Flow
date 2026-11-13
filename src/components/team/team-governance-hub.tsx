"use client";

import { useState, useTransition, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  updateTeamMemberProfileAction,
  updateTeamMemberGovernanceAction,
  createTeamMemberAction,
  recordReminderLogAction,
  dispatchCommunicationAction,
  type CreateProfileInput,
  type DispatchCommunicationInput,
} from "@/server/actions/team";
import { formatDateBR } from "@/lib/formatters";
import { ROLE_PERMISSION_PRESETS, type AppModule } from "@/lib/rbac";

export interface TeamMemberStage {
  id: string;
  name: string;
  discipline: string;
  projectId: string;
  projectName: string;
  dueDate: string | Date | null;
  completion: number;
  status: string;
  urgency: "ATRASADO" | "HOJE" | "PROXIMO" | "NO_PRAZO";
}

export interface ReminderLogItem {
  id: string;
  triggerType: string;
  channel: string;
  messageBody: string;
  sentAt: string;
  status: string;
}

export interface TeamMemberData {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR";
  specialty: string | null;
  whatsapp: string | null;
  isActive: boolean;
  permissions: string[];
  assignedProjectIds: string[];
  canEdit: boolean;
  stages: TeamMemberStage[];
  logs: ReminderLogItem[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  clientName: string;
}

export interface ClientContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  projectName?: string | null;
}

export interface TrafficLogItem {
  id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  eventType: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  createdAt: string;
}

export interface CommLogItem {
  id: string;
  recipientName: string;
  recipientContact: string;
  channel: string;
  category: string;
  deliveryMethod: string | null;
  status: string;
  sentBy: string;
  createdAt: string;
  messageBody: string;
}

interface TeamGovernanceHubProps {
  members: TeamMemberData[];
  projects: ProjectSummary[];
  clients: ClientContact[];
  trafficLogs: TrafficLogItem[];
  commLogs: CommLogItem[];
}

const AVAILABLE_PERMISSIONS = [
  { key: "dashboard", label: "Painel Geral", desc: "Métricas executivas do estúdio" },
  { key: "cronograma", label: "Cronograma & Operação", desc: "Quadro Kanban e avanço físico" },
  { key: "projetos", label: "Projetos & Acervo", desc: "Pranchas e documentos técnicos" },
  { key: "financeiro", label: "Gestão Financeira", desc: "Controle de parcelas e contratos" },
  { key: "clientes", label: "Gestão de Clientes", desc: "Base de contratantes e briefing" },
  { key: "equipe", label: "Equipe & Governança", desc: "Administração de perfis e RBAC" },
];

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: "bg-blue-900/10", text: "text-blue-900", border: "border-blue-900/30" },
  ARQUITETO: { bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-300" },
  ENGENHEIRO: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
  EQUIPE: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-300" },
  CLIENTE: { bg: "bg-slate-100", text: "text-slate-800", border: "border-slate-300" },
  OPERADOR: { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-300" },
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function cleanPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function createGoogleCalendarUrl(title: string, dueDateStr: string, projectName: string): string {
  const date = new Date(dueDateStr);
  if (isNaN(date.getTime())) return "#";
  const startStr = date.toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 8) + "T120000Z";
  const endStr = date.toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 8) + "T130000Z";
  const details = `Etapa executiva do projeto ${projectName} no ArqVértice Flow.`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}`;
}

export function TeamGovernanceHub({
  members,
  projects,
  clients,
  trafficLogs,
  commLogs,
}: TeamGovernanceHubProps) {
  const [mainView, setMainView] = useState<"members" | "dispatcher" | "traffic">("members");
  const [selectedMember, setSelectedMember] = useState<TeamMemberData | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "rbac" | "reminders">("profile");
  const [search, setSearch] = useState("");
  const [isNewProfileModalOpen, setIsNewProfileModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  // Form states do Drawer de Edição
  const [editName, setEditName] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<TeamMemberData["role"]>("EQUIPE");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editCanEdit, setEditCanEdit] = useState(true);
  const [editProjects, setEditProjects] = useState<string[]>([]);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  // Form state de Novo Perfil
  const [newProfile, setNewProfile] = useState<CreateProfileInput>({
    name: "",
    email: "",
    password: "",
    role: "ARQUITETO",
    specialty: "Arquiteto Projetista",
    whatsapp: "",
  });

  // Form state de Disparo de Comunicação Externa
  const [dispatchType, setDispatchType] = useState<"PROFISSIONAL" | "CLIENTE">("PROFISSIONAL");
  const [dispatchRecipientId, setDispatchRecipientId] = useState("");
  const [dispatchChannel, setDispatchChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [dispatchCategory, setDispatchCategory] =
    useState<DispatchCommunicationInput["category"]>("PRAZO_ETAPA");
  const [dispatchSubject, setDispatchSubject] = useState("");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [dispatchProjectId, setDispatchProjectId] = useState("");

  const [trafficUserFilter, setTrafficUserFilter] = useState<string>("ALL");
  const [trafficEventFilter, setTrafficEventFilter] = useState<string>("ALL");

  const openDrawer = (member: TeamMemberData, defaultTab: "profile" | "rbac" | "reminders" = "profile") => {
    setSelectedMember(member);
    setActiveTab(defaultTab);
    setEditName(member.name);
    setEditSpecialty(member.specialty || "");
    setEditEmail(member.email);
    setEditWhatsapp(member.whatsapp || "");
    setEditPassword("");
    setEditRole(member.role);
    setEditIsActive(member.isActive);
    setEditCanEdit(member.canEdit);
    setEditProjects(member.assignedProjectIds);
    setEditPermissions(member.permissions || []);
    setFeedback(null);
  };

  const closeDrawer = () => {
    setSelectedMember(null);
    setFeedback(null);
  };

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.specialty && m.specialty.toLowerCase().includes(q)) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleSaveProfile = () => {
    if (!selectedMember) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        await updateTeamMemberProfileAction({
          userId: selectedMember.id,
          name: editName,
          email: editEmail,
          specialty: editSpecialty,
          whatsapp: editWhatsapp,
          newPassword: editPassword || null,
        });
        setFeedback({ text: "Perfil e credenciais atualizados com sucesso!", ok: true });
        setEditPassword("");
      } catch (err) {
        setFeedback({
          text: err instanceof Error ? err.message : "Erro ao atualizar perfil.",
          ok: false,
        });
      }
    });
  };

  const handleSaveGovernance = () => {
    if (!selectedMember) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        await updateTeamMemberGovernanceAction({
          userId: selectedMember.id,
          role: editRole,
          isActive: editIsActive,
          canEdit: editCanEdit,
          projectIds: editProjects,
          permissions: editPermissions,
        });
        setFeedback({
          text: "Permissões RBAC atualizadas! Sessão do usuário invalidada para aplicação imediata.",
          ok: true,
        });
      } catch (err) {
        setFeedback({
          text: err instanceof Error ? err.message : "Erro ao atualizar governança.",
          ok: false,
        });
      }
    });
  };

  const handleSendWhatsApp = (stage: TeamMemberStage) => {
    if (!selectedMember) return;
    const phone = cleanPhone(selectedMember.whatsapp);
    if (!phone) {
      alert("Este profissional não possui um número de WhatsApp cadastrado.");
      return;
    }

    const dueDateFormatted = formatDateBR(stage.dueDate);
    let message = "";

    if (stage.urgency === "ATRASADO") {
      message = `Olá, ${selectedMember.name}! Aviso de pendência: a etapa "${stage.name}" do projeto ${stage.projectName} ultrapassou o prazo em ${dueDateFormatted}. O avanço registrado está em ${stage.completion}%. Favor atualizar o status no sistema.`;
    } else if (stage.urgency === "HOJE") {
      message = `Atenção, ${selectedMember.name}! A entrega da etapa "${stage.name}" do projeto ${stage.projectName} está programada para HOJE (${dueDateFormatted}). Bom trabalho!`;
    } else {
      message = `Olá, ${selectedMember.name}! Lembramos que a etapa "${stage.name}" do projeto ${stage.projectName} vence em ${dueDateFormatted}. O avanço atual está em ${stage.completion}%.`;
    }

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    startTransition(async () => {
      await recordReminderLogAction({
        stageId: stage.id,
        recipientName: selectedMember.name,
        recipientPhone: selectedMember.whatsapp,
        recipientEmail: selectedMember.email,
        channel: "WHATSAPP",
        triggerType:
          stage.urgency === "ATRASADO"
            ? "ATRASADO"
            : stage.urgency === "HOJE"
            ? "ENTREGA_HOJE"
            : "PRAZO_PROXIMO",
        messageBody: message,
      });
    });
  };

  const handleCreateProfile = () => {
    startTransition(async () => {
      try {
        await createTeamMemberAction(newProfile);
        setIsNewProfileModalOpen(false);
        setNewProfile({
          name: "",
          email: "",
          password: "",
          role: "ARQUITETO",
          specialty: "Arquiteto Projetista",
          whatsapp: "",
        });
        alert("Novo perfil profissional cadastrado com sucesso!");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao criar perfil.");
      }
    });
  };

  const handleExecuteDispatch = () => {
    let recipientName = "";
    let recipientContact = "";

    if (dispatchType === "PROFISSIONAL") {
      const p = members.find((m) => m.id === dispatchRecipientId);
      if (!p) return alert("Selecione um profissional.");
      recipientName = p.name;
      recipientContact = dispatchChannel === "EMAIL" ? p.email : p.whatsapp || "";
    } else {
      const c = clients.find((cl) => cl.id === dispatchRecipientId);
      if (!c) return alert("Selecione um cliente.");
      recipientName = c.name;
      recipientContact = dispatchChannel === "EMAIL" ? c.email || "" : c.phone || "";
    }

    if (!recipientContact) {
      return alert(
        `O destinatário selecionado não possui ${
          dispatchChannel === "EMAIL" ? "e-mail" : "WhatsApp"
        } cadastrado.`
      );
    }

    if (!dispatchMessage.trim()) {
      return alert("Digite o texto da mensagem.");
    }

    const proj = projects.find((p) => p.id === dispatchProjectId);

    startTransition(async () => {
      try {
        const res = await dispatchCommunicationAction({
          recipientType: dispatchType,
          recipientId: dispatchRecipientId,
          recipientName,
          recipientContact,
          projectId: proj?.id || null,
          projectName: proj?.name || null,
          channel: dispatchChannel,
          category: dispatchCategory,
          subject: dispatchSubject || undefined,
          messageBody: dispatchMessage,
        });

        if (res.directLinkUrl) {
          window.open(res.directLinkUrl, "_blank");
        }

        alert(`Mensagem processada via ${res.deliveryMethod}!`);
        setDispatchMessage("");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro no disparo de comunicação.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Topo Executivo & Navegação Principal do Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Workspace por Pessoa
          </span>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            👥 Central de Equipe & Governança
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Gestão individual por profissional: credenciais, permissões RBAC em tempo real, disparador externo e logs de tráfego.
          </p>
        </div>

        {/* Sub-navegação do Hub */}
        <div className="flex items-center gap-1 rounded-2xl bg-slate-200/80 p-1">
          <button
            type="button"
            onClick={() => setMainView("members")}
            className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
              mainView === "members"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            👥 Profissionais ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setMainView("dispatcher")}
            className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
              mainView === "dispatcher"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📡 Disparador Externo
          </button>
          <button
            type="button"
            onClick={() => setMainView("traffic")}
            className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
              mainView === "traffic"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📊 Logs de Tráfego ({trafficLogs.length})
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VISTA 1: CARDS DOS PROFISSIONAIS DA EQUIPE                     */}
      {/* ============================================================== */}
      {mainView === "members" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Buscar por nome, cargo ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[44px] w-72 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setIsNewProfileModalOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition"
            >
              <span>+</span> Novo Perfil
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => {
              const initials = getInitials(member.name);
              const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS.CLIENTE;
              const activeStages = member.stages.filter((s) => s.completion < 100);
              const overdueStages = member.stages.filter((s) => s.urgency === "ATRASADO");
              const completedStages = member.stages.filter((s) => s.completion === 100);

              return (
                <Card
                  key={member.id}
                  onClick={() => openDrawer(member)}
                  className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition cursor-pointer active:scale-[0.99]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white font-bold text-sm tracking-wider shadow-xs">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                            {member.name}
                          </h3>
                          <p className="text-xs font-medium text-slate-500 truncate">
                            {member.specialty || "Especialista Técnico"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${roleColor.bg} ${roleColor.text} ${roleColor.border}`}
                      >
                        {member.role}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-slate-400">✉️</span>
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">📱</span>
                        <span>{member.whatsapp || "Sem WhatsApp"}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2.5 text-center text-[11px]">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Ativas</span>
                        <span className="text-sm font-extrabold text-blue-600">{activeStages.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Concluídas</span>
                        <span className="text-sm font-extrabold text-emerald-600">{completedStages.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Atrasadas</span>
                        <span className={`text-sm font-extrabold ${overdueStages.length > 0 ? "text-rose-600" : "text-slate-400"}`}>
                          {overdueStages.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${member.isActive ? "text-emerald-700" : "text-slate-400"}`}>
                      {member.isActive ? "● Conta Ativa" : "○ Inativa"}
                    </span>
                    <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                      Gerenciar Perfil →
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 2: DISPARADOR EXTERNO (RESEND + WHATSAPP BRIDGE)         */}
      {/* ============================================================== */}
      {mainView === "dispatcher" && (
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                📡 Central de Disparos de Comunicação (WhatsApp & E-mail)
              </h2>
              <p className="text-xs text-slate-500">
                Envio real de e-mails via Resend e mensagens de WhatsApp gratuitas para profissionais e clientes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                WhatsApp CLI: Conectado / Link Direto
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                E-mail Resend: Ativo
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Coluna 1: Destinatário & Canal */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Destinatário</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDispatchType("PROFISSIONAL");
                      setDispatchRecipientId("");
                    }}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border transition ${
                      dispatchType === "PROFISSIONAL"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    👷 Profissional
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDispatchType("CLIENTE");
                      setDispatchRecipientId("");
                    }}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border transition ${
                      dispatchType === "CLIENTE"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    🤝 Cliente
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Selecionar Destinatário</label>
                <select
                  value={dispatchRecipientId}
                  onChange={(e) => setDispatchRecipientId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  <option value="">Selecione...</option>
                  {dispatchType === "PROFISSIONAL"
                    ? members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.specialty || m.role})
                        </option>
                      ))
                    : clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.projectName ? `· ${c.projectName}` : ""}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Canal de Envio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchChannel("WHATSAPP")}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border transition ${
                      dispatchChannel === "WHATSAPP"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchChannel("EMAIL")}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border transition ${
                      dispatchChannel === "EMAIL"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    ✉️ E-mail (Resend)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Categoria</label>
                <select
                  value={dispatchCategory}
                  onChange={(e) => setDispatchCategory(e.target.value as any)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  <option value="PRAZO_ETAPA">Lembrete de Prazo de Etapa</option>
                  <option value="RELATORIO_CRONOGRAMA">Envio de Relatório de Cronograma</option>
                  <option value="FINANCEIRO">Aviso Financeiro / Parcela</option>
                  <option value="ACESSO_SISTEMA">Credenciais / Acesso ao Sistema</option>
                  <option value="AVISO_GERAL">Aviso Geral do Estúdio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Projeto Relacionado</label>
                <select
                  value={dispatchProjectId}
                  onChange={(e) => setDispatchProjectId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  <option value="">Nenhum / Geral</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Coluna 2: Mensagem e Disparo */}
            <div className="space-y-4 md:col-span-2">
              {dispatchChannel === "EMAIL" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assunto do E-mail</label>
                  <input
                    type="text"
                    value={dispatchSubject}
                    onChange={(e) => setDispatchSubject(e.target.value)}
                    placeholder="Ex: Atualização do Cronograma — ArqVértice Flow"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900"
                  />
                </div>
              )}

              {/* Templates Editáveis de 1 Clique */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Templates Oficiais de 1 Clique:
                </label>
                <div className="flex flex-wrap gap-2">
                  {dispatchType === "PROFISSIONAL" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const target = members.find((m) => m.id === dispatchRecipientId);
                          const name = target ? target.name.split(" ")[0] : "[Nome]";
                          const proj = projects.find((p) => p.id === dispatchProjectId);
                          const projName = proj ? proj.name : "[Projeto]";
                          setDispatchSubject(`Lembrete de Prazo — ${projName}`);
                          setDispatchMessage(
                            `Olá, ${name}! Lembrete técnico do ArqVértice Flow: a etapa [Etapa] do projeto ${projName} tem entrega prevista para [Data] (avanço atual: 50%). Por favor, revise os prazos.`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition"
                      >
                        ⚡ Prazo de Etapa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = members.find((m) => m.id === dispatchRecipientId);
                          const name = target ? target.name.split(" ")[0] : "[Nome]";
                          const proj = projects.find((p) => p.id === dispatchProjectId);
                          const projName = proj ? proj.name : "[Projeto]";
                          setDispatchSubject(`⚠️ Alerta de Atraso — ${projName}`);
                          setDispatchMessage(
                            `Atenção, ${name}: a etapa [Etapa] (${projName}) ultrapassou o prazo de [Data]. Por favor, atualize o status no Kanban e no sistema.`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-800 transition"
                      >
                        ⚠️ Etapa em Atraso
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = members.find((m) => m.id === dispatchRecipientId);
                          const name = target ? target.name.split(" ")[0] : "[Nome]";
                          setDispatchSubject(`Acesso Atualizado — ArqVértice Flow`);
                          setDispatchMessage(
                            `Olá, ${name}! Suas permissões de acesso no ArqVértice Flow foram atualizadas pelo Administrador. Acesse: https://arqvertice-flow.vercel.app/login`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition"
                      >
                        🔑 Credenciais & Acesso
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const target = clients.find((c) => c.id === dispatchRecipientId);
                          const name = target ? target.name.split(" ")[0] : "[Cliente]";
                          const proj = projects.find((p) => p.id === dispatchProjectId);
                          const projName = proj ? proj.name : target?.projectName || "[Projeto]";
                          setDispatchSubject(`Relatório Oficial do Cronograma — ${projName}`);
                          setDispatchMessage(
                            `Olá, ${name}! O Relatório Oficial atualizado do cronograma do projeto ${projName} já está disponível para consulta técnica. Avanço global atual: 75%.`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition"
                      >
                        📄 Relatório de Cronograma
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = clients.find((c) => c.id === dispatchRecipientId);
                          const name = target ? target.name.split(" ")[0] : "[Cliente]";
                          const proj = projects.find((p) => p.id === dispatchProjectId);
                          const projName = proj ? proj.name : target?.projectName || "[Projeto]";
                          setDispatchSubject(`Novas Pranchas Liberadas — ${projName}`);
                          setDispatchMessage(
                            `Olá, ${name}! Novas pranchas técnicas da disciplina de Arquitetura/Estrutural foram homologadas e liberadas no portal do projeto ${projName}.`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition"
                      >
                        📐 Liberação de Pranchas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = clients.find((c) => c.id === dispatchRecipientId);
                          const name = target ? target.name.split(" ")[0] : "[Cliente]";
                          setDispatchSubject(`Lembrete de Parcela Contratual — ArqVértice`);
                          setDispatchMessage(
                            `Olá, ${name}! Lembramos que a parcela [Parcela] referente a [Descrição] no valor de [Valor] vence em [Data]. O comprovante pode ser anexado diretamente no portal.`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-800 transition"
                      >
                        💰 Parcela Contratual
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Corpo da Mensagem</label>
                <textarea
                  rows={8}
                  value={dispatchMessage}
                  onChange={(e) => setDispatchMessage(e.target.value)}
                  placeholder="Escreva a mensagem oficial que será entregue..."
                  className="w-full rounded-2xl border border-slate-300 p-3.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  {dispatchChannel === "WHATSAPP"
                    ? "Bridge local gratuito (Baileys) com fallback wa.me."
                    : "Envio transacional com template oficial via Resend API."}
                </span>

                <button
                  type="button"
                  disabled={isPending || !dispatchRecipientId || !dispatchMessage.trim()}
                  onClick={handleExecuteDispatch}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-950 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition disabled:opacity-50"
                >
                  <span>🚀</span>
                  <span>{isPending ? "Disparando..." : "Executar Disparo Oficial"}</span>
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* VISTA 3: LOGS DE TRÁFEGO & AUDITORIA DE ACESSOS                */}
      {/* ============================================================== */}
      {mainView === "traffic" && (
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                📊 Auditoria de Tráfego: Logins, Logouts e Sessões
              </h2>
              <p className="text-xs text-slate-500">
                Registro detalhado de entrada e saída por IP, dispositivo e horário no fuso America/Fortaleza.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={trafficUserFilter}
                onChange={(e) => setTrafficUserFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Todos os Usuários</option>
                {Array.from(new Set(trafficLogs.map((l) => l.userName))).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={trafficEventFilter}
                onChange={(e) => setTrafficEventFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">Todos os Eventos</option>
                <option value="LOGIN">LOGIN (Entrada)</option>
                <option value="LOGOUT">LOGOUT (Saída Manual)</option>
                <option value="FORCED_LOGOUT">FORCED_LOGOUT (Expulsão/RBAC)</option>
                <option value="SESSION_EXPIRED">SESSION_EXPIRED (Expirada)</option>
              </select>

              <span className="text-xs font-bold text-slate-500 shrink-0">
                Total: {trafficLogs.length}
              </span>
            </div>
          </div>

          {trafficLogs.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">
              Nenhum evento de acesso registrado recentemente.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pl-3 pr-2">Horário (pt-BR)</th>
                    <th className="py-2.5 px-2">Usuário</th>
                    <th className="py-2.5 px-2">E-mail</th>
                    <th className="py-2.5 px-2">Papel</th>
                    <th className="py-2.5 px-2">Evento</th>
                    <th className="py-2.5 px-2">IP</th>
                    <th className="py-2.5 pr-3">Dispositivo / Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {trafficLogs
                    .filter((log) => {
                      if (trafficUserFilter !== "ALL" && log.userName !== trafficUserFilter) return false;
                      if (trafficEventFilter !== "ALL" && log.eventType !== trafficEventFilter) return false;
                      return true;
                    })
                    .map((log) => {
                    const isForced = log.eventType === "FORCED_LOGOUT";
                    const isLogin = log.eventType === "LOGIN";

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] text-slate-600">
                          {log.createdAt}
                        </td>
                        <td className="py-2.5 px-2 font-bold text-slate-900">{log.userName}</td>
                        <td className="py-2.5 px-2 text-slate-600">{log.userEmail}</td>
                        <td className="py-2.5 px-2 font-mono text-[10px]">{log.userRole}</td>
                        <td className="py-2.5 px-2">
                          <Badge tone={isLogin ? "green" : isForced ? "red" : "neutral"}>
                            {log.eventType}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600">
                          {log.ipAddress || "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600 text-[11px]">
                          {log.deviceInfo || "Web"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ============================================================== */}
      {/* DRAWER / MODAL DE GESTÃO DETALHADA POR PESSOA                  */}
      {/* ============================================================== */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white font-bold text-sm">
                  {getInitials(selectedMember.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedMember.name}</h2>
                  <p className="text-xs text-slate-500">
                    {selectedMember.specialty || selectedMember.role} · {selectedMember.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 active:scale-95 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b border-slate-200 bg-white px-6">
              {[
                { key: "profile" as const, label: "1. Perfil & Credenciais", icon: "👤" },
                { key: "rbac" as const, label: "2. Controle de Acesso (RBAC) & Projetos", icon: "🛡️" },
                {
                  key: "reminders" as const,
                  label: "3. Lembretes, Agenda & Disparos",
                  icon: "🔔",
                  badge: selectedMember.stages.length,
                },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      setFeedback(null);
                    }}
                    className={`flex min-h-[44px] items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold active:scale-[0.98] transition select-none ${
                      active
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div
                className={`mx-6 mt-4 rounded-xl p-3 text-xs font-semibold ${
                  feedback.ok
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {feedback.text}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ABA 1: PERFIL & CREDENCIAIS */}
              {activeTab === "profile" && (
                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cargo Técnico / Especialidade</label>
                    <input
                      type="text"
                      value={editSpecialty}
                      onChange={(e) => setEditSpecialty(e.target.value)}
                      placeholder="Ex: Arquiteto Projetista, Engenheiro Calculista"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo *</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Oficial</label>
                    <input
                      type="text"
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      placeholder="Ex: 85 98590 2642"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Redefinir Senha de Acesso
                    </label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Preencha apenas se desejar alterar (mín. 8 caracteres)"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Alterar a senha invalidará a sessão atual imediatamente via SessionGuard.
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleSaveProfile}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {isPending ? "Salvando..." : "Salvar Alterações de Perfil"}
                    </button>
                  </div>
                </div>
              )}

              {/* ABA 2: GOVERNANÇA (RBAC) & PERMISSÕES GRANULARES */}
              {activeTab === "rbac" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nível de Permissão (Role RBAC)
                      </label>
                      <select
                        value={editRole}
                        onChange={(e) => {
                          const newRole = e.target.value as TeamMemberData["role"];
                          setEditRole(newRole);
                          const preset = ROLE_PERMISSION_PRESETS[newRole];
                          if (preset) {
                            setEditPermissions(preset);
                          }
                        }}
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="ADMIN">ADMIN (Acesso irrestrito a tudo)</option>
                        <option value="ARQUITETO">ARQUITETO (Projetos e acervo)</option>
                        <option value="ENGENHEIRO">ENGENHEIRO (Cálculos e ARTs)</option>
                        <option value="EQUIPE">EQUIPE (Operação técnica)</option>
                        <option value="CLIENTE">CLIENTE (Portal exclusivo)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-center gap-2 pt-2 sm:pt-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Conta Ativa no Sistema</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editCanEdit}
                          onChange={(e) => setEditCanEdit(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Pode Editar Cronogramas & Fases (canEdit)</span>
                      </label>
                    </div>
                  </div>

                  {/* Permissões Granulares por Módulo */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-900">
                        Permissões Granulares de Acesso por Módulo:
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditPermissions(
                            editPermissions.length === AVAILABLE_PERMISSIONS.length
                              ? []
                              : AVAILABLE_PERMISSIONS.map((p) => p.key)
                          )
                        }
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        {editPermissions.length === AVAILABLE_PERMISSIONS.length
                          ? "Desmarcar Todos"
                          : "Marcar Todos"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {AVAILABLE_PERMISSIONS.map((perm) => {
                        const checked = editPermissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 rounded-2xl border p-3 cursor-pointer transition ${
                              checked
                                ? "border-blue-500 bg-blue-50/60 text-slate-900"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditPermissions([...editPermissions, perm.key]);
                                } else {
                                  setEditPermissions(editPermissions.filter((k) => k !== perm.key));
                                }
                              }}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <p className="text-xs font-bold">{perm.label}</p>
                              <p className="text-[10px] text-slate-500 leading-tight">{perm.desc}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Projetos Atribuídos */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-900 mb-2">
                      Projetos com Acesso Habilitado:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {projects.map((proj) => {
                        const checked = editProjects.includes(proj.id);
                        return (
                          <label
                            key={proj.id}
                            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition ${
                              checked
                                ? "border-blue-300 bg-blue-50/50 text-slate-900"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditProjects([...editProjects, proj.id]);
                                } else {
                                  setEditProjects(editProjects.filter((id) => id !== proj.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="min-w-0">
                              <p className="font-bold truncate">{proj.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">Cliente: {proj.clientName}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleSaveGovernance}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {isPending ? "Salvando..." : "Salvar Permissões de Governança (Forçar Logout)"}
                    </button>
                  </div>
                </div>
              )}

              {/* ABA 3: LEMBRETES, AGENDA & DISPAROS */}
              {activeTab === "reminders" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Etapas Vinculadas a este Profissional ({selectedMember.stages.length})
                    </h3>

                    {selectedMember.stages.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                        Nenhuma etapa do cronograma atribuída diretamente a {selectedMember.name}.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="py-2.5 pl-3 pr-2">Etapa</th>
                              <th className="py-2.5 px-2">Empreendimento</th>
                              <th className="py-2.5 px-2">Prazo</th>
                              <th className="py-2.5 px-2">Avanço</th>
                              <th className="py-2.5 px-2">Urgência</th>
                              <th className="py-2.5 pr-3 text-right">Disparo & Agenda</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedMember.stages.map((stage) => {
                              const calendarUrl = stage.dueDate
                                ? createGoogleCalendarUrl(
                                    `Entrega: ${stage.name}`,
                                    String(stage.dueDate),
                                    stage.projectName
                                  )
                                : "#";

                              return (
                                <tr key={stage.id} className="hover:bg-slate-50/60 transition">
                                  <td className="py-2.5 pl-3 pr-2 font-bold text-slate-900">{stage.name}</td>
                                  <td className="py-2.5 px-2 text-slate-600">{stage.projectName}</td>
                                  <td className="py-2.5 px-2 font-mono text-[11px] text-slate-700">
                                    {formatDateBR(stage.dueDate)}
                                  </td>
                                  <td className="py-2.5 px-2 font-bold text-slate-800">{stage.completion}%</td>
                                  <td className="py-2.5 px-2">
                                    <Badge
                                      tone={
                                        stage.urgency === "ATRASADO"
                                          ? "red"
                                          : stage.urgency === "HOJE"
                                          ? "amber"
                                          : stage.urgency === "PROXIMO"
                                          ? "blue"
                                          : "neutral"
                                      }
                                    >
                                      {stage.urgency === "ATRASADO"
                                        ? "Atrasado"
                                        : stage.urgency === "HOJE"
                                        ? "Entrega Hoje"
                                        : stage.urgency === "PROXIMO"
                                        ? "A Vencer (≤3d)"
                                        : "No Prazo"}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 pr-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleSendWhatsApp(stage)}
                                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 transition"
                                        title="Enviar mensagem pelo WhatsApp"
                                      >
                                        <span>💬</span> WhatsApp
                                      </button>

                                      {calendarUrl !== "#" && (
                                        <a
                                          href={calendarUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                                          title="Adicionar evento à agenda"
                                        >
                                          <span>📅</span> Agenda
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE NOVO PERFIL */}
      {isNewProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">+ Cadastrar Novo Perfil</h3>
                <p className="text-xs text-slate-500">Adicione um novo arquiteto, engenheiro ou membro da equipe.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewProfileModalOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                  placeholder="Ex: Wagner Silva"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cargo Técnico / Especialidade *</label>
                <input
                  type="text"
                  value={newProfile.specialty}
                  onChange={(e) => setNewProfile({ ...newProfile, specialty: e.target.value })}
                  placeholder="Ex: Engenheiro Projetista"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={newProfile.email}
                    onChange={(e) => setNewProfile({ ...newProfile, email: e.target.value })}
                    placeholder="email@arqvertice.com.br"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp *</label>
                  <input
                    type="text"
                    value={newProfile.whatsapp}
                    onChange={(e) => setNewProfile({ ...newProfile, whatsapp: e.target.value })}
                    placeholder="85 9866-4738"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Papel RBAC *</label>
                  <select
                    value={newProfile.role}
                    onChange={(e) =>
                      setNewProfile({ ...newProfile, role: e.target.value as CreateProfileInput["role"] })
                    }
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ARQUITETO">ARQUITETO</option>
                    <option value="ENGENHEIRO">ENGENHEIRO</option>
                    <option value="EQUIPE">EQUIPE</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Senha Provisória *</label>
                  <input
                    type="password"
                    value={newProfile.password}
                    onChange={(e) => setNewProfile({ ...newProfile, password: e.target.value })}
                    placeholder="Mín. 8 caracteres"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNewProfileModalOpen(false)}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending || !newProfile.name || !newProfile.email || !newProfile.password}
                onClick={handleCreateProfile}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50"
              >
                {isPending ? "Cadastrando..." : "Cadastrar Perfil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
