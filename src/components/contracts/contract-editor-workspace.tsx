"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SignatureActions } from "@/components/proposals/signature-actions";
import {
  createContractAddendumAction,
  updateContractDraftAction,
} from "@/app/actions/domain-actions";
import {
  renderContractDocumentText,
  type ContractDocumentData,
} from "@/lib/contract-standard";
import { formatCurrencyBRL } from "@/lib/contract-template";
import { valorPorExtensoBRL } from "@/lib/currency-extenso";
import type { SignatureStatusName } from "@/lib/signature";

const FIELD = "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800";

interface AddendumSummary {
  id: string;
  number: number;
  title: string;
  description: string;
  additionalValue: number;
  additionalDays: number;
  eapSnapshotId: string | null;
  status: string;
  createdAt: string;
}

interface EapSnapshotOption {
  id: string;
  versionLabel: string;
  totalSelling: number;
}

export function ContractEditorWorkspace({
  contractId,
  contractStatus,
  signatureStatus,
  signatureProvider,
  initialData,
  addendums,
  eapSnapshots,
}: {
  contractId: string;
  contractStatus: string;
  signatureStatus: SignatureStatusName | null;
  signatureProvider: string | null;
  initialData: ContractDocumentData;
  addendums: AddendumSummary[];
  eapSnapshots: EapSnapshotOption[];
}) {
  const router = useRouter();
  const [data, setData] = useState<ContractDocumentData>(initialData);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  // Novo Termo Aditivo
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addDays, setAddDays] = useState("10");
  const [addSnapshotId, setAddSnapshotId] = useState(eapSnapshots[0]?.id || "");

  const renderedPreview = useMemo(
    () =>
      renderContractDocumentText({
        ...data,
        totalInWords: valorPorExtensoBRL(data.totalValue),
      }),
    [data],
  );

  function handleSave() {
    setFeedback("");
    setIsError(false);
    startTransition(async () => {
      try {
        await updateContractDraftAction(contractId, data);
        setFeedback("Minuta contratual atualizada e sincronizada para geração de PDF.");
        router.refresh();
      } catch (err) {
        setIsError(true);
        setFeedback(err instanceof Error ? err.message : "Erro ao salvar minuta contratual.");
      }
    });
  }

  function handleAddendum(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || !addDesc.trim()) return;
    setFeedback("");
    setIsError(false);
    startTransition(async () => {
      try {
        await createContractAddendumAction({
          contractId,
          title: addTitle.trim(),
          description: addDesc.trim(),
          additionalValue: Number(addValue) || 0,
          additionalDays: Number(addDays) || 0,
          eapSnapshotId: addSnapshotId || null,
        });
        setAddTitle("");
        setAddDesc("");
        setAddValue("");
        setFeedback("Termo Aditivo criado e parcela complementar lançada em Financeiro (ProjectInstallment).");
        router.refresh();
      } catch (err) {
        setIsError(true);
        setFeedback(err instanceof Error ? err.message : "Erro ao criar termo aditivo.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Barra de ações e status */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={contractStatus === "SIGNED" ? "green" : "blue"}>{contractStatus}</Badge>
            <span className="text-xs font-semibold text-slate-500">
              CNPJ Oficial: {data.contractor.cnpj} · PIX: {data.contractor.pixKeyType} ({data.contractor.pixKey})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Salvar Minuta"}
            </button>
            <a
              href={`/api/contracts/${contractId}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Baixar PDF
            </a>
            <a
              href={`/api/contracts/${contractId}/pdf?archive=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              Baixar PDF &amp; Arquivar no Acervo
            </a>
          </div>
        </div>
        {feedback ? (
          <p className={`mt-3 text-xs font-semibold ${isError ? "text-rose-600" : "text-emerald-700"}`}>
            {feedback}
          </p>
        ) : null}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <SignatureActions contractId={contractId} status={signatureStatus} provider={signatureProvider} />
        </div>
      </Card>

      {/* Editor Estruturado + Preview Fiel Lado a Lado */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h2 className="text-base font-bold text-slate-950">Qualificação das Partes, Parceiro &amp; ART</h2>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Título do Contrato</label>
              <input
                className={FIELD}
                value={data.title}
                onChange={(e) => setData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={data.includeStructuralPartner}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, includeStructuralPartner: e.target.checked }))
                  }
                />
                Incluir Parceiro Estrutural Co-Contratado ({data.structuralPartner.name})
              </label>

              <label className="flex items-center gap-2 font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={data.artFee.enabled}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      artFee: { ...prev.artFee, enabled: e.target.checked },
                    }))
                  }
                />
                Incluir Taxa de RRT / ART
              </label>
            </div>

            {data.artFee.enabled ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Valor RRT/ART (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className={FIELD}
                    value={data.artFee.amount}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        artFee: { ...prev.artFee, amount: Number(e.target.value) || 0 },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Parcela Vinculada</label>
                  <input
                    className={FIELD}
                    value={data.artFee.linkedInstallmentLabel}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        artFee: { ...prev.artFee, linkedInstallmentLabel: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Contratante</label>
                <input
                  className={FIELD}
                  value={data.client.name}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, client: { ...prev.client, name: e.target.value } }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">CPF / CNPJ Contratante</label>
                <input
                  className={FIELD}
                  value={data.client.cpfOrCnpj}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, client: { ...prev.client, cpfOrCnpj: e.target.value } }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nacionalidade / Estado Civil</label>
                <input
                  className={FIELD}
                  value={`${data.client.nationality} · ${data.client.maritalStatus}`}
                  onChange={(e) => {
                    const [nat, mar] = e.target.value.split("·").map((s) => s.trim());
                    setData((prev) => ({
                      ...prev,
                      client: { ...prev.client, nationality: nat || "", maritalStatus: mar || prev.client.maritalStatus },
                    }));
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Profissão / RG</label>
                <input
                  className={FIELD}
                  value={data.client.profession}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, client: { ...prev.client, profession: e.target.value } }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Endereço Completo</label>
                <input
                  className={FIELD}
                  value={data.client.address}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, client: { ...prev.client, address: e.target.value } }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Valor Global (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className={FIELD}
                  value={data.totalValue}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, totalValue: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Foro de Eleição</label>
                <input
                  className={FIELD}
                  value={data.forumCity}
                  onChange={(e) => setData((prev) => ({ ...prev, forumCity: e.target.value }))}
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="text-base font-bold text-slate-950">Cláusulas 1ª a 8ª &amp; Opcionais</h2>
            {data.clauses.map((clause, idx) => (
              <div key={clause.number} className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-xs font-bold text-slate-900">
                  CLÁUSULA {clause.number}ª — {clause.title}
                </p>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800"
                  value={clause.body}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      clauses: prev.clauses.map((c, i) => (i === idx ? { ...c, body: e.target.value } : c)),
                    }))
                  }
                />
              </div>
            ))}

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cláusulas Adicionais</p>
              {data.optionalClauses.map((opt, idx) => (
                <div key={opt.id} className="rounded-xl border border-slate-100 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={opt.enabled}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          optionalClauses: prev.optionalClauses.map((o, i) =>
                            i === idx ? { ...o, enabled: e.target.checked } : o,
                          ),
                        }))
                      }
                    />
                    {opt.title}
                  </label>
                  {opt.enabled ? (
                    <textarea
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-700"
                      value={opt.body}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          optionalClauses: prev.optionalClauses.map((o, i) =>
                            i === idx ? { ...o, body: e.target.value } : o,
                          ),
                        }))
                      }
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          {/* Termos Aditivos conectados à EAP e ProjectInstallment */}
          <Card className="space-y-4 p-5">
            <h2 className="text-base font-bold text-slate-950">Termos Aditivos (EAP &amp; Financeiro)</h2>
            {addendums.length > 0 ? (
              <div className="space-y-2">
                {addendums.map((add) => (
                  <div key={add.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <strong>
                        Aditivo nº {add.number} — {add.title}
                      </strong>
                      <Badge tone="amber">{formatCurrencyBRL(add.additionalValue)}</Badge>
                    </div>
                    <p className="mt-1 text-slate-600">{add.description}</p>
                    {add.additionalDays > 0 ? (
                      <p className="mt-1 text-slate-500">Prorrogação: +{add.additionalDays} dias</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nenhum termo aditivo registrado.</p>
            )}

            <form onSubmit={handleAddendum} className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Novo Termo Aditivo</p>
              <input
                required
                placeholder="Título do Aditivo (ex.: Revisão Estrutural Baseline v2.0)"
                className={FIELD}
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
              />
              <textarea
                required
                rows={2}
                placeholder="Descrição detalhada do escopo aditivo..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Valor Adicional (R$)"
                  className={FIELD}
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="+ Dias"
                  className={FIELD}
                  value={addDays}
                  onChange={(e) => setAddDays(e.target.value)}
                />
                {eapSnapshots.length > 0 ? (
                  <select
                    className={FIELD}
                    value={addSnapshotId}
                    onChange={(e) => setAddSnapshotId(e.target.value)}
                  >
                    <option value="">Sem vínculo EAP</option>
                    {eapSnapshots.map((snap) => (
                      <option key={snap.id} value={snap.id}>
                        EAP {snap.versionLabel} ({formatCurrencyBRL(snap.totalSelling)})
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={pending}
                className="min-h-10 rounded-xl bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Emitir Aditivo &amp; Gerar Parcela no Financeiro
              </button>
            </form>
          </Card>
        </div>

        {/* Preview Fiel do Documento */}
        <Card className="sticky top-6 space-y-3 p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
                Pré-Visualização Jurídica · ArqVértice OS
              </p>
              <p className="text-xs text-slate-500">Espelho exato da minuta antes de gerar o PDF oficial</p>
            </div>
            <Badge tone="neutral">{formatCurrencyBRL(data.totalValue)}</Badge>
          </div>
          <pre className="max-h-[75vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-5 font-sans text-xs leading-6 text-slate-800">
            {renderedPreview}
          </pre>
        </Card>
      </div>
    </div>
  );
}
