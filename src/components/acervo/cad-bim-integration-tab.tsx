"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/formatters";

export function CadBimIntegrationTab({
  projectId,
  userRole,
}: {
  projectId: string;
  userRole: string;
}) {
  const [apiTokens, setApiTokens] = useState<
    Array<{
      id: string;
      name: string;
      tokenPrefix: string;
      createdAt: string;
      lastUsedAt?: string | null;
      revokedAt?: string | null;
    }>
  >([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [generatedRawToken, setGeneratedRawToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  useEffect(() => {
    loadTokens();
  }, [projectId]);

  function loadTokens() {
    fetch(`/api/acervo/tokens?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.tokens) setApiTokens(data.tokens);
      })
      .catch((err) => console.error("Erro ao carregar tokens:", err));
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    setIsGeneratingToken(true);
    try {
      const res = await fetch("/api/acervo/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenName, projectId }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setGeneratedRawToken(data.token.rawToken);
        setNewTokenName("");
        loadTokens();
      } else {
        alert(data.error || "Erro ao gerar token.");
      }
    } catch {
      alert("Falha de conexão com o servidor.");
    } finally {
      setIsGeneratingToken(false);
    }
  }

  async function handleRevokeToken(id: string) {
    if (
      !confirm(
        "Tem certeza que deseja revogar este token de API? Os plugins conectados deixarão de sincronizar."
      )
    )
      return;
    try {
      const res = await fetch(`/api/acervo/tokens?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadTokens();
      }
    } catch {
      alert("Erro ao revogar token.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-4">
        <h3 className="text-base font-semibold text-slate-900">
          Integração com Softwares de Projeto (AutoCAD & Revit Sync API)
        </h3>
        <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
          Conecte seus plugins ou scripts de automação do AutoCAD e Revit diretamente ao Acervo Manager.
          Ao plotar ou salvar, a revisão avança automaticamente e fica disponível na esteira CDE.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <span className="text-[11px] font-semibold uppercase text-slate-500">
            Endpoint de Sincronização REST:
          </span>
          <p className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 p-2 rounded-lg select-all">
            POST {(process.env.NEXT_PUBLIC_APP_URL || "https://arqvertice-os.vercel.app").replace(/\/+$/, "")}/api/acervo/sync-plugin
          </p>
          <p className="text-[11px] text-slate-500">
            Cabeçalho obrigatório:{" "}
            <code className="font-mono text-slate-700">
              Authorization: Bearer &lt;SEU_TOKEN_API&gt;
            </code>
          </p>
        </div>

        {/* Gerador de Novo Token (Apenas Coordenadores e Admins) */}
        {userRole === "ADMIN" || userRole === "ENGENHEIRO" || userRole === "ARQUITETO" ? (
          <form onSubmit={handleCreateToken} className="flex flex-col sm:flex-row gap-3 items-end pt-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Identificador da Estação / Plugin
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Plugin Revit — Estação Engenharia Wagner"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200/60 px-3 text-xs text-slate-900 shadow-sm focus:border-[#18181B] focus:outline-none"
              />
            </div>
            <Button
              type="submit"
              disabled={isGeneratingToken}
              className="bg-[#18181B] text-white min-h-[40px]"
            >
              {isGeneratingToken ? "Gerando..." : "+ Gerar Token CDE"}
            </Button>
          </form>
        ) : null}

        {/* Alerta com o Token Cru (Aparece apenas na criação) */}
        {generatedRawToken && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
            <p className="text-xs font-bold text-amber-900">
              ⚠️ Copie seu Token de API agora. Ele não será exibido novamente!
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedRawToken}
                className="flex-1 h-9 rounded-lg border border-amber-300 bg-white px-3 font-mono text-xs text-slate-900 select-all"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedRawToken);
                  alert("Token copiado para a área de transferência!");
                }}
                className="rounded-lg bg-amber-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-950 transition"
              >
                Copiar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Tokens Ativos */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Tokens Configurados
        </h4>
        {apiTokens.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            Nenhum token gerado ainda. Clique em "+ Gerar Token CDE" para autorizar uma integração.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {apiTokens.map((t) => (
              <div key={t.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{t.name}</p>
                  <p className="font-mono text-[11px] text-slate-400">
                    {t.tokenPrefix} · Criado em {formatDateBR(t.createdAt)}
                  </p>
                </div>
                <div>
                  {t.revokedAt ? (
                    <Badge className="bg-rose-50 text-rose-800 border-rose-200">Revogado</Badge>
                  ) : userRole === "ADMIN" ? (
                    <button
                      type="button"
                      onClick={() => handleRevokeToken(t.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium transition"
                    >
                      Revogar
                    </button>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">Ativo</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
