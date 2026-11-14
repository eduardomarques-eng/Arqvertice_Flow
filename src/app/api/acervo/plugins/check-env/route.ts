import { NextResponse } from "next/server";
import { CDE_BASE_URL } from "@/lib/acervo/plugin-packages";

export function generateEnvCheckerScript(): string {
  return `# ==============================================================================
# ArqVértice Flow — Verificador de Ambiente Windows (CAD / BIM / 3D)
# Endpoint Alvo: ${CDE_BASE_URL}
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "       ArqVértice Flow — Diagnóstico de Estação de Trabalho CAD/BIM    " -ForegroundColor White
Write-Host "       Verificador de Compatibilidade .NET, WebView2, RAM e Firewall   " -ForegroundColor Gray
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Log-Check($item, $status, $detail) {
    $color = switch ($status) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        default { "White" }
    }
    Write-Host " [$status] " -ForegroundColor $color -NoNewline
    Write-Host "$item: " -ForegroundColor White -NoNewline
    Write-Host $detail -ForegroundColor Gray

    $results.Add([PSCustomObject]@{
        Item = $item
        Status = $status
        Detail = $detail
    })
}

# 1. Arquitetura do Sistema Operacional
$is64 = [Environment]::Is64BitOperatingSystem
if ($is64) {
    Log-Check "Arquitetura SO" "PASS" "Windows 64-bit detectado"
} else {
    Log-Check "Arquitetura SO" "FAIL" "Sistema 32-bit não suportado para Add-ins BIM"
}

# 2. Versão e Build do Windows
$os = Get-CimInstance Win32_OperatingSystem
$build = [int]$os.BuildNumber
if ($build -ge 17763) {
    Log-Check "Versão do Windows" "PASS" "$($os.Caption) (Build $build >= 1809)"
} else {
    Log-Check "Versão do Windows" "WARN" "$($os.Caption) (Build $build < 1809 - Atualize para Win 10/11 recente)"
}

# 3. Memória RAM Física
$ramGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
if ($ramGb -ge 31.0) {
    Log-Check "Memória RAM" "PASS" "$ramGb GB instalados (Ideal para modelos pesados Revit/IFC/3D)"
} elseif ($ramGb -ge 15.0) {
    Log-Check "Memória RAM" "PASS" "$ramGb GB instalados (Atende ao requisito mínimo)"
} else {
    Log-Check "Memória RAM" "WARN" "$ramGb GB instalados (Mínimo recomendado: 16 GB; 32 GB para BIM)"
}

# 4. .NET Framework 4.8 (Revit 2022-2024 / AutoCAD)
$net48Path = "HKLM:\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full"
$net48Release = (Get-ItemProperty -Path $net48Path -ErrorAction SilentlyContinue).Release
if ($net48Release -ge 528040) {
    Log-Check ".NET Framework 4.8+" "PASS" "Instalado (Release $net48Release)"
} else {
    Log-Check ".NET Framework 4.8+" "FAIL" "Não detectado. Necessário para Revit 2022-2024 e AutoCAD"
}

# 5. .NET 8.0 Desktop Runtime (Revit 2025-2026 / TQS)
$dotnetRuntimes = & dotnet --list-runtimes 2>$null
$hasDotnet8 = $dotnetRuntimes | Where-Object { $_ -match "Microsoft\.WindowsDesktop\.App 8\." }
if ($hasDotnet8) {
    Log-Check ".NET 8 Desktop Runtime" "PASS" "Instalado (Revit 2025/2026 e TQS Sync suportados)"
} else {
    Log-Check ".NET 8 Desktop Runtime" "WARN" "Não detectado. Instale o .NET 8.0 Desktop Runtime x64 para Revit 2025+"
}

# 6. Microsoft Edge WebView2 Runtime
$wvKey1 = "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$wvKey2 = "HKCU:\\Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$wvVersion = (Get-ItemProperty -Path $wvKey1 -ErrorAction SilentlyContinue).pv
if (-not $wvVersion) {
    $wvVersion = (Get-ItemProperty -Path $wvKey2 -ErrorAction SilentlyContinue).pv
}

if ($wvVersion) {
    Log-Check "Microsoft Edge WebView2" "PASS" "Versão instalada: $wvVersion"
} else {
    Log-Check "Microsoft Edge WebView2" "FAIL" "WebView2 Runtime ausente. Baixe em: https://go.microsoft.com/fwlink/p/?LinkId=2124703"
}

# 7. Portas e Conectividade HTTPS (Porta 443 para o Flow)
Write-Host ""
Write-Host "Testando conectividade de rede com o endpoint CDE..." -ForegroundColor Cyan
$testUrl = "${CDE_BASE_URL}/api/acervo/plugins/auth"

try {
    $webReq = [System.Net.WebRequest]::Create($testUrl)
    $webReq.Method = "HEAD"
    $webReq.Timeout = 8000
    $webResp = $webReq.GetResponse()
    $webResp.Close()
    Log-Check "Conectividade HTTPS 443" "PASS" "Acesso liberado a $testUrl"
} catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    if ($resp -and ($resp.StatusCode -eq 401 -or $resp.StatusCode -eq 405 -or $resp.StatusCode -eq 200)) {
        Log-Check "Conectividade HTTPS 443" "PASS" "Acesso liberado a $testUrl (Porta 443 ativa)"
    } else {
        Log-Check "Conectividade HTTPS 443" "FAIL" "Falha ao contactar servidor: $($_.Exception.Message)"
    }
} catch {
    Log-Check "Conectividade HTTPS 443" "WARN" "Verifique regras de Proxy ou Firewall local"
}

# 8. Privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Log-Check "Privilégios Locais" "PASS" "Sessão com privilégios de Administrador"
} else {
    Log-Check "Privilégios Locais" "WARN" "Sessão padrão de usuário. Para registrar Add-ins Autodesk execute como Administrador."
}

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "                       RESUMO DO DIAGNÓSTICO                           " -ForegroundColor White
Write-Host "=======================================================================" -ForegroundColor Cyan

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$warnCount = ($results | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count

Write-Host "   Sucessos (PASS) : $passCount" -ForegroundColor Green
Write-Host "   Alertas (WARN)  : $warnCount" -ForegroundColor Yellow
Write-Host "   Falhas (FAIL)   : $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "[OK] Sua estação de trabalho está pronta para executar os plugins ArqVértice CDE!" -ForegroundColor Green
} else {
    Write-Host "[ATENÇÃO] Resolva os itens marcados em vermelho antes de instalar os conectores." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
`;
}

export async function GET() {
  const scriptContent = generateEnvCheckerScript();
  return new NextResponse(scriptContent, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Check-ArqVerticeEnv.ps1"',
      "Cache-Control": "no-store",
    },
  });
}
