"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CorporateUserMember } from "@/server/services/gestao-service";
import type { MasterDiscipline, MasterPhase, MasterRole } from "@/lib/master-data";
import { updateCorporateUserPermissionsAction } from "@/server/actions/gestao";

interface GestaoEnterprisePanelProps {
  initialMembers: CorporateUserMember[];
  projects: Array<{ id: string; name: string; clientName: string }>;
  disciplines: MasterDiscipline[];
  phases: MasterPhase[];
  roles: MasterRole[];
}

export function GestaoEnterprisePanel({
  initialMembers,
  projects,
  disciplines,
  phases,
  roles,
}: GestaoEnterprisePanelProps) {
  const [activeTab, setActiveTab] = useState<"equipe" | "cadastros">("equipe");
  const [members, setMembers] = useState<CorporateUserMember[]>(initialMembers);
  const [expandedProjectsUser, setExpandedProjectsUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Manipulação Otimista: Papel (Role)
  const handleRoleChange = (userId: string, newRole: CorporateUserMember["role"]) => {
    // 1. Atualização Otimista Imediata (0ms)
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m)),
    );
    setStatusMessage("Atualizando permissões...");

    startTransition(async () => {
      try {
        await updateCorporateUserPermissionsAction(userId, { role: newRole });
        setStatusMessage("✓ Papel atualizado com sucesso");
        setTimeout(() => setStatusMessage(null), 2500);
      } catch (err) {
        // Reverte se houver erro
        setMembers(initialMembers);
        setStatusMessage("Falha ao salvar papel.");
      }
    });
  };

  // Manipulação Otimista: canEdit
  const handleCanEditToggle = (userId: string, currentCanEdit: boolean) => {
    const nextVal = !currentCanEdit;
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, canEdit: nextVal } : m)),
    );
    setStatusMessage("Atualizando privilégio canEdit...");

    startTransition(async () => {
      try {
        await updateCorporateUserPermissionsAction(userId, { canEdit: nextVal });
        setStatusMessage("✓ Privilégio de edição atualizado");
        setTimeout(() => setStatusMessage(null), 2500);
      } catch {
        setMembers(initialMembers);
        setStatusMessage("Falha ao atualizar privilégio.");
      }
    });
  };

  // Manipulação Otimista: isActive
  const handleActiveToggle = (userId: string, currentActive: boolean) => {
    const nextVal = !currentActive;
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, isActive: nextVal } : m)),
    );
    setStatusMessage("Atualizando status da conta...");

    startTransition(async () => {
      try {
        await updateCorporateUserPermissionsAction(userId, { isActive: nextVal });
        setStatusMessage("✓ Status da conta atualizado");
        setTimeout(() => setStatusMessage(null), 2500);
      } catch {
        setMembers(initialMembers);
        setStatusMessage("Falha ao atualizar status.");
      }
    });
  };

  // Manipulação Otimista: Vinculação de Projetos
  const handleProjectToggle = (userId: string, projectId: string) => {
    const member = members.find((m) => m.id === userId);
    if (!member) return;

    const currentAssigned = member.assignedProjectIds;
    const nextAssigned = currentAssigned.includes(projectId)
      ? currentAssigned.filter((id) => id !== projectId)
      : [...currentAssigned, projectId];

    setMembers((prev) =>
      prev.map((m) =>
        m.id === userId ? { ...m, assignedProjectIds: nextAssigned } : m,
      ),
    );

    startTransition(async () => {
      try {
        await updateCorporateUserPermissionsAction(userId, {
          projectIds: nextAssigned,
          canEdit: member.canEdit,
        });
        setStatusMessage("✓ Projetos vinculados com sucesso");
        setTimeout(() => setStatusMessage(null), 2500);
      } catch {
        setMembers(initialMembers);
        setStatusMessage("Falha ao salvar projetos.");
      }
    });
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.designation.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header Corporativo LDS + Linear */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Painel Corporativo
              </span>
              <span className="text-xs font-semibold text-zinc-400">
                /admin/gestao
              </span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-900">
              Governança Corporativa & Cadastros Mestres
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              Gerenciador centralizado de controle de acesso (RBAC), privilégios técnicos (canEdit) e matriz oficial de disciplinas e fases normativas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 animate-in fade-in">
                {statusMessage}
              </span>
            )}
            <div className="flex rounded-2xl bg-zinc-100 p-1 border border-zinc-200">
              <button
                type="button"
                onClick={() => setActiveTab("equipe")}
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                  activeTab === "equipe"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                👥 Permissões & Equipe ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("cadastros")}
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                  activeTab === "cadastros"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                🏛️ Cadastros Mestres (SSOT)
              </button>
            </div>
          </div>
        </div>

        {/* Resumo Métrico em Linha (Padrão LDS Record Summary) */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-zinc-50/80 p-3 border border-zinc-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Profissionais & Clientes</span>
            <p className="text-lg font-bold text-zinc-900 mt-0.5">{members.length}</p>
          </div>
          <div className="rounded-2xl bg-zinc-50/80 p-3 border border-zinc-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Projetos Ativos</span>
            <p className="text-lg font-bold text-blue-600 mt-0.5">{projects.length}</p>
          </div>
          <div className="rounded-2xl bg-zinc-50/80 p-3 border border-zinc-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Disciplinas Padrão</span>
            <p className="text-lg font-bold text-indigo-600 mt-0.5">{disciplines.length}</p>
          </div>
          <div className="rounded-2xl bg-zinc-50/80 p-3 border border-zinc-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Fases Normativas</span>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">{phases.length}</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: GERENCIADOR DE PERMISSÕES E EQUIPE                                 */}
      {/* ========================================================================= */}
      {activeTab === "equipe" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Gerenciador de Permissões & Perfis Corporativos
              </h2>
              <p className="text-xs text-zinc-500">
                Controle de papéis, privilégio técnico <code className="font-mono text-[11px] bg-zinc-100 px-1 py-0.5 rounded">canEdit</code> e vinculação aos empreendimentos.
              </p>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Filtrar por nome, papel ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const roleMeta = roles.find((r) => r.role === member.role) || roles[3];
              const isExpanded = expandedProjectsUser === member.id;

              return (
                <Card
                  key={member.id}
                  className={`rounded-3xl border transition-all duration-200 p-5 ${
                    member.isActive
                      ? "border-zinc-200/90 bg-white shadow-2xs hover:border-zinc-300"
                      : "border-zinc-200/60 bg-zinc-50/70 opacity-75"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Identificação do Usuário */}
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white shadow-xs">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-zinc-900 text-sm">{member.name}</h3>
                          {/* Badge Semântica do Perfil */}
                          <Badge
                            tone={
                              member.role === "ADMIN"
                                ? "blue"
                                : member.role === "ENGENHEIRO"
                                ? "amber"
                                : member.role === "ARQUITETO"
                                ? "blue"
                                : member.role === "EQUIPE"
                                ? "green"
                                : "neutral"
                            }
                          >
                            {roleMeta.label}
                          </Badge>
                          <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                            {member.designation}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mt-1">
                          <span>{member.email}</span>
                          {member.phone && <span>· {member.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Controles de Permissão Inline */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Seletor de Papel RBAC */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Papel:</span>
                        <select
                          aria-label={`Papel de ${member.name}`}
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as CorporateUserMember["role"])
                          }
                          className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs focus:border-blue-500 focus:outline-none"
                        >
                          {roles.map((r) => (
                            <option key={r.role} value={r.role}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Toggle Instantâneo: canEdit */}
                      <button
                        type="button"
                        onClick={() => handleCanEditToggle(member.id, member.canEdit)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 border ${
                          member.canEdit
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-zinc-100 border-zinc-200 text-zinc-500"
                        }`}
                        title="Permissão para criar, editar pranchas e atualizar dados técnicos"
                      >
                        <span>{member.canEdit ? "✓ Edição Liberada" : "🔒 Somente Leitura"}</span>
                      </button>

                      {/* Toggle Instantâneo: isActive */}
                      <button
                        type="button"
                        onClick={() => handleActiveToggle(member.id, member.isActive)}
                        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition active:scale-95 border ${
                          member.isActive
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : "bg-rose-50 border-rose-200 text-rose-700"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${member.isActive ? "bg-blue-600" : "bg-rose-600"}`} />
                        <span>{member.isActive ? "Conta Ativa" : "Inativa"}</span>
                      </button>

                      {/* Botão de Projetos Vinculados */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProjectsUser(isExpanded ? null : member.id)
                        }
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition shadow-2xs"
                      >
                        📁 {member.assignedProjectIds.length} Projetos {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>

                  {/* Painel Expansível de Vínculo de Projetos */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-zinc-100 pt-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Vincular Empreendimentos para {member.name}:
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {member.assignedProjectIds.length} de {projects.length} selecionados
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {projects.map((proj) => {
                          const isAssigned = member.assignedProjectIds.includes(proj.id);
                          return (
                            <label
                              key={proj.id}
                              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-xs transition ${
                                isAssigned
                                  ? "border-blue-500 bg-blue-50/60 font-bold text-blue-950"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => handleProjectToggle(member.id, proj.id)}
                                className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-0"
                              />
                              <div className="truncate">
                                <p className="truncate leading-tight">{proj.name}</p>
                                <p className="text-[10px] text-zinc-400 truncate">
                                  {proj.clientName}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CENTRAL DE CADASTROS MESTRES (Single Source of Truth)              */}
      {/* ========================================================================= */}
      {activeTab === "cadastros" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Alerta de SSOT */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3">
            <span className="text-base shrink-0">🏛️</span>
            <div>
              <p className="font-bold">Single Source of Truth (SSOT) Ativo</p>
              <p className="mt-0.5 text-blue-700 leading-relaxed">
                As configurações abaixo estão centralizadas em <code className="font-mono text-[11px] bg-white/80 px-1 py-0.5 rounded border border-blue-200">src/lib/master-data.ts</code> e alimentam dinamicamente todos os seletores de disciplinas, subpastas do acervo, filtros do Kanban e parâmetros de relatórios de todo o ecossistema ArqVértice.
              </p>
            </div>
          </div>

          {/* 1. DISCIPLINAS PADRÃO DO ESTÚDIO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  1. Disciplinas Padrão Homologadas
                </h3>
                <p className="text-xs text-zinc-500">
                  Disciplinas integradas para pranchas, memoriais técnicos e avanço de cronograma
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-zinc-600">
                {disciplines.length} Disciplinas
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {disciplines.map((d) => (
                <Card key={d.key} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{d.icon}</span>
                    <Badge tone={d.badgeTone}>{d.shortName}</Badge>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-zinc-900">{d.name}</h4>
                  <div className="mt-2 space-y-1 text-xs">
                    <p className="text-zinc-500">
                      <span className="font-semibold text-zinc-700">Responsável:</span> {d.lead}
                    </p>
                    <p className="text-zinc-500">
                      <span className="font-semibold text-zinc-700">Software:</span> {d.tool}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* 2. FASES NORMATIVAS PADRONIZADAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  2. Fases Normativas Oficiais do Acervo
                </h3>
                <p className="text-xs text-zinc-500">
                  Estrutura hierárquica das subpastas normativas de projetos
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-zinc-600">
                3 Fases Oficiais
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {phases.map((p) => (
                <Card key={p.key} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{p.icon}</span>
                      <span className="font-mono text-[10px] font-bold text-zinc-400">
                        Fase 0{p.order}
                      </span>
                    </div>
                    <Badge tone={p.badgeTone}>{p.key}</Badge>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-zinc-900">{p.label}</h4>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{p.description}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* 3. MATRIZ DE PAPÉIS CORPORATIVOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  3. Matriz de Perfis e Responsabilidades (RBAC)
                </h3>
                <p className="text-xs text-zinc-500">
                  Estrutura de privilégios de acesso do escritório
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="py-2.5 px-4 font-mono">Papel</th>
                    <th className="py-2.5 px-3">Profissional de Referência</th>
                    <th className="py-2.5 px-3">Designação</th>
                    <th className="py-2.5 px-4">Escopo de Atuação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {roles.map((r) => (
                    <tr key={r.role} className="hover:bg-zinc-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                        <Badge tone={r.badgeTone}>{r.role}</Badge>
                      </td>
                      <td className="py-3 px-3 font-bold text-zinc-800">{r.referencePerson}</td>
                      <td className="py-3 px-3 font-semibold text-zinc-600">{r.designation}</td>
                      <td className="py-3 px-4 text-zinc-500">{r.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
