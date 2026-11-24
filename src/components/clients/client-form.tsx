"use client";

import { useState, useTransition } from "react";
import { saveClientAction } from "@/app/actions/domain-actions";

const FIELD = "min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm";

export function ClientForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [erro, setErro] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage("");
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Novo cliente
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        setErro(false);
        startTransition(async () => {
          try {
            const logradouro = String(formData.get("logradouro") ?? "").trim();
            const numero = String(formData.get("numero") ?? "").trim();
            const complemento = String(formData.get("complemento") ?? "").trim();
            const bairro = String(formData.get("bairro") ?? "").trim();
            const cidade = String(formData.get("city") ?? "").trim();
            const uf = String(formData.get("state") ?? "").trim();
            const cep = String(formData.get("cep") ?? "").trim();

            const hasAddress = Boolean(logradouro || numero || bairro || cidade || uf || cep);
            const address = hasAddress
              ? {
                  logradouro: logradouro || undefined,
                  numero: numero || undefined,
                  complemento: complemento || undefined,
                  bairro: bairro || undefined,
                  cidade: cidade || undefined,
                  uf: uf || undefined,
                  cep: cep || undefined,
                }
              : null;

            const cpf = String(formData.get("cpf") ?? "").trim() || null;
            const document = String(formData.get("document") ?? "").trim() || cpf;

            await saveClientAction({
              name: String(formData.get("name") ?? "").trim(),
              fullName: String(formData.get("fullName") ?? "").trim() || null,
              email: String(formData.get("email") ?? "").trim() || null,
              phone: String(formData.get("phone") ?? "").trim() || null,
              document,
              cpf,
              rg: String(formData.get("rg") ?? "").trim() || null,
              nationality: String(formData.get("nationality") ?? "").trim() || null,
              maritalStatus: String(formData.get("maritalStatus") ?? "").trim() || null,
              profession: String(formData.get("profession") ?? "").trim() || null,
              city: cidade || null,
              state: uf || null,
              address,
              notes: String(formData.get("notes") ?? "").trim() || null,
            });
            setMessage("Cliente criado.");
            setOpen(false);
          } catch (error) {
            setErro(true);
            setMessage(error instanceof Error ? error.message : "Não foi possível criar o cliente.");
          }
        });
      }}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Novo cliente (com qualificação contratual)</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500">
          Cancelar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cliente-nome" className="mb-1 block text-xs font-medium text-slate-600">
            Nome curto *
          </label>
          <input id="cliente-nome" name="name" required placeholder="Como o cliente é identificado" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-nome-completo" className="mb-1 block text-xs font-medium text-slate-600">
            Nome completo / Razão Social
          </label>
          <input id="cliente-nome-completo" name="fullName" placeholder="Para propostas e contratos" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-cpf" className="mb-1 block text-xs font-medium text-slate-600">
            CPF / CNPJ
          </label>
          <input id="cliente-cpf" name="cpf" placeholder="000.000.000-00" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-rg" className="mb-1 block text-xs font-medium text-slate-600">
            RG
          </label>
          <input id="cliente-rg" name="rg" placeholder="Opcional" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-nacionalidade" className="mb-1 block text-xs font-medium text-slate-600">
            Nacionalidade
          </label>
          <input id="cliente-nacionalidade" name="nationality" defaultValue="brasileiro(a)" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-estado-civil" className="mb-1 block text-xs font-medium text-slate-600">
            Estado Civil
          </label>
          <input id="cliente-estado-civil" name="maritalStatus" placeholder="Ex.: casado(a), solteiro(a)" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-profissao" className="mb-1 block text-xs font-medium text-slate-600">
            Profissão
          </label>
          <input id="cliente-profissao" name="profession" placeholder="Ex.: empresário(a), médico(a)" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-documento" className="mb-1 block text-xs font-medium text-slate-600">
            Documento auxiliar (se diferente)
          </label>
          <input id="cliente-documento" name="document" placeholder="Opcional" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-email" className="mb-1 block text-xs font-medium text-slate-600">
            E-mail
          </label>
          <input id="cliente-email" name="email" type="email" placeholder="cliente@dominio.com" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-telefone" className="mb-1 block text-xs font-medium text-slate-600">
            WhatsApp / Telefone
          </label>
          <input id="cliente-telefone" name="phone" placeholder="(85) 99999-9999" className={FIELD} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Endereço para Contrato</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="logradouro" placeholder="Logradouro / Rua" className={`${FIELD} sm:col-span-2`} />
          <input name="numero" placeholder="Número" className={FIELD} />
          <input name="complemento" placeholder="Complemento" className={FIELD} />
          <input name="bairro" placeholder="Bairro" className={FIELD} />
          <input name="cep" placeholder="CEP" className={FIELD} />
          <input name="city" placeholder="Cidade (ex.: Fortaleza)" className={`${FIELD} sm:col-span-2`} />
          <input name="state" placeholder="UF (ex.: CE)" className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="cliente-notas" className="mb-1 block text-xs font-medium text-slate-600">
          Notas
        </label>
        <textarea id="cliente-notas" name="notes" placeholder="Opcional" className={`${FIELD} py-2`} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Criando…" : "Criar cliente"}
        </button>
        {message ? <span className={`text-xs ${erro ? "text-rose-600" : "text-emerald-700"}`}>{message}</span> : null}
      </div>
    </form>
  );
}
