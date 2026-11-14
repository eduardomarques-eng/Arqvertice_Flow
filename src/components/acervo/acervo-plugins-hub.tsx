"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PLUGIN_PACKAGES, CDE_BASE_URL } from "@/lib/acervo/plugin-packages";
import { formatDateBR } from "@/lib/formatters";

interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  projectId?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdBy?: { name: string } | null;
}

export function AcervoPluginsHub({ basePath }: { basePath: "/admin" | "/equipe" }) {
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Estados do Gerenciador de Tokens de API
  const [apiTokens, setApiTokens] = useState<ApiTokenItem[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [generatedRawToken, setGeneratedRawToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  function loadTokens() {
    setLoadingTokens(true);
    fetch("/api/acervo/tokens")
      .then((res) => res.json())
      .then((data) => {
        if (data.tokens) setApiTokens(data.tokens);
      })
      .catch(() => {})
      .finally(() => setLoadingTokens(false));
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/acervo/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setGeneratedRawToken(data.token.rawToken);
        setNewTokenName("");
        loadTokens();
      } else {
        alert(data.error || "Erro ao criar token.");
      }
    } catch {
      alert("Falha de conexão com o servidor ao gerar token.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRevokeToken(id: string) {
    if (
      !confirm(
        "Tem certeza que deseja revogar este token de API? Os plugins conectados a esta estação deixarão de sincronizar."
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/acervo/tokens?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadTokens();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao revogar token.");
      }
    } catch {
      alert("Erro ao revogar token.");
    }
  }

  function copyToClipboard(text: string, type: "sha" | "token") {
    navigator.clipboard.writeText(text);
    if (type === "sha") {
      setCopiedSha(text);
      setTimeout(() => setCopiedSha(null), 2500);
    } else {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2500);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header Principal */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href={`${basePath}/acervo`} className="hover:text-slate-900 transition">
                ← Voltar ao Acervo Manager
              </Link>
              <span>·</span>
              <span className="text-slate-700 font-semibold">Central de Conectores Windows (2022–2026)</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#18181B]">
              Central de Plugins & Conectores CDE
            </h1>
            <p className="mt-1 max-w-3xl text-xs sm:text-sm text-slate-500 leading-relaxed">
              Instaladores oficiais e integrações nativas para Revit, AutoCAD, SketchUp, 3ds Max, TQS e CADs universais.
              Conexão direta com o endpoint{" "}
              <code className="rounded bg-[#F5F5F7] px-1.5 py-0.5 text-xs font-mono text-slate-800">
                {CDE_BASE_URL}
              </code>{" "}
              com verificação de revisão (R00 ➔ R01), validação de máscara técnica e emissão automática de GRD.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <a
              href="/api/acervo/plugins/check-env"
              download="Check-ArqVerticeEnv.ps1"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span>🔍</span>
              <span>Testar Ambiente (PS1)</span>
            </a>
            {basePath === "/admin" && (
              <a
                href="#token-manager"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#18181B] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                Gerenciar Tokens
              </a>
            )}
          </div>
        </div>

        {/* Endpoints Reference Bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { method: "POST", path: "/api/acervo/plugins/auth", desc: "Auth, Projetos & Pastas" },
            { method: "GET", path: "/api/acervo/plugins/context", desc: "Árvore, Máscara & Selos" },
            { method: "POST", path: "/api/acervo/plugins/check-revisions", desc: "Verificação R00 ➔ R01" },
            { method: "POST", path: "/api/acervo/plugins/publish-batch", desc: "Publicação + GRD Automática" },
          ].map((ep) => (
            <div
              key={ep.path}
              className="rounded-2xl border border-slate-200/60 bg-white p-3.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#EDE5D8] px-2 py-0.5 font-mono text-[10px] font-bold text-[#18181B]">
                  {ep.method}
                </span>
                <span className="text-[11px] font-medium text-slate-500">{ep.desc}</span>
              </div>
              <p className="mt-2 truncate font-mono text-[11px] text-slate-800">{ep.path}</p>
            </div>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* BLOCO A: 5+1 ADD-IN CARDS WINDOWS 64-BIT                                  */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#18181B]">
                Conectores Oficiais para Windows (64 bits)
              </h2>
              <p className="text-xs text-slate-500">
                Pacotes completos pré-configurados com scripts de elevação PowerShell, manifestos Autodesk e verificação SHA-256.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PLUGIN_PACKAGES.map((plugin) => (
              <article
                key={plugin.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition hover:shadow-[0_6px_24px_-4px_rgba(0,0,0,0.08)]"
              >
                <div>
                  {/* Badges de Categoria e Versão */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                      {plugin.category}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                      {plugin.versionRange}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-[#18181B]">{plugin.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{plugin.software}</p>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600">{plugin.summary}</p>

                  {/* Formatos Suportados */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                      Formatos:
                    </span>
                    {plugin.formats.map((fmt) => (
                      <span
                        key={fmt}
                        className="rounded-lg border border-slate-200/80 bg-[#F5F5F7] px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                      >
                        .{fmt.toLowerCase()}
                      </span>
                    ))}
                  </div>

                  {/* Caminho de Instalação e Runtime */}
                  <div className="mt-4 space-y-2 rounded-xl bg-slate-50/80 p-3 text-[11px] border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-700">Runtime: </span>
                      <span className="text-slate-600">{plugin.runtimeStack}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Destino: </span>
                      <code className="block mt-0.5 break-all font-mono text-[10px] text-slate-800">
                        {plugin.targetPath}
                      </code>
                    </div>
                  </div>

                  {/* Nota de Limitação Técnica */}
                  <div className="mt-3 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
                    <span className="font-semibold">Nota técnica: </span>
                    {plugin.limitationNotice}
                  </div>

                  {/* 3 Passos de Instalação */}
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Instalação Rápida
                    </p>
                    <ol className="space-y-1.5 text-[11px] text-slate-600">
                      {plugin.steps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#EDE5D8] text-[10px] font-bold text-[#18181B]">
                            {i + 1}
                          </span>
                          <span className="leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Footer do Card com SHA-256 e Download */}
                <div className="mt-5 space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono">SHA-256: {plugin.packageSha256.slice(0, 10)}...</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(plugin.packageSha256, "sha")}
                      className="text-xs font-medium text-slate-700 hover:text-slate-900 transition"
                    >
                      {copiedSha === plugin.packageSha256 ? "✓ Copiado" : "Copiar Hash"}
                    </button>
                  </div>

                  <a
                    href={`/api/acervo/plugins/download/${plugin.id}`}
                    download={plugin.fileName}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#18181B] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                  >
                    <span>⬇ Baixar {plugin.fileName}</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BLOCO B: REQUISITOS DE SISTEMA & FIREWALL + VERIFICADOR PS1               */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card de Requisitos e Diagnóstico */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#18181B]">
                  Requisitos de Sistema & Rede Windows
                </h3>
                <p className="text-xs text-slate-500">
                  Checklist essencial para execução sem atritos em estações de trabalho de arquitetura e engenharia.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Win 10/11 64-bit
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              {[
                { title: "Sistema Operacional", detail: "Windows 10 / 11 64-bit (Build 1809 ou superior)" },
                { title: "Microsoft .NET", detail: ".NET Framework 4.8 (Revit 2022-2024 / AutoCAD) e .NET 8.0 Desktop Runtime (Revit 2025-2026 / TQS)" },
                { title: "Microsoft Edge WebView2", detail: "Runtime WebView2 obrigatório para renderização de painéis interativos de publicação" },
                { title: "Memória RAM", detail: "Mínimo de 16 GB; Recomendado 32 GB ou 64 GB para modelos pesados Revit/IFC/3D" },
                { title: "Portas & Firewall", detail: "Porta 443 (HTTPS) de saída liberada para o domínio arqvertice-flow.vercel.app" },
                { title: "Privilégios Locais", detail: "Acesso de Administrador local necessário para instalação dos arquivos .addin e .bundle" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 rounded-xl bg-slate-50/70 p-2.5 border border-slate-100/80">
                  <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                  <div>
                    <span className="font-semibold text-slate-800">{item.title}: </span>
                    <span className="text-slate-600">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 text-[11px] text-amber-900 leading-relaxed">
              <span className="font-bold">Aviso macOS: </span>
              Não há suporte nativo para Revit ou TQS no macOS. Para projetistas em ambiente Apple Silicon (M1/M2/M3), é necessário utilizar máquina virtual Windows 11 via Parallels Desktop ou Boot Camp em Mac Intel.
            </div>

            <div className="pt-2">
              <a
                href="/api/acervo/plugins/check-env"
                download="Check-ArqVerticeEnv.ps1"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#EDE5D8] px-4 text-xs font-semibold text-[#18181B] transition hover:bg-[#E3DACB]"
              >
                <span>🔍 Baixar Verificador de Ambiente Automatizado (Check-ArqVerticeEnv.ps1)</span>
              </a>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* GERENCIADOR DE TOKENS API (AcervoApiToken)                              */}
          {/* ======================================================================= */}
          <div id="token-manager" className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-5">
            <div>
              <h3 className="text-base font-semibold text-[#18181B]">
                Tokens de Estação & Conexão de Plugins
              </h3>
              <p className="text-xs text-slate-500">
                Gere chaves Bearer SHA-256 para autenticar plugins instalados nas estações da equipe de projetos.
              </p>
            </div>

            {/* Alerta de Token Recém-Gerado (Exibido uma única vez) */}
            {generatedRawToken && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">
                    🔑 Novo Token Gerado (Copie agora — exibido apenas uma vez):
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedRawToken, "token")}
                    className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 transition"
                  >
                    {tokenCopied ? "✓ Copiado!" : "Copiar Token"}
                  </button>
                </div>
                <p className="break-all font-mono text-xs font-semibold text-emerald-950 bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  {generatedRawToken}
                </p>
                <p className="text-[10px] text-emerald-700">
                  Guarde em segurança. Este token não poderá ser visualizado novamente após fechar ou recarregar esta tela.
                </p>
              </div>
            )}

            {/* Formulário de Criação de Token */}
            {basePath === "/admin" ? (
              <form onSubmit={handleCreateToken} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da estação (ex.: Revit Workstation 01 - Arq)"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-[#F5F5F7] px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
                  disabled={isGenerating}
                />
                <button
                  type="submit"
                  disabled={isGenerating || !newTokenName.trim()}
                  className="h-9 shrink-0 rounded-xl bg-[#18181B] px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isGenerating ? "Gerando..." : "Gerar Token"}
                </button>
              </form>
            ) : (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-100">
                Apenas administradores podem emitir ou revogar tokens de API. Solicite um token ao coordenador do estúdio.
              </div>
            )}

            {/* Lista de Tokens Ativos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                <span>Estações Conectadas</span>
                <span>{apiTokens.length} registradas</span>
              </div>

              {loadingTokens ? (
                <p className="text-xs text-slate-400 py-3 text-center">Carregando tokens...</p>
              ) : apiTokens.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Nenhum token gerado ainda. Crie um token para conectar seu Revit, AutoCAD ou SketchUp.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {apiTokens.map((token) => (
                    <div
                      key={token.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F5F5F7]/70 p-3 text-xs transition hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-[#18181B]">{token.name}</span>
                          {token.revokedAt ? (
                            <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                              REVOGADO
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">
                              ATIVO
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-mono">{token.tokenPrefix}</span>
                          <span>·</span>
                          <span>Criado: {formatDateBR(token.createdAt)}</span>
                          {token.lastUsedAt && (
                            <>
                              <span>·</span>
                              <span>Último uso: {formatDateBR(token.lastUsedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {basePath === "/admin" && !token.revokedAt && (
                        <button
                          type="button"
                          onClick={() => handleRevokeToken(token.id)}
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 hover:border-rose-200"
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
