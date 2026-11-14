import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProposalPresentation } from "@/components/proposals/proposal-presentation";
import { previewProposalDocument } from "@/server/services/preview-service";
import { formatCurrencyBRL } from "@/lib/contract-template";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";

export const dynamic = "force-dynamic";

export default async function EquipeProposalPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ versao?: string }>;
}) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");
  const { id } = await params;
  const { versao } = await searchParams;
  const versionNumber = versao && /^\d+$/.test(versao) ? Number(versao) : undefined;

  let document;
  try {
    document = await previewProposalDocument(id, versionNumber);
  } catch {
    notFound();
  }

  return (
    <AppShell eyebrow="Preview" role={user.role}>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-900">Visualização como o cliente</p>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              Documento comercial com impressão digital{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">{document.fingerprint}</code>.
            </p>
          </div>
          <Link
            href={`/equipe/propostas/${id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Voltar à edição
          </Link>
        </div>
      </div>

      <ProposalPresentation
        clientName={document.clientName}
        projectName={document.projectName}
        title={document.slides[0]?.title ?? "Proposta comercial"}
        slides={document.slides.map((slide) => ({ title: slide.title, body: slide.body }))}
      />

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Escopo e investimento</h2>
          <Badge tone="blue">versão {document.generatedFrom.version}</Badge>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {document.services.map((service, index) => (
            <div key={`${service.name}-${index}`} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
              <span className="text-slate-700">
                {service.name}
                {service.discipline ? ` · ${service.discipline}` : ""} · {service.quantity ?? 1} {service.unit ?? "un."}
              </span>
              <strong className="text-slate-900">{formatCurrencyBRL(Number(service.subtotal ?? 0))}</strong>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-950">
          <span>Valor total</span>
          <span>{formatCurrencyBRL(document.totals.total)}</span>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">Documento formal</h2>
        <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{document.formalText}</pre>
      </Card>
    </AppShell>
  );
}
