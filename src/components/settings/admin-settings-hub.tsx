"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InfrastructureHealthDTO, StudioSettingDTO } from "@/server/services/settings-service";

interface AdminProfileDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  professionalReg: string;
}

interface AdminSettingsHubProps {
  initialSettings: StudioSettingDTO;
  initialProfile: AdminProfileDTO;
  initialHealth: InfrastructureHealthDTO;
}

type TabId = "profile" | "institutional" | "commercial" | "governance";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "profile", label: "Perfil & Segurança", icon: "👤" },
  { id: "institutional", label: "Estúdio & Faturamento", icon: "🏛️" },
  { id: "commercial", label: "Comercial & Cronograma", icon: "📐" },
  { id: "governance", label: "Governança, LGPD & Infra", icon: "🛡️" },
];

export function AdminSettingsHub({
  initialSettings,
  initialProfile,
  initialHealth,
}: AdminSettingsHubProps) {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [settings, setSettings] = useState<StudioSettingDTO>(initialSettings);
  const [profile, setProfile] = useState<AdminProfileDTO>(initialProfile);
  const [health, setHealth] = useState<InfrastructureHealthDTO>(initialHealth);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function postAction(payload: Record<string, unknown>) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error || "Não foi possível salvar as alterações." });
        return null;
      }
      setFeedback({ type: "success", text: data?.message || "Alterações salvas com sucesso." });
      return data;
    } catch {
      setFeedback({ type: "error", text: "Erro de conexão ao comunicar com o servidor." });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const res = await postAction({
      action: "update_profile",
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      professionalReg: profile.professionalReg,
    });
    if (res?.profile) {
      setProfile((prev) => ({
        ...prev,
        ...res.profile,
        phone: res.profile.phone ?? "",
        whatsapp: res.profile.whatsapp ?? "",
        professionalReg: res.profile.professionalReg ?? "",
      }));
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const res = await postAction({
      action: "change_password",
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (res?.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleRevokeOtherSessions() {
    await postAction({ action: "revoke_other_sessions" });
    await refreshHealth();
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await postAction({
      action: "update_settings",
      studioName: settings.studioName,
      technicalLeadName: settings.technicalLeadName,
      technicalLeadReg: settings.technicalLeadReg,
      studioCnpj: settings.studioCnpj,
      pixKey: settings.pixKey,
      pixKeyType: settings.pixKeyType,
      bankInstructions: settings.bankInstructions,
      structuralPartner: settings.structuralPartner,
      commercialAddress: settings.commercialAddress,
      cityState: settings.cityState,
      institutionalEmail: settings.institutionalEmail,
      documentSignature: settings.documentSignature,
      proposalValidityDays: settings.proposalValidityDays,
      lateFeePercent: settings.lateFeePercent,
      lateInterestPercent: settings.lateInterestPercent,
      defaultProposalScope: settings.defaultProposalScope,
      refundPolicyText: settings.refundPolicyText,
      scheduleAlertDays: settings.scheduleAlertDays,
      inactivityTimeoutMin: settings.inactivityTimeoutMin,
      privacyPolicyVersion: settings.privacyPolicyVersion,
    });
    if (res?.settings) {
      setSettings(res.settings);
    }
  }

  async function handleForceLgpd() {
    const res = await postAction({ action: "force_lgpd_reaccept" });
    if (res?.forceLgpdReacceptAt) {
      setSettings((prev) => ({ ...prev, forceLgpdReacceptAt: res.forceLgpdReacceptAt }));
    }
  }

  async function refreshHealth() {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.health) setHealth(data.health);
      }
    } catch {
      // ignora erro de refresh pontual
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Barra de Navegação por Abas — Apple Minimalista */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/90 bg-slate-100/70 p-1.5">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setFeedback(null);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                active
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? "✓ " : "⚠ "}
          {feedback.text}
        </div>
      )}

      {/* SEÇÃO 1: PERFIL DO ADMINISTRADOR & SEGURANÇA */}
      {activeTab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-6">
            <h3 className="text-base font-bold text-slate-950">Perfil do Administrador</h3>
            <p className="mt-1 text-xs text-slate-500">
              Dados pessoais e registro profissional exibidos em documentos e relatórios oficiais.
            </p>
            <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome de Exibição</label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Acesso</label>
                <input
                  type="email"
                  required
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="(82) 99999-9999"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Profissional</label>
                  <input
                    type="text"
                    value={profile.whatsapp}
                    onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })}
                    placeholder="5582999999999"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registro Profissional (CAU / CREA)</label>
                <input
                  type="text"
                  value={profile.professionalReg}
                  onChange={(e) => setProfile({ ...profile, professionalReg: e.target.value })}
                  placeholder="Ex.: CAU A12345-6"
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Salvando..." : "Salvar Perfil"}
              </button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl border border-slate-200/90 bg-white p-6">
              <h3 className="text-base font-bold text-slate-950">Alteração de Senha Segura</h3>
              <p className="mt-1 text-xs text-slate-500">
                Exige senha atual. Ao alterar, a versão de sessão é rotacionada preservando apenas este acesso.
              </p>
              <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Atual</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nova Senha (mín. 8 caracteres)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Atualizando..." : "Atualizar Senha"}
                </button>
              </form>
            </Card>

            <Card className="rounded-3xl border border-amber-200/80 bg-amber-50/40 p-6">
              <h3 className="text-sm font-bold text-slate-950">Encerramento Global de Sessões</h3>
              <p className="mt-1 text-xs text-slate-600">
                Revoga imediatamente todos os tokens de sessão de outros dispositivos conectados com esta conta, mantendo apenas esta sessão atual ativa.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={handleRevokeOtherSessions}
                className="mt-4 h-10 rounded-xl border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
              >
                Encerrar todas as outras sessões ativas
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* SEÇÃO 2: DADOS INSTITUCIONAIS & FATURAMENTO */}
      {activeTab === "institutional" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-6">
          <h3 className="text-base font-bold text-slate-950">Dados Institucionais do Estúdio & Faturamento</h3>
          <p className="mt-1 text-xs text-slate-500">
            Fonte única para propostas comerciais, contratos, recibos e relatórios PDF oficiais.
          </p>
          <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social / Nome Fantasia</label>
                <input
                  type="text"
                  required
                  value={settings.studioName}
                  onChange={(e) => setSettings({ ...settings, studioName: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ do Estúdio</label>
                <input
                  type="text"
                  required
                  value={settings.studioCnpj}
                  onChange={(e) => setSettings({ ...settings, studioCnpj: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Responsável Técnico Principal</label>
                <input
                  type="text"
                  required
                  value={settings.technicalLeadName}
                  onChange={(e) => setSettings({ ...settings, technicalLeadName: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CAU/CREA do Responsável Técnico</label>
                <input
                  type="text"
                  value={settings.technicalLeadReg}
                  onChange={(e) => setSettings({ ...settings, technicalLeadReg: e.target.value })}
                  placeholder="Ex.: CAU A12345-6"
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chave Pix Oficial</label>
                <input
                  type="text"
                  required
                  value={settings.pixKey}
                  onChange={(e) => setSettings({ ...settings, pixKey: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo da Chave Pix</label>
                <select
                  value={settings.pixKeyType}
                  onChange={(e) => setSettings({ ...settings, pixKeyType: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="EVP">Chave Aleatória</option>
                  <option value="TELEFONE">Telefone</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Parceiro Técnico Estrutural Padrão (PJ)</label>
              <input
                type="text"
                value={settings.structuralPartner}
                onChange={(e) => setSettings({ ...settings, structuralPartner: e.target.value })}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Comercial</label>
                <input
                  type="text"
                  value={settings.commercialAddress}
                  onChange={(e) => setSettings({ ...settings, commercialAddress: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade / UF</label>
                <input
                  type="text"
                  value={settings.cityState}
                  onChange={(e) => setSettings({ ...settings, cityState: e.target.value })}
                  placeholder="Ex.: Maceió / AL"
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Institucional</label>
                <input
                  type="email"
                  value={settings.institutionalEmail}
                  onChange={(e) => setSettings({ ...settings, institutionalEmail: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assinatura Padrão de Documentos</label>
                <input
                  type="text"
                  value={settings.documentSignature}
                  onChange={(e) => setSettings({ ...settings, documentSignature: e.target.value })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dados Bancários & Instruções de Pagamento</label>
              <textarea
                rows={3}
                value={settings.bankInstructions}
                onChange={(e) => setSettings({ ...settings, bankInstructions: e.target.value })}
                placeholder="Banco, Agência, Conta Corrente e instruções para envio de comprovante..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Salvando..." : "Salvar Dados Institucionais"}
            </button>
          </form>
        </Card>
      )}

      {/* SEÇÃO 3: PARÂMETROS COMERCIAIS, PROPOSTAS & CRONOGRAMA */}
      {activeTab === "commercial" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-6">
          <h3 className="text-base font-bold text-slate-950">Parâmetros Comerciais, Propostas & Cronograma</h3>
          <p className="mt-1 text-xs text-slate-500">
            Regras padrão aplicadas em novas propostas comerciais, parcelas financeiras e alertas de cronograma.
          </p>
          <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Validade da Proposta (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.proposalValidityDays}
                  onChange={(e) => setSettings({ ...settings, proposalValidityDays: Number(e.target.value) })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Multa por Atraso (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={20}
                  value={settings.lateFeePercent}
                  onChange={(e) => setSettings({ ...settings, lateFeePercent: Number(e.target.value) })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Juros ao Mês (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={10}
                  value={settings.lateInterestPercent}
                  onChange={(e) => setSettings({ ...settings, lateInterestPercent: Number(e.target.value) })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Antecedência de Alertas (dias)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={settings.scheduleAlertDays}
                  onChange={(e) => setSettings({ ...settings, scheduleAlertDays: Number(e.target.value) })}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Texto Padrão de Escopo & Observações Contratuais
              </label>
              <textarea
                rows={4}
                value={settings.defaultProposalScope}
                onChange={(e) => setSettings({ ...settings, defaultProposalScope: e.target.value })}
                placeholder="Template inicial carregado automaticamente nas novas propostas..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Política de Reembolso & Cancelamento
              </label>
              <textarea
                rows={3}
                value={settings.refundPolicyText}
                onChange={(e) => setSettings({ ...settings, refundPolicyText: e.target.value })}
                placeholder="Cláusula padrão de reembolso e rescisão contratual..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Salvando..." : "Salvar Parâmetros Comerciais"}
            </button>
          </form>
        </Card>
      )}

      {/* SEÇÃO 4: GOVERNANÇA DE SEGURANÇA, SESSÃO & LGPD */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl border border-slate-200/90 bg-white p-6">
              <h3 className="text-base font-bold text-slate-950">Sessão & Conformidade LGPD</h3>
              <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiração por Inatividade (minutos)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={settings.inactivityTimeoutMin}
                    onChange={(e) => setSettings({ ...settings, inactivityTimeoutMin: Number(e.target.value) })}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Lido dinamicamente pelo SessionGuard (padrão: 30 min).</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Versão Ativa da Política de Privacidade & Termos
                  </label>
                  <input
                    type="text"
                    value={settings.privacyPolicyVersion}
                    onChange={(e) => setSettings({ ...settings, privacyPolicyVersion: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    Salvar Governança
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleForceLgpd}
                    className="h-10 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                  >
                    Forçar novo aceite LGPD na próxima entrada
                  </button>
                </div>
                {settings.forceLgpdReacceptAt && (
                  <p className="text-[11px] text-slate-500">
                    Último reaceite global solicitado em: {new Date(settings.forceLgpdReacceptAt).toLocaleString("pt-BR")}
                  </p>
                )}
              </form>
            </Card>

            <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-950">Ações Rápidas & Exportação</h3>
              <div className="grid gap-3">
                <Link
                  href="/admin/equipe"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5 hover:border-blue-400 transition"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">Equipe & Governança (RBAC)</p>
                    <p className="text-[11px] text-slate-500">Gerencie permissões de acesso, cargos e avisos</p>
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                </Link>
                <Link
                  href="/admin/privacidade-titularidade"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5 hover:border-blue-400 transition"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">Privacidade & Titularidade LGPD</p>
                    <p className="text-[11px] text-slate-500">Solicitações de titulares, exportação e eliminação</p>
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                </Link>
                <a
                  href="/api/admin/settings/backup"
                  className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 hover:bg-emerald-100/70 transition"
                >
                  <div>
                    <p className="text-xs font-bold text-emerald-950">Exportar Backup JSON do Estúdio</p>
                    <p className="text-[11px] text-emerald-700">Download seguro de projetos, clientes, etapas e configurações</p>
                  </div>
                  <span className="text-emerald-700 text-xs font-bold">↓ JSON</span>
                </a>
              </div>
            </Card>
          </div>

          {/* Diagnóstico de Infraestrutura em Tempo Real */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950">Diagnóstico de Infraestrutura em Tempo Real</h3>
                <p className="mt-1 text-xs text-slate-500">Status da camada de dados, cron jobs e fila de eventos.</p>
              </div>
              <button
                type="button"
                onClick={refreshHealth}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Atualizar Status
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 p-4">
                <p className="text-[11px] font-semibold text-slate-500">Neon Postgres</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={health.dbConnected ? "green" : "red"}>
                    {health.dbConnected ? "Conectado" : "Offline"}
                  </Badge>
                  <span className="font-mono text-xs text-slate-600">{health.dbLatencyMs}ms</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 p-4">
                <p className="text-[11px] font-semibold text-slate-500">Sessões Ativas</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{health.activeSessionsCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 p-4">
                <p className="text-[11px] font-semibold text-slate-500">Eventos Pendentes</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{health.pendingEventsCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 p-4">
                <p className="text-[11px] font-semibold text-slate-500">Dead Letter Queue (DLQ)</p>
                <p className={`mt-2 text-2xl font-bold ${health.deadLetterCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {health.deadLetterCount}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {health.cronJobs.map((cron) => (
                <div key={cron.path} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800">{cron.path}</span>
                    <Badge tone="blue">{cron.schedule}</Badge>
                  </div>
                  <p className="mt-1 text-slate-500">{cron.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
