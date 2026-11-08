"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setOperatorProjectAccessAction, updateUserRoleAndStatusAction } from "@/app/actions/domain-actions";

type UserRoleType = "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR";

type ProjectOption = { id: string; name: string; clientName: string };

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrador (Acesso Total)", tone: "blue" },
  { value: "ARQUITETO", label: "Arquiteto (Projetos & Layouts)", tone: "indigo" },
  { value: "ENGENHEIRO", label: "Engenheiro (Estrutura & Instalações)", tone: "amber" },
  { value: "EQUIPE", label: "Equipe Técnica (Operador)", tone: "emerald" },
  { value: "CLIENTE", label: "Cliente (Visualização de Acervo)", tone: "neutral" },
] as const;

export function OperatorAccessManager({
  operatorId,
  operatorName,
  operatorEmail,
  initialRole = "EQUIPE",
  initialIsActive = true,
  assignedProjectIds,
  initialCanEdit = false,
  projects,
}: {
  operatorId: string;
  operatorName: string;
  operatorEmail: string;
  initialRole?: string;
  initialIsActive?: boolean;
  assignedProjectIds: string[];
  initialCanEdit?: boolean;
  projects: ProjectOption[];
}) {
  const [selected, setSelected] = useState<string[]>(assignedProjectIds);
  const [role, setRole] = useState<UserRoleType>(
    (initialRole === "OPERADOR" ? "EQUIPE" : initialRole) as UserRoleType,
  );
  const [isActive, setIsActive] = useState(initialIsActive);
  const [canEdit, setCanEdit] = useState(initialCanEdit);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(projectId: string) {
    setSaved(false);
    setError(null);
    setSelected((current) =>
      current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId],
    );
  }

  function save() {
    startTransition(async () => {
      try {
        setError(null);
        await Promise.all([
          setOperatorProjectAccessAction(operatorId, selected, canEdit),
          updateUserRoleAndStatusAction(
            operatorId,
            role,
            isActive,
          ),
        ]);
        setSaved(true);
      } catch (cause) {
        setSaved(false);
        setError(cause instanceof Error ? cause.message : "Não foi possível guardar as configurações de acesso.");
      }
    });
  }

  const dirty =
    selected.length !== assignedProjectIds.length ||
    selected.some((id) => !assignedProjectIds.includes(id)) ||
    role !== initialRole ||
    isActive !== initialIsActive ||
    canEdit !== initialCanEdit;

  return (
    <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">{operatorName}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}
            >
              {isActive ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{operatorEmail}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Papel RBAC */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Papel:</span>
            <select
              aria-label={`Papel de acesso de ${operatorName}`}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as UserRoleType);
                setSaved(false);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs focus:border-blue-500 focus:outline-none"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Switch de Ativação */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                setSaved(false);
              }}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>Conta Habilitada</span>
          </label>
        </div>
      </div>

      {/* Privilégios Técnicos e Permissões */}
      <div className="mt-4 rounded-2xl bg-slate-50/70 p-4 border border-slate-100">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={canEdit}
            onChange={(e) => {
              setCanEdit(e.target.checked);
              setSaved(false);
            }}
            className="rounded text-blue-600 focus:ring-0 h-4 w-4"
          />
          <div>
            <span className="font-bold text-slate-900">Permissão de Edição e Upload de Pranchas (canEdit)</span>
            <p className="text-[11px] text-slate-500 font-normal">
              Permite cadastrar novas pranchas no acervo, alterar metadados técnicos e atualizar percentuais de cronograma.
            </p>
          </div>
        </label>
      </div>

      {/* Atribuição de Projetos */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Projetos Atribuídos ({selected.length})
          </h4>
          <span className="text-[11px] text-slate-400">
            Marque os empreendimentos visíveis para este perfil
          </span>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">Não há projetos cadastrados para atribuir.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {projects.map((project) => {
              const isChecked = selected.includes(project.id);
              return (
                <label
                  key={project.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-xs transition ${
                    isChecked
                      ? "border-blue-500 bg-blue-50/50 text-blue-900 font-semibold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-0"
                    checked={isChecked}
                    onChange={() => toggle(project.id)}
                  />
                  <div className="truncate">
                    <p className="truncate leading-tight">{project.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">Cliente: {project.clientName}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-xl px-4 py-2 text-xs font-bold"
          >
            {pending ? "Salvando…" : "Salvar privilégios e acessos"}
          </Button>
          {saved && !dirty && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              ✓ Alterações salvas com sucesso
            </span>
          )}
        </div>
        {error && <span className="text-xs font-semibold text-rose-600">{error}</span>}
      </div>
    </Card>
  );
}
