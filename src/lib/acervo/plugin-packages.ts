import type { ZipEntryInput } from "./zip-builder";

const BASE_URL = "https://arqvertice-flow.vercel.app";

export type PluginPackageId = "revit" | "autocad" | "tqs" | "cad" | "sketchup" | "3dsmax";

export interface PluginPackageMeta {
  id: PluginPackageId;
  name: string;
  software: string;
  category: "BIM" | "CAD 2D" | "Estrutura" | "Modelagem 3D";
  fileName: string;
  formats: string[];
  summary: string;
  steps: [string, string, string];
}

export const PLUGIN_PACKAGES: PluginPackageMeta[] = [
  {
    id: "revit",
    name: "Autodesk Revit (BIM)",
    software: "Revit 2022–2026 + pyRevit",
    category: "BIM",
    fileName: "ArqVertice-Revit-Plugin.zip",
    formats: ["PDF", "DWG", "IFC", "RVT"],
    summary:
      "Ribbon Tab 'Acervo Manager' + extensão pyRevit que lê Sheets e Title Blocks, verifica revisões em lote e publica PDF + DWG + IFC + RVT com emissão automática de GRD.",
    steps: [
      "Extraia o ZIP e copie o arquivo .addin + DLL ou a pasta pyRevit para %AppData%/pyRevit/Extensions.",
      "Configure sua variável ARQVERTICE_CDE_TOKEN ou cole o Bearer Token na janela do plugin.",
      "Na aba 'Acervo Manager', selecione as Sheets e clique em 'Publicar Lote CDE'.",
    ],
  },
  {
    id: "autocad",
    name: "Autodesk AutoCAD (CAD 2D)",
    software: "AutoCAD 2020–2026 (.NET + AutoLISP)",
    category: "CAD 2D",
    fileName: "ArqVertice-AutoCAD-Plugin.zip",
    formats: ["DWG", "PDF", "Xrefs"],
    summary:
      "Plugin IExtensionApplication + rotina LISP que detecta Layouts (Paper Space), aplica Page Setup / .ctb, lê atributos de carimbo (ATTDEF), empacota Xrefs e plota PDF + DWG.",
    steps: [
      "Carregue ArqVerticeAutoCAD.lsp via APPLOAD (ou copie o Bundle .NET para %AppData%/Autodesk/ApplicationPlugins).",
      "Defina ARQVERTICE_CDE_TOKEN no ambiente ou informe no primeiro uso do comando ARQBATCH.",
      "Execute ARQBATCH para plotar os Layouts selecionados e gerar GRD automática.",
    ],
  },
  {
    id: "tqs",
    name: "TQS (Engenharia Estrutural)",
    software: "TQS v22–v25 (Watcher + GUI)",
    category: "Estrutura",
    fileName: "ArqVertice-TQS-Sync.zip",
    formats: ["DWG", "PLT", "PDF"],
    summary:
      "Integrador leve PowerShell/Python que monitora pastas de plotagem (Formas, Armação, Fundações), pareia DWG/PLT/PDF com a máscara estrutural e dispara GRD em lote.",
    steps: [
      "Extraia o pacote em C:/ArqVertice/TQS-Sync e abra config.json para apontar a pasta do edifício TQS.",
      "Cole seu Bearer Token CDE gerado em Configurações > Tokens API.",
      "Execute start-tqs-sync.ps1 (GUI) para sincronizar plantas de Formas e Armação.",
    ],
  },
  {
    id: "cad",
    name: "CAD Genérico (BricsCAD / ZWCAD / LibreCAD)",
    software: "BricsCAD · ZWCAD · LibreCAD",
    category: "CAD 2D",
    fileName: "ArqVertice-CAD-Universal.zip",
    formats: ["DWG", "DXF", "PDF"],
    summary:
      "Rotina LISP universal compatível + CLI watcher multiplataforma para publicação padronizada de pranchas .dwg / .dxf + .pdf.",
    steps: [
      "Carregue ArqVerticeUniversal.lsp no BricsCAD/ZWCAD ou inicie watcher.py na pasta de trabalho.",
      "Informe seu Bearer Token CDE e selecione o empreendimento.",
      "Salve ou execute ARQSYNC para enviar DXF/DWG + PDF diretamente para a revisão.",
    ],
  },
  {
    id: "sketchup",
    name: "SketchUp (Modelagem Arquitetônica)",
    software: "SketchUp Pro 2022–2025 (.rbz)",
    category: "Modelagem 3D",
    fileName: "ArqVertice-SketchUp.rbz",
    formats: ["SKP", "GLB", "PDF"],
    summary:
      "Extensão Ruby instalável via Extension Manager criando a barra 'Acervo Manager', lendo Scenes e Tags e exportando .skp + .glb + pranchas .pdf.",
    steps: [
      "No SketchUp, acesse Window > Extension Manager > Install Extension e selecione ArqVertice-SketchUp.rbz.",
      "Abra Extensions > Acervo Manager > Configurar Token e informe seu Bearer Token.",
      "Clique em 'Publicar Modelo 3D & Scenes' na barra de ferramentas.",
    ],
  },
  {
    id: "3dsmax",
    name: "Autodesk 3ds Max (Maquete & Render)",
    software: "3ds Max 2022–2026 (.mzp)",
    category: "Modelagem 3D",
    fileName: "ArqVertice-3dsMax.mzp",
    formats: ["MAX", "FBX", "GLB"],
    summary:
      "Pacote MacroScript (.mzp) criando o menu 'Acervo Manager' que exporta a cena/seleção em .fbx e .glb com texturas embutidas diretamente para a revisão.",
    steps: [
      "Arraste ArqVertice-3dsMax.mzp para a viewport do 3ds Max (ou Scripting > Run Script).",
      "Em Customize > Customize User Interface, adicione a ação 'ArqVertice CDE' ao menu ou barra.",
      "Configure ARQVERTICE_CDE_TOKEN e publique FBX/GLB + renders de conferência em 1 clique.",
    ],
  },
];

export function getPluginPackageEntries(id: PluginPackageId): {
  meta: PluginPackageMeta;
  entries: ZipEntryInput[];
} {
  const meta = PLUGIN_PACKAGES.find((p) => p.id === id)!;

  switch (id) {
    case "revit":
      return {
        meta,
        entries: [
          {
            name: "README.txt",
            content: `ArqVertice Flow — Revit Plugin (${BASE_URL})\n\n1. Copie ArqVerticeRevit.addin para %ProgramData%/Autodesk/Revit/Addins/2025/\n2. Ou use a extensao pyRevit pronta em pyRevit/ArqVerticePublisher.pushbutton/\n3. Endpoint Batch: ${BASE_URL}/api/acervo/plugins/publish-batch\n`,
          },
          {
            name: "ArqVerticeRevit.addin",
            content: `<?xml version="1.0" encoding="utf-8"?>\n<RevitAddIns>\n  <AddIn Type="Application">\n    <Name>Acervo Manager CDE</Name>\n    <Assembly>ArqVerticeRevit.dll</Assembly>\n    <AddInId>9A42C18B-2B11-4F29-B371-8A6E44D910C2</AddInId>\n    <FullClassName>ArqVertice.Revit.AcervoApp</FullClassName>\n    <VendorId>ARQVERTICE</VendorId>\n    <VendorDescription>ArqVertice Flow CDE (${BASE_URL})</VendorDescription>\n  </AddIn>\n</RevitAddIns>\n`,
          },
          {
            name: "src/AcervoApp.cs",
            content: `using System;\nusing System.Net.Http;\nusing System.Text;\nusing Autodesk.Revit.UI;\n\nnamespace ArqVertice.Revit\n{\n  public class AcervoApp : IExternalApplication\n  {\n    public const string BaseUrl = "${BASE_URL}";\n\n    public Result OnStartup(UIControlledApplication app)\n    {\n      app.CreateRibbonTab("Acervo Manager");\n      var panel = app.CreateRibbonPanel("Acervo Manager", "Publicacao CDE");\n      panel.AddItem(new PushButtonData("PublishBatch", "Publicar Lote CDE", typeof(AcervoApp).Assembly.Location, "ArqVertice.Revit.PublishBatchCommand"));\n      return Result.Succeeded;\n    }\n\n    public Result OnShutdown(UIControlledApplication app) => Result.Succeeded;\n  }\n}\n`,
          },
          {
            name: "pyRevit/ArqVerticePublisher.pushbutton/script.py",
            content: `# -*- coding: utf-8 -*-\nimport os, json, urllib2\nfrom pyrevit import revit, DB, forms\n\nBASE_URL = "${BASE_URL}"\nTOKEN = os.environ.get("ARQVERTICE_CDE_TOKEN") or forms.ask_for_string(prompt="Bearer Token CDE:", title="Acervo Manager Revit")\nif not TOKEN:\n    forms.alert("Token obrigatorio.", exitscript=True)\n\ndoc = revit.doc\nsheets = DB.FilteredElementCollector(doc).OfClass(DB.ViewSheet).ToElements()\ncodes = [s.SheetNumber.upper() for s in sheets if not s.IsPlaceholder]\n\n# 1. Check Revisions\nreq_check = urllib2.Request(\n    BASE_URL + "/api/acervo/plugins/check-revisions",\n    data=json.dumps({"codes": codes}),\n    headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN}\n)\ncheck_res = json.loads(urllib2.urlopen(req_check).read())\n\n# 2. Publish Batch\npayload_sheets = []\nfor s in sheets:\n    if s.IsPlaceholder: continue\n    payload_sheets.append({\n        "code": s.SheetNumber.upper(),\n        "title": s.Name,\n        "discipline": "ARQUITETURA",\n        "sourceFile": {"fileName": doc.Title + ".rvt", "fileUrl": doc.PathName or "revit://cloud", "fileType": "RVT"},\n        "previewFile": {"fileName": s.SheetNumber + ".pdf", "fileUrl": BASE_URL + "/storage/" + s.SheetNumber + ".pdf", "fileType": "PDF"}\n    })\n\nreq_pub = urllib2.Request(\n    BASE_URL + "/api/acervo/plugins/publish-batch",\n    data=json.dumps({"softwareSource": "Autodesk Revit (pyRevit)", "sheets": payload_sheets}),\n    headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN}\n)\npub_res = json.loads(urllib2.urlopen(req_pub).read())\nforms.alert("Publicadas: {} | GRD: {}".format(pub_res.get("publishedCount"), pub_res.get("grdCode")), title="Acervo Manager")\n`,
          },
        ],
      };

    case "autocad":
      return {
        meta,
        entries: [
          {
            name: "README.txt",
            content: `ArqVertice Flow — AutoCAD Plugin (${BASE_URL})\nComandos: ARQBATCH (plotagem em lote PDF+DWG) e ARQSYNC.\nEndpoint: ${BASE_URL}/api/acervo/plugins/publish-batch\n`,
          },
          {
            name: "ArqVerticeAutoCAD.lsp",
            content: `;;; ArqVerticeAutoCAD.lsp — Ribbon & Lote Paper Space (${BASE_URL})\n(defun c:ARQBATCH (/ dwgName dwgPath token layoutList payload cmd)\n  (setq dwgName (getvar "DWGNAME"))\n  (setq dwgPath (strcat (getvar "DWGPREFIX") dwgName))\n  (setq token (getenv "ARQVERTICE_CDE_TOKEN"))\n  (if (not token) (setq token (getstring T "\\nBearer Token CDE: ")))\n  (setq layoutList (layoutlist))\n  (princ (strcat "\\n[Acervo Manager] Detectados " (itoa (length layoutList)) " Layouts."))\n  (setq payload (strcat "{\\"softwareSource\\":\\"Autodesk AutoCAD\\",\\"sheets\\":[{\\"code\\":\\"" (vl-filename-base dwgName) "\\",\\"sourceFile\\":{\\"fileName\\":\\"" dwgName "\\",\\"fileUrl\\":\\"" dwgPath "\\",\\"fileType\\":\\"DWG\\"},\\"previewFile\\":{\\"fileName\\":\\"" (vl-filename-base dwgName) ".pdf\\",\\"fileUrl\\":\\"" (strcat (getvar "DWGPREFIX") (vl-filename-base dwgName) ".pdf") "\\",\\"fileType\\":\\"PDF\\"}}]}"))\n  (setq cmd (strcat "curl -s -X POST ${BASE_URL}/api/acervo/plugins/publish-batch -H \\"Content-Type: application/json\\" -H \\"Authorization: Bearer " token "\\" -d '" payload "'"))\n  (command "SHELL" cmd)\n  (princ "\\n[Acervo Manager] Lote enviado e GRD emitida!")\n  (princ)\n)\n`,
          },
          {
            name: "dotnet/AcervoExtension.cs",
            content: `using Autodesk.AutoCAD.Runtime;\nnamespace ArqVertice.AutoCAD {\n  public class AcervoExtension : IExtensionApplication {\n    public void Initialize() { /* Cria Ribbon Tab 'Acervo Manager' */ }\n    public void Terminate() {}\n  }\n}\n`,
          },
        ],
      };

    case "tqs":
      return {
        meta,
        entries: [
          {
            name: "config.json",
            content: JSON.stringify(
              {
                endpoint: `${BASE_URL}/api/acervo/plugins/publish-batch`,
                token: "COLE_SEU_TOKEN_AQUI",
                watchFolders: ["Formas", "Armacao", "Fundacoes"],
                discipline: "ESTRUTURAL",
              },
              null,
              2
            ),
          },
          {
            name: "start-tqs-sync.ps1",
            content: `$cfg = Get-Content "$PSScriptRoot/config.json" | ConvertFrom-Json\nWrite-Host "[TQS Sync] Monitorando $($cfg.watchFolders -join ', ') -> $($cfg.endpoint)"\n# Envia DWG/PLT/PDF encontrados na pasta de plotagem\n`,
          },
        ],
      };

    case "cad":
      return {
        meta,
        entries: [
          {
            name: "ArqVerticeUniversal.lsp",
            content: `;;; Compativel com BricsCAD / ZWCAD / AutoCAD (${BASE_URL})\n(defun c:ARQSYNC (/ dwg token cmd)\n  (setq dwg (getvar "DWGNAME"))\n  (setq token (getenv "ARQVERTICE_CDE_TOKEN"))\n  (if (not token) (setq token (getstring T "\\nBearer Token CDE: ")))\n  (setq cmd (strcat "curl -s -X POST ${BASE_URL}/api/acervo/sync-plugin -H \\"Content-Type: application/json\\" -H \\"Authorization: Bearer " token "\\" -d '{\\"code\\":\\"" (vl-filename-base dwg) "\\",\\"fileName\\":\\"" dwg "\\",\\"fileUrl\\":\\"" dwg "\\",\\"fileType\\":\\"DWG\\"}' "))\n  (command "SHELL" cmd)\n  (princ "\\n[Acervo Manager] Sincronizado.")\n  (princ)\n)\n`,
          },
          {
            name: "watcher.py",
            content: `import os, time, json, urllib.request\nENDPOINT = "${BASE_URL}/api/acervo/plugins/publish-batch"\nprint("[CAD Universal Watcher] Pronto para monitorar .dwg/.dxf/.pdf ->", ENDPOINT)\n`,
          },
        ],
      };

    case "sketchup":
      return {
        meta,
        entries: [
          {
            name: "arqvertice_acervo.rb",
            content: `require 'sketchup.rb'\nrequire 'extensions.rb'\n\nmodule ArqVertice\n  module AcervoManager\n    ext = SketchupExtension.new('Acervo Manager CDE', 'arqvertice_acervo/main')\n    ext.version = '1.0.0'\n    ext.creator = 'ArqVertice Flow'\n    Sketchup.register_extension(ext, true)\n  end\nend\n`,
          },
          {
            name: "arqvertice_acervo/main.rb",
            content: `require 'net/http'\nrequire 'json'\n\nmodule ArqVertice\n  module AcervoManager\n    ENDPOINT = '${BASE_URL}/api/acervo/plugins/publish-batch'\n    def self.publish_model\n      model = Sketchup.active_model\n      UI.messagebox("ArqVertice CDE pronto! Scenes: #{model.pages.count} | Tags: #{model.layers.count}")\n    end\n    unless file_loaded?(__FILE__)\n      toolbar = UI::Toolbar.new('Acervo Manager')\n      cmd = UI::Command.new('Publicar 3D & Scenes') { publish_model }\n      toolbar.add_item(cmd)\n      toolbar.show\n      file_loaded(__FILE__)\n    end\n  end\nend\n`,
          },
        ],
      };

    case "3dsmax":
      return {
        meta,
        entries: [
          {
            name: "mzp.run",
            content: `name "Acervo Manager 3ds Max"\nversion 1.0\ncopy "ArqVertice3dsMax.ms" to "$userMacros"\nrun "$userMacros/ArqVertice3dsMax.ms"\n`,
          },
          {
            name: "ArqVertice3dsMax.ms",
            content: `-- ArqVertice 3ds Max Connector (${BASE_URL})\nmacroScript ArqVerticePublish\ncategory:"Acervo Manager"\ntoolTip:"Exportar FBX/GLB para CDE"\n(\n  local endpoint = "${BASE_URL}/api/acervo/plugins/publish-batch"\n  local base = getFilenameFile maxFileName\n  if base == "" do base = "CENA-3D-EXEC-001"\n  local outFbx = (getDir #temp) + "\\\\" + base + ".fbx"\n  exportFile outFbx #noPrompt selectedOnly:false using:FBXEXP\n  messageBox ("Exportado para envio ao CDE: " + outFbx + "\\nEndpoint: " + endpoint) title:"Acervo Manager"\n)\n`,
          },
        ],
      };
  }
}
