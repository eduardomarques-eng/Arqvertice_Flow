import { prisma } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/formatters";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VerificarQrPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;

  const revision = await prisma.acervoRevision.findFirst({
    where: { qrVerificationToken: qrToken },
    include: {
      document: {
        include: {
          project: {
            select: { id: true, name: true, client: { select: { name: true } } },
          },
          revisions: {
            where: { isCurrent: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!revision) {
    return (
      <main className="min-h-dvh overflow-x-clip bg-[#F5F5F7] dark:bg-[#09090B] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white p-8 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
            🔍
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Código Não Encontrado
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            O selo QR escaneado não corresponde a nenhum documento registrado no Acervo Manager CDE do ArqVértice Flow.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#18181B] px-4 text-xs font-medium text-white shadow-sm hover:bg-[#27272A] transition"
          >
            Acessar Sistema
          </Link>
        </div>
      </main>
    );
  }

  const isVigente =
    revision.isCurrent &&
    (revision.status === "BOM_PARA_OBRA" || revision.status === "APROVADO_OBRA");

  const currentActiveRevision = revision.document.revisions[0];

  return (
    <main className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-5">
        {/* Cabeçalho de Status */}
        {isVigente ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-6 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white text-xl shadow-sm">
              ✓
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Verificação Concluída
            </span>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-emerald-950">
              PRANCHA VIGENTE — LIBERADA PARA OBRA
            </h1>
            <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
              Esta versão física/digital está homologada pela coordenação técnica e autorizada para execução no canteiro.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-rose-300 bg-rose-50/95 p-6 text-center shadow-lg space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white text-xl animate-pulse shadow-md">
              ⚠️
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              Alerta Crítico de Engenharia
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-rose-950">
              ATENÇÃO: ARQUIVO OBSOLETO
            </h1>
            <p className="text-xs text-rose-800 leading-relaxed max-w-md mx-auto">
              Esta prancha (Revisão <strong>{revision.revisionNumber}</strong>) foi substituída e <strong>NÃO DEVE</strong> ser utilizada na obra.
              Risco iminente de incompatibilidade e retrabalho.
            </p>

            {currentActiveRevision && (
              <div className="rounded-xl border border-rose-200 bg-white p-3 text-left space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Revisão Vigente Recomendada:</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {revision.document.code} — {currentActiveRevision.revisionNumber}
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                    {currentActiveRevision.status}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ficha Técnica e Rastreabilidade */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-start justify-between gap-2">
            <div>
              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {revision.document.code}
              </span>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
                {revision.document.title}
              </h2>
            </div>
            <span className="font-mono text-sm font-bold text-slate-900 border border-slate-200 px-2.5 py-1 rounded-lg">
              {revision.revisionNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400">Empreendimento</span>
              <p className="font-medium text-slate-800 mt-0.5">{revision.document.project.name}</p>
            </div>
            <div>
              <span className="text-slate-400">Disciplina</span>
              <p className="font-medium text-slate-800 mt-0.5">{revision.document.discipline}</p>
            </div>
            <div>
              <span className="text-slate-400">Data de Emissão</span>
              <p className="font-medium text-slate-800 mt-0.5">{formatDateBR(revision.createdAt)}</p>
            </div>
            <div>
              <span className="text-slate-400">Arquivo / Tamanho</span>
              <p className="font-mono text-slate-800 mt-0.5 truncate">{revision.fileSize || "4.2 MB"}</p>
            </div>
          </div>

          {revision.digitalStampHash && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-slate-500">Hash de Assinatura Digital CDE:</span>
              <p className="font-mono text-[11px] text-slate-700 break-all select-all">
                {revision.digitalStampHash}
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="pt-2">
            {isVigente ? (
              <a
                href={revision.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#18181B] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#27272A] transition"
              >
                Abrir Prancha PDF Homologada
              </a>
            ) : (
              <div className="text-center space-y-2">
                <span className="text-[11px] text-rose-600 font-medium">
                  Download bloqueado por diretriz de segurança CDE.
                </span>
                <Link
                  href="/login"
                  className="w-full inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200/60 bg-white px-4 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition"
                >
                  Entrar no Painel do Acervo Manager
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Apple-Minimalista */}
        <p className="text-center text-[11px] text-slate-400">
          ArqVértice Flow CDE · Protocolo de Integridade Digital de Canteiro
        </p>
      </div>
    </main>
  );
}
