param(
    [string]$ArquivosRoot = "C:\Users\eduar\OneDrive\Documentos\ArqVertice_Flow\Arquivos",
    [switch]$IncludeLargeProjects = $false
)

$ErrorActionPreference = "Continue"

# Localiza instalacao do Autodesk 3ds Max (2022 a 2026)
$maxBatchCandidates = Get-ChildItem "C:\Program Files\Autodesk\3ds Max*\3dsmaxbatch.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
if (-not $maxBatchCandidates -or $maxBatchCandidates.Count -eq 0) {
    Write-Warning "[ArqVertice Batch] 3dsmaxbatch.exe nao encontrado em C:\Program Files\Autodesk\."
    exit 0
}

$maxBatchExe = $maxBatchCandidates[0].FullName
$msScript = Join-Path $PSScriptRoot "Export-MaxToFbx.ms"
Write-Host "[ArqVertice Batch] Usando motor: $maxBatchExe"

$maxFiles = Get-ChildItem -Path $ArquivosRoot -Recurse -Filter "*.max" -File -ErrorAction SilentlyContinue
foreach ($file in $maxFiles) {
    $sizeMB = [math]::Round($file.Length / 1MB, 2)
    if ((-not $IncludeLargeProjects) -and ($sizeMB -gt 100)) {
        Write-Host "[ArqVertice Batch] Pulando arquivo pesado (>100 MB) no modo rapido: $($file.FullName) ($sizeMB MB). Use -IncludeLargeProjects para converter."
        continue
    }

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name).TrimEnd('.')
    $targetFbx = Join-Path $file.DirectoryName ($baseName + ".fbx")

    if (Test-Path $targetFbx) {
        Write-Host "[ArqVertice Batch] .FBX ja existente: $targetFbx"
        continue
    }

    Write-Host "[ArqVertice Batch] Convertendo $($file.FullName) ($sizeMB MB) -> $targetFbx ..."
    & $maxBatchExe $msScript -sceneFile $file.FullName -listenerlog "$targetFbx.log"
    if (Test-Path $targetFbx) {
        Write-Host "[ArqVertice Batch] SUCESSO: $targetFbx gerado!"
    } else {
        Write-Warning "[ArqVertice Batch] Aviso: $($file.Name) nao gerou .fbx direto (verifique plugins Corona/V-Ray no log)."
    }
}
