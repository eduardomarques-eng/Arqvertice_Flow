"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function AcervoQrCodeModal({
  revisionId,
  documentCode,
  revisionNumber,
  isOpen,
  onClose,
}: {
  revisionId: string;
  documentCode: string;
  revisionNumber: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !revisionId) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/acervo/revisions/${revisionId}/qrcode`)
      .then((res) => res.json())
      .then((data) => {
        if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
          setVerifyUrl(data.verificationUrl);
        } else {
          setError(data.error || "Falha ao gerar QR Code.");
        }
      })
      .catch(() => setError("Erro de conexão ao gerar QR Code."))
      .finally(() => setIsLoading(false));
  }, [isOpen, revisionId]);

  if (!isOpen) return null;

  function handleCopy() {
    if (!verifyUrl) return;
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Rastreabilidade de Canteiro
            </span>
            <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
              QR Code — {documentCode} ({revisionNumber})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/60 bg-[#F5F5F7] p-6">
          {isLoading ? (
            <div className="h-44 w-44 animate-pulse rounded-xl bg-slate-200/70" />
          ) : error ? (
            <p className="text-xs text-rose-600">{error}</p>
          ) : qrDataUrl ? (
            <>
              <img
                src={qrDataUrl}
                alt={`QR Code ${documentCode} ${revisionNumber}`}
                className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
              />
              <p className="mt-3 text-[11px] font-medium text-slate-600 text-center">
                Insira este selo no carimbo da prancha para validação instantânea na obra.
              </p>
            </>
          ) : null}
        </div>

        {verifyUrl && (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
              URL de Verificação Pública
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={verifyUrl}
                className="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[11px] text-slate-700"
              />
              <Button type="button" size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          {verifyUrl && (
            <a
              href={verifyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
            >
              Testar Validação ↗
            </a>
          )}
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`qrcode-${documentCode}-${revisionNumber}.png`}
              className="inline-flex h-9 items-center rounded-xl bg-[#18181B] px-4 text-xs font-semibold text-white hover:bg-zinc-800 transition"
            >
              Baixar PNG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
