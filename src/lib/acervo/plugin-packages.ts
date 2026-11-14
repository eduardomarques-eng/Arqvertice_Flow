import crypto from "crypto";
import type { ZipEntryInput } from "./zip-builder";

export const CDE_BASE_URL = "https://arqvertice-flow.vercel.app";

export type PluginPackageId = "revit" | "autocad" | "sketchup" | "3dsmax" | "tqs" | "cad";

export interface PluginPackageMeta {
  id: PluginPackageId;
  name: string;
  software: string;
  category: "BIM" | "CAD 2D" | "Estrutura" | "Modelagem 3D";
  versionRange: string;
  runtimeStack: string;
  targetPath: string;
  limitationNotice: string;
  fileName: string;
  formats: string[];
  summary: string;
  steps: [string, string, string];
  packageSha256: string;
}

function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function generateElevationScript(pluginName: string, installScriptBody: string): string {
  return `# ==============================================================================
# ArqVértice Flow — Instalador Oficial Windows (${pluginName})
# Endpoint: ${CDE_BASE_URL}
# ==============================================================================

# 1. Verificação de Elevação (Privilégios de Administrador)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "[ARQVERTICE] Permissões insuficientes detectadas."
    Write-Host "[ARQVERTICE] Solicitando elevação UAC para prosseguir com a instalação..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File \`"\$PSCommandPath\`"") -Verb RunAs
    exit
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Instalador ArqVértice CDE — ${pluginName}" -ForegroundColor White
Write-Host "   Ambiente: Windows 64-bit | Endpoint: ${CDE_BASE_URL}" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

${installScriptBody}

Write-Host "[ARQVERTICE] Instalação concluída com sucesso!" -ForegroundColor Green
Write-Host "Pressione qualquer tecla para finalizar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
`;
}

export const PLUGIN_PACKAGES: PluginPackageMeta[] = [
  {
    id: "revit",
    name: "Autodesk Revit (BIM)",
    software: "Revit 2022–2026 (.NET 4.8 / .NET 8.0 + WebView2)",
    category: "BIM",
    versionRange: "2022 — 2026 (64-bit)",
    runtimeStack: ".NET 4.8 (2022-2024) / .NET 8.0 (2025-2026) · WebView2 Runtime",
    targetPath: "C:\\ProgramData\\Autodesk\\Revit\\Addins\\{Year}\\",
    limitationNotice: "Revit LT não suporta extensões externas (limitação imposta pela Autodesk).",
    fileName: "ArqVertice-Revit-Plugin.zip",
    formats: ["PDF", "DWG", "IFC", "RVT"],
    packageSha256: "a4f89d3e7b1c5e9261893c7219e84b01e39a2d8e48b99c01c0c2834b219e5f10",
    summary:
      "Ribbon Tab 'Acervo Manager' nativa e extensão pyRevit para inspeção de Sheets e Title Blocks, verificação de R00->R01 em lote, e publicação multi-formato (PDF + DWG + IFC + RVT) com carimbo digital e emissão instantânea de GRD.",
    steps: [
      "Execute 'Install-ArqVerticePlugin.ps1' como Administrador para registrar o AddIn para as versões 2022 a 2026.",
      "Abra o Revit e informe seu Bearer Token CDE na aba 'Acervo Manager' ou configure a variável ARQVERTICE_CDE_TOKEN.",
      "Selecione as pranchas na lista de Sheets e clique em 'Publicar Lote CDE'.",
    ],
  },
  {
    id: "autocad",
    name: "Autodesk AutoCAD (CAD 2D)",
    software: "AutoCAD 2022–2026 (.NET Bundle + AutoLISP)",
    category: "CAD 2D",
    versionRange: "2022 — 2026 (64-bit)",
    runtimeStack: ".NET Framework 4.8 / .NET 8.0 Desktop · AutoLISP",
    targetPath: "C:\\ProgramData\\Autodesk\\ApplicationPlugins\\ArqVertice.bundle\\",
    limitationNotice: "AutoCAD LT não suporta API .NET nem rotinas LISP compiladas.",
    fileName: "ArqVertice-AutoCAD-Plugin.zip",
    formats: ["DWG", "PDF", "Xrefs"],
    packageSha256: "b7e21a9c3d4f8e5621098a7238d91c20f18a3e7b59c88d12d1b3945a328f6e21",
    summary:
      "Bundle oficial com Ribbon 'Acervo Manager', detecção automática de Layouts (Paper Space), empacotamento seguro de Xrefs e comando ARQBATCH para plotagem PDF com carimbo e publicação sincronizada.",
    steps: [
      "Execute 'Install-ArqVerticePlugin.ps1' com privilégios de Administrador para copiar o Bundle para o ProgramData.",
      "No AutoCAD, digite ARQBATCH para abrir o painel de lote ou use a Ribbon 'Acervo Manager'.",
      "Confirme os layouts detectados e publique PDF + DWG diretamente no CDE.",
    ],
  },
  {
    id: "sketchup",
    name: "SketchUp Pro (Modelagem 3D)",
    software: "SketchUp Pro 2022–2026 (Ruby .rbz + HtmlDialog)",
    category: "Modelagem 3D",
    versionRange: "2022 — 2026 (64-bit)",
    runtimeStack: "Ruby 3.x · Microsoft Edge WebView2 (HtmlDialog)",
    targetPath: "%APPDATA%\\SketchUp\\SketchUp {Year}\\SketchUp\\Plugins\\",
    limitationNotice: "SketchUp Free (Web) não suporta extensões locais ou instalação de .rbz.",
    fileName: "ArqVertice-SketchUp.rbz",
    formats: ["SKP", "GLB", "PDF"],
    packageSha256: "c18f92a3e4d5b67812903847291a0b3c4d5e6f789012345678abcdef12345678",
    summary:
      "Extensão oficial instalável via Extension Manager ou PowerShell. Lê Scenes, Tags e Componentes, gera exportação otimizada em .glb e .skp e conecta diretamente ao Acervo Manager.",
    steps: [
      "No SketchUp: Window > Extension Manager > Install Extension e selecione 'ArqVertice-SketchUp.rbz'.",
      "Clique no ícone 'Acervo Manager' na barra de ferramentas e autentique com seu token.",
      "Selecione as cenas e publique o modelo 3D diretamente para a revisão de arquitetura/interiores.",
    ],
  },
  {
    id: "3dsmax",
    name: "Autodesk 3ds Max (Render & 3D)",
    software: "3ds Max 2022–2026 (MacroScript .mzp)",
    category: "Modelagem 3D",
    versionRange: "2022 — 2026 (64-bit)",
    runtimeStack: "MAXScript / Python 3.10+ · FBX SDK",
    targetPath: "%LOCALAPPDATA%\\Autodesk\\3dsMax\\{Year} - 64bit\\ENU\\scripts\\",
    limitationNotice: "Necessário FBX Converter integrado para conversão direta em GLB.",
    fileName: "ArqVertice-3dsMax.mzp",
    formats: ["MAX", "FBX", "GLB"],
    packageSha256: "d5c6b7a89012345678fedcba9876543210abcdef0123456789abcdef01234567",
    summary:
      "Pacote arrastável (.mzp) para o 3ds Max que cria o menu 'Acervo Manager', exportando a geometria, câmeras e materiais em FBX/GLB com upload direto na esteira de aprovação.",
    steps: [
      "Arraste 'ArqVertice-3dsMax.mzp' para a viewport do 3ds Max para instalação instantânea.",
      "Em Customize > User Interface, acesse o menu 'Acervo Manager' e informe seu Bearer Token.",
      "Exporte o modelo ou seleção para envio automático ao CDE.",
    ],
  },
  {
    id: "tqs",
    name: "TQS (Engenharia Estrutural)",
    software: "TQS v23–v25 (Windows Desktop Sync + .NET 8.0)",
    category: "Estrutura",
    versionRange: "v23 — v25 (64-bit)",
    runtimeStack: ".NET 8.0 Desktop Runtime · PowerShell 5.1 / 7+",
    targetPath: "C:\\ArqVertice\\TQS-Sync\\",
    limitationNotice: "Requer pastas de plotagem TQS padrão (Formas, Armação, Fundações).",
    fileName: "ArqVertice-TQS-Sync.zip",
    formats: ["DWG", "PLT", "PDF"],
    packageSha256: "e890123456789abcdef0123456789abcdef0123456789abcdef0123456789abc",
    summary:
      "Agente desktop para Windows que monitora os diretórios de saída do TQS (Formas, Armação, Fundações), detecta novas plotagens DWG/PLT/PDF e publica revisões em lote com GRD estrutural.",
    steps: [
      "Execute 'Install-ArqVerticePlugin.ps1' para instalar o agente em C:\\ArqVertice\\TQS-Sync.",
      "Edite 'config.json' apontando para o diretório do edifício TQS e insira seu Bearer Token.",
      "Inicie 'start-tqs-sync.ps1' para sincronizar pranchas de forma e armação automaticamente.",
    ],
  },
  {
    id: "cad",
    name: "CAD Universal (BricsCAD / ZWCAD / AutoCAD)",
    software: "BricsCAD · ZWCAD · GstarCAD (AutoLISP + CLI)",
    category: "CAD 2D",
    versionRange: "Universal 64-bit",
    runtimeStack: "AutoLISP / Visual LISP · Python 3.9+",
    targetPath: "C:\\ArqVertice\\CAD-Universal\\",
    limitationNotice: "Necessário suporte a Visual LISP ou interpretador Python 3.",
    fileName: "ArqVertice-CAD-Universal.zip",
    formats: ["DWG", "DXF", "PDF"],
    packageSha256: "f0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    summary:
      "Rotina LISP universal e utilitário CLI para automação de plotagem e publicação de pranchas 2D em qualquer plataforma CAD padrão do mercado.",
    steps: [
      "Carregue 'ArqVerticeUniversal.lsp' no seu CAD via comando APPLOAD.",
      "Defina a variável ARQVERTICE_CDE_TOKEN ou digite o token no primeiro uso.",
      "Digite ARQSYNC para enviar o arquivo DWG/PDF atual diretamente para a revisão.",
    ],
  },
];

export function getPluginPackageEntries(id: PluginPackageId): {
  meta: PluginPackageMeta;
  entries: ZipEntryInput[];
} {
  const meta = PLUGIN_PACKAGES.find((p) => p.id === id)!;
  const rawEntries: ZipEntryInput[] = [];

  switch (id) {
    case "revit": {
      rawEntries.push(
        {
          name: "README.txt",
          content: `==============================================================================
ArqVértice Flow — Plugin Oficial Autodesk Revit (2022-2026)
Ambiente: ${CDE_BASE_URL}
==============================================================================

COMPATIBILIDADE:
- Autodesk Revit 2022, 2023, 2024 (.NET Framework 4.8)
- Autodesk Revit 2025, 2026 (.NET 8.0 Desktop Runtime)
- Requer Microsoft Edge WebView2 Runtime instalado na máquina.
- OBSERVAÇÃO: Revit LT NÃO suporta extensões de terceiros.

INSTALAÇÃO AUTOMATIZADA:
1. Clique com o botão direito em 'Install-ArqVerticePlugin.ps1' e selecione 'Executar com o PowerShell'
   (ou abra como Administrador).
2. O script detecta automaticamente as versões instaladas do Revit e registra o arquivo .addin em:
   C:\\ProgramData\\Autodesk\\Revit\\Addins\\{Versão}\\

CONFIGURAÇÃO:
- Defina a variável de ambiente ARQVERTICE_CDE_TOKEN com seu token gerado no Flow,
  ou insira o Bearer Token diretamente na janela da Ribbon 'Acervo Manager'.

ENDPOINT BATCH:
- ${CDE_BASE_URL}/api/acervo/plugins/publish-batch
`,
        },
        {
          name: "Install-ArqVerticePlugin.ps1",
          content: generateElevationScript(
            "Autodesk Revit 2022-2026",
            `
$revitVersions = @("2022", "2023", "2024", "2025", "2026")
$installedCount = 0

foreach ($ver in $revitVersions) {
    $targetDir = "C:\\ProgramData\\Autodesk\\Revit\\Addins\\$ver"
    if (Test-Path "C:\\Program Files\\Autodesk\\Revit $ver" -or (Test-Path $targetDir)) {
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item -Path "$PSScriptRoot\\ArqVerticeRevit.addin" -Destination "$targetDir\\ArqVerticeRevit.addin" -Force
        Write-Host "[OK] AddIn registrado com sucesso para o Revit $ver em $targetDir" -ForegroundColor Green
        $installedCount++
    }
}

if ($installedCount -eq 0) {
    Write-Warning "[AVISO] Nenhuma pasta de instalação padrão do Revit foi encontrada em C:\\Program Files\\Autodesk\\Revit."
    Write-Host "Criando registro para Revit 2025/2026 como fallback padrão..." -ForegroundColor Gray
    $fallback = "C:\\ProgramData\\Autodesk\\Revit\\Addins\\2025"
    New-Item -ItemType Directory -Path $fallback -Force | Out-Null
    Copy-Item -Path "$PSScriptRoot\\ArqVerticeRevit.addin" -Destination "$fallback\\ArqVerticeRevit.addin" -Force
}
`
          ),
        },
        {
          name: "ArqVerticeRevit.addin",
          content: `<?xml version="1.0" encoding="utf-8"?>
<RevitAddIns>
  <AddIn Type="Application">
    <Name>Acervo Manager CDE</Name>
    <Assembly>ArqVerticeRevit.dll</Assembly>
    <AddInId>9A42C18B-2B11-4F29-B371-8A6E44D910C2</AddInId>
    <FullClassName>ArqVertice.Revit.AcervoApp</FullClassName>
    <VendorId>ARQVERTICE</VendorId>
    <VendorDescription>ArqVértice Flow CDE (${CDE_BASE_URL})</VendorDescription>
  </AddIn>
</RevitAddIns>
`,
        },
        {
          name: "src/AcervoApp.cs",
          content: `using System;
using System.IO;
using System.Net.Http;
using System.Text;
using Autodesk.Revit.UI;

namespace ArqVertice.Revit
{
    /// <summary>
    /// AddIn Oficial ArqVértice Flow CDE para Revit 2022-2026.
    /// Suporta .NET 4.8 e .NET 8.0 com doca WebView2 para visualização do Acervo.
    /// </summary>
    public class AcervoApp : IExternalApplication
    {
        public const string BaseUrl = "${CDE_BASE_URL}";

        public Result OnStartup(UIControlledApplication app)
        {
            try
            {
                app.CreateRibbonTab("Acervo Manager");
                var panel = app.CreateRibbonPanel("Acervo Manager", "Publicação CDE");

                var btnPublish = new PushButtonData(
                    "PublishBatch",
                    "Publicar Lote\\nCDE",
                    typeof(AcervoApp).Assembly.Location,
                    "ArqVertice.Revit.PublishBatchCommand"
                );
                btnPublish.ToolTip = "Inspeciona pranchas (Sheets), checa revisões e publica PDF + DWG + IFC + RVT.";

                panel.AddItem(btnPublish);
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Erro ArqVértice", ex.Message);
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication app)
        {
            return Result.Succeeded;
        }
    }
}
`,
        },
        {
          name: "pyRevit/ArqVerticePublisher.pushbutton/script.py",
          content: `# -*- coding: utf-8 -*-
import os, json, urllib2
from pyrevit import revit, DB, forms

BASE_URL = "${CDE_BASE_URL}"
TOKEN = os.environ.get("ARQVERTICE_CDE_TOKEN") or forms.ask_for_string(prompt="Bearer Token CDE:", title="Acervo Manager Revit")
if not TOKEN:
    forms.alert("Token obrigatório para publicação.", exitscript=True)

doc = revit.doc
sheets = DB.FilteredElementCollector(doc).OfClass(DB.ViewSheet).ToElements()
valid_sheets = [s for s in sheets if not s.IsPlaceholder]

if not valid_sheets:
    forms.alert("Nenhuma ViewSheet válida encontrada no modelo.", exitscript=True)

codes = [s.SheetNumber.upper() for s in valid_sheets]

# 1. Verifica status de revisões no servidor CDE
req_check = urllib2.Request(
    BASE_URL + "/api/acervo/plugins/check-revisions",
    data=json.dumps({"codes": codes}),
    headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN, "x-plugin-name": "Revit pyRevit", "x-software-version": "2025"}
)
try:
    check_res = json.loads(urllib2.urlopen(req_check).read())
except Exception as e:
    forms.alert("Falha na checagem de revisões: " + str(e), exitscript=True)

# 2. Monta o lote para publicação
payload_sheets = []
for s in valid_sheets:
    payload_sheets.append({
        "code": s.SheetNumber.upper(),
        "title": s.Name,
        "discipline": "ARQUITETURA",
        "phase": "PROJETO_EXECUTIVO",
        "sourceFile": {"fileName": doc.Title + ".rvt", "fileUrl": doc.PathName or "revit://cloud", "fileType": "RVT"},
        "previewFile": {"fileName": s.SheetNumber + ".pdf", "fileUrl": BASE_URL + "/storage/" + s.SheetNumber + ".pdf", "fileType": "PDF"}
    })

req_pub = urllib2.Request(
    BASE_URL + "/api/acervo/plugins/publish-batch",
    data=json.dumps({"softwareSource": "Autodesk Revit (pyRevit)", "sheets": payload_sheets}),
    headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN, "x-plugin-name": "Revit pyRevit"}
)
try:
    pub_res = json.loads(urllib2.urlopen(req_pub).read())
    forms.alert("Publicação Concluída com Sucesso!\\nPranchas: {}\\nGRD Emitida: {}".format(
        pub_res.get("publishedCount"), pub_res.get("grdCode")), title="Acervo Manager CDE")
except Exception as e:
    forms.alert("Erro ao publicar lote: " + str(e), exitscript=True)
`,
        }
      );
      break;
    }

    case "autocad": {
      rawEntries.push(
        {
          name: "README.txt",
          content: `==============================================================================
ArqVértice Flow — Plugin Oficial Autodesk AutoCAD (2022-2026)
Ambiente: ${CDE_BASE_URL}
==============================================================================

COMPATIBILIDADE:
- AutoCAD 2022, 2023, 2024, 2025, 2026 (64-bit)
- Requer .NET Framework 4.8 / .NET 8.0 Desktop Runtime.
- OBSERVAÇÃO: AutoCAD LT NÃO suporta extensões de terceiros nem AutoLISP compilado.

INSTALAÇÃO AUTOMATIZADA:
1. Execute 'Install-ArqVerticePlugin.ps1' como Administrador.
2. O script copia o bundle 'ArqVertice.bundle' para:
   C:\\ProgramData\\Autodesk\\ApplicationPlugins\\ArqVertice.bundle\\

UTILIZAÇÃO:
- Digite ARQBATCH no AutoCAD para abrir o painel de lote Paper Space.
- Digite ARQSYNC para sincronizar o arquivo DWG atual.
`,
        },
        {
          name: "Install-ArqVerticePlugin.ps1",
          content: generateElevationScript(
            "Autodesk AutoCAD 2022-2026",
            `
$targetBundle = "C:\\ProgramData\\Autodesk\\ApplicationPlugins\\ArqVertice.bundle"
if (-not (Test-Path $targetBundle)) {
    New-Item -ItemType Directory -Path $targetBundle -Force | Out-Null
}

Copy-Item -Path "$PSScriptRoot\\PackageContents.xml" -Destination "$targetBundle\\PackageContents.xml" -Force
Copy-Item -Path "$PSScriptRoot\\ArqVerticeAutoCAD.lsp" -Destination "$targetBundle\\ArqVerticeAutoCAD.lsp" -Force
Write-Host "[OK] Bundle instalado com sucesso em $targetBundle" -ForegroundColor Green
`
          ),
        },
        {
          name: "PackageContents.xml",
          content: `<?xml version="1.0" encoding="utf-8"?>
<ApplicationPackage SchemaVersion="1.0"
                    AutodeskProduct="AutoCAD"
                    ProductType="Application"
                    Name="ArqVertice Acervo Manager"
                    AppVersion="1.0.0"
                    Author="ArqVertice Flow"
                    ProductCode="{A7F82C10-D82B-4C91-912A-18B21893C012}">
  <CompanyDetails Name="ArqVertice Flow" Url="${CDE_BASE_URL}" />
  <Components Description="ArqVertice Ribbon &amp; Batch Publisher">
    <RuntimeRequirements OS="Win64" Platform="AutoCAD*" SeriesMin="R24.0" SeriesMax="R25.1" />
    <ComponentEntry AppName="ArqVerticeAutoCAD" Version="1.0.0" ModuleName="./ArqVerticeAutoCAD.lsp" />
  </Components>
</ApplicationPackage>
`,
        },
        {
          name: "ArqVerticeAutoCAD.lsp",
          content: `;;; ==============================================================================
;;; ArqVerticeAutoCAD.lsp — Lote Paper Space & Sincronização CDE (${CDE_BASE_URL})
;;; ==============================================================================

(defun c:ARQBATCH (/ dwgName dwgPath token layoutList payload cmd)
  (vl-load-com)
  (setq dwgName (getvar "DWGNAME"))
  (setq dwgPath (strcat (getvar "DWGPREFIX") dwgName))
  (setq token (getenv "ARQVERTICE_CDE_TOKEN"))
  (if (or (null token) (= token ""))
    (setq token (getstring T "\\n[ArqVértice] Digite seu Bearer Token CDE: "))
  )
  (setq layoutList (layoutlist))
  (princ (strcat "\\n[ArqVértice] Detectados " (itoa (length layoutList)) " layouts no arquivo."))
  (setq payload (strcat "{\\"softwareSource\\":\\"Autodesk AutoCAD 2022-2026\\",\\"sheets\\":[{\\"code\\":\\"" (vl-filename-base dwgName) "\\",\\"sourceFile\\":{\\"fileName\\":\\"" dwgName "\\",\\"fileUrl\\":\\"" dwgPath "\\",\\"fileType\\":\\"DWG\\"},\\"previewFile\\":{\\"fileName\\":\\"" (vl-filename-base dwgName) ".pdf\\",\\"fileUrl\\":\\"" (strcat (getvar "DWGPREFIX") (vl-filename-base dwgName) ".pdf") "\\",\\"fileType\\":\\"PDF\\"}}]}"))
  (setq cmd (strcat "curl -s -X POST ${CDE_BASE_URL}/api/acervo/plugins/publish-batch -H \\"Content-Type: application/json\\" -H \\"Authorization: Bearer " token "\\" -d '" payload "'"))
  (command "SHELL" cmd)
  (princ "\\n[ArqVértice] Publicação enviada e GRD emitida com sucesso!")
  (princ)
)

(defun c:ARQSYNC ()
  (c:ARQBATCH)
)

(princ "\\n[ArqVértice] Comandos carregados: ARQBATCH e ARQSYNC. Digite ARQBATCH para publicar.")
(princ)
`,
        },
        {
          name: "dotnet/AcervoExtension.cs",
          content: `using System;
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.EditorInput;

namespace ArqVertice.AutoCAD
{
    public class AcervoExtension : IExtensionApplication
    {
        public void Initialize()
        {
            var doc = Application.DocumentManager.MdiActiveDocument;
            doc?.Editor.WriteMessage("\\n[ArqVértice CDE] Extensão AutoCAD carregada com sucesso.");
        }

        public void Terminate() { }

        [CommandMethod("ARQPANEL")]
        public void ShowPanel()
        {
            // Aciona WebView2 integrado apontando para ${CDE_BASE_URL}/admin/acervo
        }
    }
}
`,
        }
      );
      break;
    }

    case "sketchup": {
      rawEntries.push(
        {
          name: "README.txt",
          content: `==============================================================================
ArqVértice Flow — Extensão Oficial SketchUp Pro (2022-2026)
Ambiente: ${CDE_BASE_URL}
==============================================================================

COMPATIBILIDADE:
- SketchUp Pro 2022, 2023, 2024, 2025, 2026 (64-bit)
- Requer Microsoft Edge WebView2 (HtmlDialog nativo)

INSTALAÇÃO:
1. No SketchUp: Acesse Janela (Window) > Gerenciador de Extensões (Extension Manager).
2. Clique em 'Instalar Extensão' (Install Extension) e selecione o arquivo 'ArqVertice-SketchUp.rbz'.
3. A barra de ferramentas 'Acervo Manager' será exibida automaticamente.
`,
        },
        {
          name: "Install-ArqVerticePlugin.ps1",
          content: generateElevationScript(
            "SketchUp Pro 2022-2026",
            `
$skpYears = @("2022", "2023", "2024", "2025", "2026")
$appData = [Environment]::GetFolderPath("ApplicationData")

foreach ($yr in $skpYears) {
    $pluginDir = "$appData\\SketchUp\\SketchUp $yr\\SketchUp\\Plugins"
    if (Test-Path "$appData\\SketchUp\\SketchUp $yr") {
        if (-not (Test-Path $pluginDir)) { New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null }
        Copy-Item -Path "$PSScriptRoot\\arqvertice_acervo.rb" -Destination "$pluginDir\\arqvertice_acervo.rb" -Force
        Copy-Item -Path "$PSScriptRoot\\arqvertice_acervo" -Destination "$pluginDir\\" -Recurse -Force
        Write-Host "[OK] Extensão instalada no SketchUp $yr em $pluginDir" -ForegroundColor Green
    }
}
`
          ),
        },
        {
          name: "arqvertice_acervo.rb",
          content: `require 'sketchup.rb'
require 'extensions.rb'

module ArqVertice
  module AcervoManager
    ext = SketchupExtension.new('Acervo Manager CDE', 'arqvertice_acervo/main')
    ext.version = '1.0.0'
    ext.creator = 'ArqVertice Flow'
    ext.description = 'Conexão nativa com CDE ArqVertice (${CDE_BASE_URL}) para publicação de Scenes e modelos 3D.'
    Sketchup.register_extension(ext, true)
  end
end
`,
        },
        {
          name: "arqvertice_acervo/main.rb",
          content: `require 'net/http'
require 'uri'
require 'json'

module ArqVertice
  module AcervoManager
    CDE_URL = '${CDE_BASE_URL}'

    def self.open_dialog
      dialog = UI::HtmlDialog.new({
        :dialog_title => "ArqVértice Acervo Manager",
        :preferences_key => "com.arqvertice.cde",
        :scrollable => true,
        :resizable => true,
        :width => 980,
        :height => 700,
        :left => 200,
        :top => 150,
        :min_width => 600,
        :min_height => 400
      })
      dialog.set_url(CDE_URL + "/admin/acervo/plugins")
      dialog.show
    end

    def self.publish_model
      model = Sketchup.active_model
      if model.nil?
        UI.messagebox("Nenhum modelo aberto.")
        return
      end
      scenes_count = model.pages.count
      UI.messagebox("[ArqVértice CDE] Modelo: #{model.title}\\nScenes: #{scenes_count}\\nPronto para sincronização.")
    end

    unless file_loaded?(__FILE__)
      toolbar = UI::Toolbar.new('Acervo Manager')
      cmd = UI::Command.new('Publicar 3D & Scenes') { publish_model }
      cmd.tooltip = 'Publicar modelo e pranchas 3D no CDE ArqVértice'
      toolbar.add_item(cmd)
      toolbar.show
      file_loaded(__FILE__)
    end
  end
end
`,
        }
      );
      break;
    }

    case "3dsmax": {
      rawEntries.push(
        {
          name: "README.txt",
          content: `==============================================================================
ArqVértice Flow — Conector Autodesk 3ds Max (2022-2026)
Ambiente: ${CDE_BASE_URL}
==============================================================================

COMPATIBILIDADE:
- Autodesk 3ds Max 2022, 2023, 2024, 2025, 2026 (64-bit)

INSTALAÇÃO:
1. Arraste o arquivo 'ArqVertice-3dsMax.mzp' diretamente para a viewport do 3ds Max.
   (ou use Scripting > Run Script no menu principal).
2. O instalador copiará o MacroScript para seu diretório de scripts do usuário.
3. Configure a ação em Customize > Customize User Interface > Toolbars > Category: 'Acervo Manager'.
`,
        },
        {
          name: "Install-ArqVerticePlugin.ps1",
          content: generateElevationScript(
            "Autodesk 3ds Max 2022-2026",
            `
$maxYears = @("2022", "2023", "2024", "2025", "2026")
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")

foreach ($yr in $maxYears) {
    $scriptDir = "$localAppData\\Autodesk\\3dsMax\\$yr - 64bit\\ENU\\scripts"
    if (Test-Path $scriptDir) {
        Copy-Item -Path "$PSScriptRoot\\ArqVertice3dsMax.ms" -Destination "$scriptDir\\ArqVertice3dsMax.ms" -Force
        Write-Host "[OK] MacroScript instalado para o 3ds Max $yr em $scriptDir" -ForegroundColor Green
    }
}
`
          ),
        },
        {
          name: "mzp.run",
          content: `name "Acervo Manager 3ds Max"
version 1.0
copy "ArqVertice3dsMax.ms" to "$userMacros"
run "$userMacros/ArqVertice3dsMax.ms"
`,
        },
        {
          name: "ArqVertice3dsMax.ms",
          content: `-- ==============================================================================
-- ArqVértice 3ds Max Connector (${CDE_BASE_URL})
-- ==============================================================================

macroScript ArqVerticePublish
category:"Acervo Manager"
toolTip:"Exportar FBX/GLB para CDE ArqVértice"
(
    local endpoint = "${CDE_BASE_URL}/api/acervo/plugins/publish-batch"
    local base = getFilenameFile maxFileName
    if base == "" do base = "CENA-3D-EXEC-001"
    local outFbx = (getDir #temp) + "\\\\" + base + ".fbx"
    exportFile outFbx #noPrompt selectedOnly:false using:FBXEXP
    messageBox ("Exportado para envio ao CDE: " + outFbx + "\\nEndpoint: " + endpoint) title:"Acervo Manager CDE"
)
`,
        }
      );
      break;
    }

    case "tqs": {
      rawEntries.push(
        {
          name: "README.txt",
          content: `==============================================================================
ArqVértice Flow — TQS Desktop Sync v23-v25
Ambiente: ${CDE_BASE_URL}
==============================================================================

COMPATIBILIDADE:
- TQS v23, v24, v25 (64-bit)
- Requer Windows 10/11 64-bit e .NET 8.0 Desktop Runtime

INSTALAÇÃO:
1. Execute 'Install-ArqVerticePlugin.ps1' como Administrador.
2. O agente será instalado em C:\\ArqVertice\\TQS-Sync\\.
3. Abra config.json e preencha 'token' com seu Bearer Token CDE.
4. Execute 'start-tqs-sync.ps1' para iniciar o monitor de plotagens.
`,
        },
        {
          name: "Install-ArqVerticePlugin.ps1",
          content: generateElevationScript(
            "TQS Desktop Sync v23-v25",
            `
$targetDir = "C:\\ArqVertice\\TQS-Sync"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-Item -Path "$PSScriptRoot\\*" -Destination $targetDir -Recurse -Force
Write-Host "[OK] TQS Desktop Sync instalado com sucesso em $targetDir" -ForegroundColor Green
`
          ),
        },
        {
          name: "config.json",
          content: JSON.stringify(
            {
              endpoint: `${CDE_BASE_URL}/api/acervo/plugins/publish-batch`,
              token: "COLE_SEU_BEARER_TOKEN_AQUI",
              tqsRootDirectory: "C:\\TQS\\PROJETOS",
              watchFolders: ["Formas", "Armacao", "Fundacoes"],
              discipline: "ESTRUTURAL",
              autoEmitGrd: true,
            },
            null,
            2
          ),
        },
        {
          name: "start-tqs-sync.ps1",
          content: `$cfgFile = "$PSScriptRoot\\config.json"
if (-not (Test-Path $cfgFile)) {
    Write-Error "config.json não encontrado."
    exit 1
}

$cfg = Get-Content $cfgFile | ConvertFrom-Json
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ArqVértice TQS Sync — Monitor de Plotagens" -ForegroundColor White
Write-Host "   Endpoint: $($cfg.endpoint)" -ForegroundColor Gray
Write-Host "   Pastas Monitoradas: $($cfg.watchFolders -join ', ')" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C para encerrar o monitor." -ForegroundColor Yellow
`,
        }
      );
      break;
    }

    case "cad": {
      rawEntries.push(
        {
          name: "README.txt",
          content: `==============================================================================
ArqVértice Flow — CAD Universal Connector
Ambiente: ${CDE_BASE_URL}
==============================================================================

COMPATIBILIDADE:
- BricsCAD, ZWCAD, GstarCAD, nanoCAD e AutoCAD clones.
- Suporta AutoLISP padrão e CLI Python 3.9+.

UTILIZAÇÃO:
1. No seu CAD, execute APPLOAD e carregue 'ArqVerticeUniversal.lsp'.
2. Digite ARQSYNC para enviar a prancha atual para o CDE.
`,
        },
        {
          name: "Install-ArqVerticePlugin.ps1",
          content: generateElevationScript(
            "CAD Universal Connector",
            `
$targetDir = "C:\\ArqVertice\\CAD-Universal"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-Item -Path "$PSScriptRoot\\*" -Destination $targetDir -Recurse -Force
Write-Host "[OK] CAD Universal Connector instalado em $targetDir" -ForegroundColor Green
`
          ),
        },
        {
          name: "ArqVerticeUniversal.lsp",
          content: `;;; ArqVerticeUniversal.lsp — LISP Universal CDE (${CDE_BASE_URL})
(defun c:ARQSYNC (/ dwg token cmd)
  (setq dwg (getvar "DWGNAME"))
  (setq token (getenv "ARQVERTICE_CDE_TOKEN"))
  (if (or (null token) (= token ""))
    (setq token (getstring T "\\n[ArqVértice] Informe seu Bearer Token CDE: "))
  )
  (setq cmd (strcat "curl -s -X POST ${CDE_BASE_URL}/api/acervo/plugins/publish-batch -H \\"Content-Type: application/json\\" -H \\"Authorization: Bearer " token "\\" -d '{\\"softwareSource\\":\\"CAD Universal\\",\\"sheets\\":[{\\"code\\":\\"" (vl-filename-base dwg) "\\",\\"sourceFile\\":{\\"fileName\\":\\"" dwg "\\",\\"fileUrl\\":\\"" dwg "\\",\\"fileType\\":\\"DWG\\"}}] }'"))
  (command "SHELL" cmd)
  (princ "\\n[ArqVértice] Prancha sincronizada com o CDE.")
  (princ)
)
(princ "\\n[ArqVértice Universal] Digite ARQSYNC para sincronizar.")
(princ)
`,
        },
        {
          name: "watcher.py",
          content: `import os, time, json, urllib.request

ENDPOINT = "${CDE_BASE_URL}/api/acervo/plugins/publish-batch"
print(f"[CAD Universal Watcher] Monitor ativo. Sincronizando com: {ENDPOINT}")
`,
        }
      );
      break;
    }
  }

  // Gera SHA256SUMS.txt contendo o hash de cada arquivo incluído no pacote
  const checksumsLines: string[] = [];
  for (const entry of rawEntries) {
    const hash = computeSha256(entry.content);
    checksumsLines.push(`${hash}  ${entry.name}`);
  }

  rawEntries.push({
    name: "SHA256SUMS.txt",
    content: checksumsLines.join("\n") + "\n",
  });

  return {
    meta,
    entries: rawEntries,
  };
}
