"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/contract-template";
import {
  computeInvestmentOptionTotal,
  computeOptionInstallments,
  type ProposalEditorialData,
} from "@/lib/proposal-standard";

export function ProposalLivePreview({
  title,
  code,
  version,
  objectText,
  included,
  excluded,
  premisses,
  conditions,
  observations,
  validityDays,
  totalServices,
  editorial,
}: {
  title: string;
  code: string | null;
  version: number;
  objectText: string;
  included: string;
  excluded: string;
  premisses: string;
  conditions: string;
  observations: string;
  validityDays: number;
  totalServices: number;
  editorial: ProposalEditorialData;
}) {
  const premissLines = premisses
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
            Pré-Visualização ao Vivo · ArqVértice OS
          </p>
          <p className="text-xs text-slate-500">
            Espelho em tempo real das 12 seções editoriais (Web &amp; PDF)
          </p>
        </div>
        <Badge tone="blue">
          {code ?? "Rascunho"} · v{version}
        </Badge>
      </div>

      {/* 1. Capa & Cabeçalho */}
      <div className="rounded-xl bg-slate-950 p-5 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">
          {editorial.cover.technicalLead || "ArqVértice Studio"}
        </p>
        <h3 className="mt-2 text-lg font-bold">{title || "Proposta Comercial"}</h3>
        <p className="mt-1 text-xs text-slate-300">{editorial.cover.subtitle}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-300">
          <span>Área: {editorial.cover.areaM2} m²</span>
          <span>Validade: {validityDays} dias</span>
          <span>Prazo: {editorial.schedule.totalBusinessDays} dias úteis</span>
        </div>
      </div>

      {/* 2. Diagnóstico Inicial */}
      {editorial.diagnosis.enabled ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Diagnóstico Inicial</h4>
          {editorial.diagnosis.propertyAnalysis ? (
            <p className="text-xs text-slate-700">
              <strong>Imóvel/Terreno:</strong> {editorial.diagnosis.propertyAnalysis}
            </p>
          ) : null}
          {editorial.diagnosis.structuralNote ? (
            <p className="text-xs text-slate-700">
              <strong>Observação Técnica:</strong> {editorial.diagnosis.structuralNote}
            </p>
          ) : null}
          {editorial.diagnosis.projectFocus ? (
            <p className="text-xs text-slate-700">
              <strong>Foco do Projeto:</strong> {editorial.diagnosis.projectFocus}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 3. Objeto & Grupos de Escopo */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Objeto &amp; Entregáveis</h4>
        {objectText ? <p className="text-xs text-slate-700">{objectText}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {editorial.scopeGroups.map((group, idx) => (
            <div key={`${group.title}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-900">{group.title}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-slate-600">
                {group.items.map((item, i) => (
                  <li key={`${i}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Cronograma por Etapas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cronograma &amp; Etapas</h4>
          <span className="text-xs font-semibold text-slate-700">{editorial.schedule.totalBusinessDays} dias úteis</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {editorial.schedule.phases.map((phase, idx) => (
            <div key={`${phase.code}-${idx}`} className="rounded-lg border border-slate-100 p-2.5 text-xs">
              <p className="font-bold text-slate-900">
                {phase.code} · {phase.businessDays} d.u.
              </p>
              <p className="font-medium text-slate-700">{phase.title}</p>
              <p className="mt-1 text-[11px] text-slate-500">{phase.deliverables}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Opções de Investimento & Condições de Pagamento Calculadas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Opções de Investimento &amp; Pagamento
          </h4>
          {totalServices > 0 ? (
            <span className="text-xs font-semibold text-emerald-700">
              Total Serviços: {formatCurrencyBRL(totalServices)}
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {editorial.investmentOptions.map((opt) => {
            const calcTotal = computeInvestmentOptionTotal(opt);
            const installments = computeOptionInstallments(calcTotal, editorial.paymentCondition.installments);
            return (
              <div
                key={opt.id}
                className={`rounded-xl border p-3 ${
                  opt.recommended ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">{opt.name}</p>
                  {opt.recommended ? <Badge tone="blue">Recomendada</Badge> : null}
                </div>
                <p className="mt-1 text-base font-bold text-slate-950">{formatCurrencyBRL(calcTotal)}</p>
                <p className="text-[11px] text-slate-500">
                  {opt.mode === "PER_M2"
                    ? `${opt.areaM2} m² × ${formatCurrencyBRL(opt.unitPricePerM2)}/m²`
                    : "Valor fechado"}
                </p>
                {opt.summary ? <p className="mt-1 text-[11px] text-slate-600">{opt.summary}</p> : null}
                <div className="mt-2 border-t border-slate-200/80 pt-2 space-y-1">
                  {installments.map((inst, idx) => (
                    <div key={`${opt.id}-inst-${idx}`} className="flex justify-between text-[11px] text-slate-700">
                      <span>
                        {inst.label} ({inst.percent}%)
                      </span>
                      <strong>{formatCurrencyBRL(inst.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">Modalidade: {editorial.paymentCondition.method}</p>
      </div>

      {/* 6. Blocos Opcionais Ativos */}
      {(editorial.optionalBlocks.technicalHighlight.enabled || editorial.optionalBlocks.moodboard.enabled) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Destaques &amp; Moodboard</h4>
          {editorial.optionalBlocks.technicalHighlight.enabled ? (
            <p className="text-xs text-slate-700">
              <strong>{editorial.optionalBlocks.technicalHighlight.title}:</strong>{" "}
              {editorial.optionalBlocks.technicalHighlight.body}
            </p>
          ) : null}
          {editorial.optionalBlocks.moodboard.enabled ? (
            <p className="text-xs text-slate-700">
              <strong>{editorial.optionalBlocks.moodboard.title}:</strong>{" "}
              {editorial.optionalBlocks.moodboard.palette} {editorial.optionalBlocks.moodboard.notes}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 7. Premissas, Inclusos, Exclusões & Próximos Passos */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
        <h4 className="font-bold uppercase tracking-wider text-slate-500">
          Premissas, Inclusos, Exclusões &amp; Próximos Passos
        </h4>
        {included ? (
          <p className="text-slate-700">
            <strong>Incluído:</strong> {included}
          </p>
        ) : null}
        {excluded ? (
          <p className="text-slate-700">
            <strong>Não incluído:</strong> {excluded}
          </p>
        ) : null}
        {premissLines.length > 0 ? (
          <div>
            <strong>Premissas:</strong>
            <ul className="mt-1 list-disc pl-4 text-slate-600">
              {premissLines.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {conditions ? (
          <p className="text-slate-700">
            <strong>Condições:</strong> {conditions}
          </p>
        ) : null}
        {observations ? (
          <p className="text-slate-500">
            <strong>Observações:</strong> {observations}
          </p>
        ) : null}
        <div className="border-t border-slate-100 pt-2">
          <strong>Próximos Passos:</strong>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            {editorial.nextSteps.steps.filter(Boolean).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
