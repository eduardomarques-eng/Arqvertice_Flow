"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { parseAndValidateSheetName } from "@/lib/acervo/naming-engine";

export function AcervoUploadRevisionModal({
  projectId,
  initialCode,
  initialTitle,
  initialDiscipline = "ARQUITETURA",
  initialPhase = "PROJETO_EXECUTIVO",
  namingMaskExample,
  isOpen,
  onClose,
  onSuccess,
}: {
  projectId: string;
  initialCode?: string;
  initialTitle?: string;
  initialDiscipline?: string;
  initialPhase?: string;
  namingMaskExample?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState(initialCode || "");
  const [title, setTitle] = useState(initialTitle || "");
  const [discipline, setDiscipline] = useState(initialDiscipline);
  const [phase, setPhase] = useState(initialPhase);
  const [fileName, setFileName] = useState(initialCode ? `${initialCode}-R01.pdf` : "");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState<"PDF" | "DWG" | "RVT" | "IFC" | "DXF" | "IMG">("PDF");
  const [viewFileName, setViewFileName] = useState("");
  const [viewUrl, setViewUrl] = useState("");
  const [viewFileType, setViewFileType] = useState<"PDF" | "DXF" | "IFC" | "IMG">("PDF");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const namingCheck = useMemo(() => {
    if (!fileName.trim()) return null;
    return parseAndValidateSheetName(fileName);
  }, [fileName]);

  if (!isOpen) return null;

  function handleLocalFilePick(e: React.ChangeEvent<HTMLInputElement>, target: "PRIMARY" | "PREVIEW") {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toUpperCase() || "PDF";
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (target === "PRIMARY") {
        setFileName(file.name);
        setFileUrl(dataUrl || `https://storage.arqvertice.com.br/acervo/${file.name}`);
        if (["PDF", "DWG", "RVT", "IFC", "DXF", "IMG"].includes(ext)) {
          setFileType(ext as typeof fileType);
        }
        if (!code) {
          setCode(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]R[0-9]{2}$/i, "").toUpperCase());
        }
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      } else {
        setViewFileName(file.name);
        setViewUrl(dataUrl || `https://storage.arqvertice.com.br/acervo/${file.name}`);
        if (["PDF", "DXF", "IFC", "IMG"].includes(ext)) {
          setViewFileType(ext as typeof viewFileType);
        }
      }
    };
    if (file.size <= 5 * 1024 * 1024) {
      reader.readAsDataURL(file);
    } else {
      // Para arquivos CAD/BIM grandes (> 5MB), registra referência técnica segura
      const fallbackUrl = `https://storage.arqvertice.com.br/acervo/${file.name}`;
      if (target === "PRIMARY") {
        setFileName(file.name);
        setFileUrl(fallbackUrl);
      } else {
        setViewFileName(file.name);
        setViewUrl(fallbackUrl);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!fileName.trim() || !fileUrl.trim()) {
      setErrorMsg("Informe o arquivo principal (.pdf, .dwg, .rvt ou .ifc) ou sua URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/acervo/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          code: code.trim() || undefined,
          title: title.trim() || fileName.replace(/\.[^/.]+$/, ""),
          discipline,
          phase,
          fileName: fileName.trim(),
          fileUrl: fileUrl.trim(),
          fileType,
          viewFileName: viewFileName.trim() || undefined,
          viewUrl: viewUrl.trim() || undefined,
          viewFileType: viewUrl.trim() ? viewFileType : undefined,
          description: description.trim() || undefined,
          emitAutoGrd: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Erro ao registrar nova revisão.");
      } else {
        onSuccess();
      }
    } catch {
      setErrorMsg("Falha de comunicação com o servidor CDE.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-slate-200/60 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Ciclo de Vida CDE · Emissão Automática de GRD
            </span>
            <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
              {initialCode ? `Subir Nova Revisão — ${initialCode}` : "Nova Prancha / Modelo BIM"}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
              Código da Prancha *
            </label>
            <input
              type="text"
              required
              placeholder="EMP-ARQ-PE-PLN-001"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs text-slate-900 focus:border-[#18181B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
              Disciplina
            </label>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#18181B] focus:outline-none"
            >
              <option value="ARQUITETURA">Arquitetura</option>
              <option value="ESTRUTURAL">Estrutura</option>
              <option value="ELETRICO">Instalações Elétricas</option>
              <option value="HIDROSSANITARIO">Hidrossanitário</option>
              <option value="FACHADAS">Fachadas / Esquadrias</option>
              <option value="INTERIORES">Interiores</option>
              <option value="COMPATIBILIZACAO">Compatibilização BIM</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
              Título da Prancha *
            </label>
            <input
              type="text"
              required
              placeholder="Planta Baixa — Pavimento Tipo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:border-[#18181B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
              Fase do Projeto
            </label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#18181B] focus:outline-none"
            >
              <option value="ESTUDO_PRELIMINAR">Estudo Preliminar</option>
              <option value="ANTEPROJETO">Anteprojeto</option>
              <option value="PROJETO_LEGAL">Projeto Legal</option>
              <option value="PROJETO_EXECUTIVO">Executivo</option>
              <option value="DETALHAMENTO">As Built / Detalhamento</option>
            </select>
          </div>
        </div>

        {/* Arquivo Principal */}
        <div className="rounded-xl border border-slate-200/80 bg-[#F5F5F7] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">
              1. Arquivo Principal (.pdf, .dwg, .rvt, .ifc, .dxf)
            </span>
            <label className="cursor-pointer rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition">
              Selecionar Arquivo
              <input
                type="file"
                accept=".pdf,.dwg,.rvt,.ifc,.dxf,.png,.jpg"
                className="hidden"
                onChange={(e) => handleLocalFilePick(e, "PRIMARY")}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Nome (ex: ARQ-PE-PLN-001-R01.pdf)"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="sm:col-span-2 h-8 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-[11px] text-slate-800"
            />
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value as typeof fileType)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
            >
              <option value="PDF">PDF</option>
              <option value="DWG">DWG (AutoCAD)</option>
              <option value="RVT">RVT (Revit)</option>
              <option value="IFC">IFC (BIM 3D)</option>
              <option value="DXF">DXF (CAD Web)</option>
              <option value="IMG">Imagem</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="URL do arquivo (preenchida ao selecionar arquivo ou cole link)"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700"
          />

          {namingCheck && (
            <p className={`text-[11px] font-medium ${namingCheck.isValid ? "text-emerald-700" : "text-amber-700"}`}>
              {namingCheck.isValid
                ? `✓ Nomenclatura CDE validada (${namingCheck.fullCode})`
                : `⚠ ${namingCheck.error}${namingMaskExample ? ` · Exemplo: ${namingMaskExample}` : ""}`}
            </p>
          )}
        </div>

        {/* Arquivo Pareado Web (Opcional) */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              2. Par de Visualização Web (Opcional: .pdf, .dxf ou .ifc)
            </span>
            <label className="cursor-pointer rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition">
              Anexar Par Web
              <input
                type="file"
                accept=".pdf,.dxf,.ifc,.png,.jpg"
                className="hidden"
                onChange={(e) => handleLocalFilePick(e, "PREVIEW")}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Nome do par (ex: modelo.ifc)"
              value={viewFileName}
              onChange={(e) => setViewFileName(e.target.value)}
              className="sm:col-span-2 h-8 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-[11px] text-slate-800"
            />
            <select
              value={viewFileType}
              onChange={(e) => setViewFileType(e.target.value as typeof viewFileType)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
            >
              <option value="PDF">PDF</option>
              <option value="DXF">DXF</option>
              <option value="IFC">IFC 3D</option>
              <option value="IMG">Imagem</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="URL do arquivo pareado (opcional)"
            value={viewUrl}
            onChange={(e) => setViewUrl(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
            Notas da Revisão / Motivo da Emissão
          </label>
          <input
            type="text"
            placeholder="Ex: Ajuste de cota do shaft hidráulico conforme compatibilização"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#18181B] focus:outline-none"
          />
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="bg-[#18181B] text-white hover:bg-zinc-800"
          >
            {isSubmitting ? "Publicando..." : "Publicar Revisão & Emitir GRD"}
          </Button>
        </div>
      </form>
    </div>
  );
}
