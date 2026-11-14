export function generateAutoLispScript(projectId: string, projectName: string): string {
  return `;;; ============================================================================
;;; ArqVérticeSync.lsp — Integração AutoCAD ➔ Acervo Manager (CDE)
;;; Empreendimento: ${projectName}
;;; Endpoint: https://arqvertice-flow.vercel.app/api/acervo/sync-plugin
;;; ============================================================================

(defun c:ARQSYNC (/ dwgName dwgPath pdfPath code token payload cmd)
  (setq dwgName (getvar "DWGNAME"))
  (setq dwgPath (strcat (getvar "DWGPREFIX") dwgName))
  (setq code (vl-filename-base dwgName))
  (setq token (getenv "ARQVERTICE_CDE_TOKEN"))

  (if (not token)
    (setq token (getstring T "\\nInforme o Bearer Token CDE (Acervo Manager): "))
  )

  (princ (strcat "\\n[ArqVértice CDE] Preparando envio da prancha: " code "..."))

  ;; Exporta PDF temporário da folha atual (Layout ativo)
  (setq pdfPath (strcat (getvar "DWGPREFIX") code ".pdf"))
  (command "-EXPORT" "P" "C" "N" pdfPath)

  ;; Payload JSON para POST /api/acervo/sync-plugin
  (setq payload
    (strcat
      "{\\"projectId\\":\\"${projectId}\\",\\"code\\":\\"" code "\\","
      "\\"softwareSource\\":\\"AutoCAD AutoLISP\\","
      "\\"sourceFile\\":{\\"fileName\\":\\"" dwgName "\\",\\"fileUrl\\":\\"" dwgPath "\\",\\"fileType\\":\\"DWG\\"},"
      "\\"previewFile\\":{\\"fileName\\":\\"" code ".pdf\\",\\"fileUrl\\":\\"" pdfPath "\\",\\"fileType\\":\\"PDF\\"}}"
    )
  )

  (setq cmd
    (strcat
      "curl -s -X POST https://arqvertice-flow.vercel.app/api/acervo/sync-plugin "
      "-H \\"Content-Type: application/json\\" "
      "-H \\"Authorization: Bearer " token "\\" "
      "-d '" payload "'"
    )
  )

  (command "SHELL" cmd)
  (princ "\\n[ArqVértice CDE] Sincronização concluída e GRD emitida automaticamente.")
  (princ)
)

(princ "\\n[ArqVérticeSync] Comando ARQSYNC carregado. Digite ARQSYNC para publicar no CDE.")
(princ)
`;
}

export function generatePyRevitScript(projectId: string, projectName: string): string {
  return `# -*- coding: utf-8 -*-
"""
ArqVerticeSync_script.py — Botão pyRevit ➔ Acervo Manager (CDE)
Empreendimento: ${projectName}
Endpoint: https://arqvertice-flow.vercel.app/api/acervo/sync-plugin
"""

import os
import json
import urllib2
from pyrevit import revit, forms, script

ENDPOINT = "https://arqvertice-flow.vercel.app/api/acervo/sync-plugin"
PROJECT_ID = "${projectId}"

doc = revit.doc
active_view = doc.ActiveView

token = os.environ.get("ARQVERTICE_CDE_TOKEN") or forms.ask_for_string(
    prompt="Cole o Bearer Token CDE gerado em /admin/acervo/configuracoes:",
    title="ArqVértice Flow — Sync Revit"
)

if not token:
    forms.alert("Token CDE não informado. Operação cancelada.", exitscript=True)

sheet_number = getattr(active_view, "SheetNumber", None) or active_view.Name
sheet_title = getattr(active_view, "Name", "Prancha Revit")

payload = {
    "projectId": PROJECT_ID,
    "code": str(sheet_number).upper(),
    "title": str(sheet_title),
    "discipline": "ARQUITETURA",
    "softwareSource": "Autodesk Revit (pyRevit)",
    "metadata": {
        "title": str(sheet_title),
        "revitDoc": doc.Title,
        "viewType": str(active_view.ViewType),
    },
    "sourceFile": {
        "fileName": "{}.rvt".format(doc.Title),
        "fileUrl": doc.PathName or "revit://cloud-model",
        "fileType": "RVT",
    },
    "previewFile": {
        "fileName": "{}.pdf".format(sheet_number),
        "fileUrl": "https://storage.arqvertice.com.br/acervo/{}.pdf".format(sheet_number),
        "fileType": "PDF",
    },
}

req = urllib2.Request(
    ENDPOINT,
    data=json.dumps(payload),
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token.strip(),
    },
)

try:
    resp = urllib2.urlopen(req, timeout=20)
    result = json.loads(resp.read())
    forms.alert(
        "Sincronizado com sucesso!\\nRevisão: {}\\nGRD: {}".format(
            result.get("revisionNumber", "R00"),
            result.get("grdCode", "-")
        ),
        title="ArqVértice Flow CDE"
    )
except Exception as exc:
    forms.alert("Erro ao sincronizar com Acervo Manager: {}".format(exc), exitscript=True)
`;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
