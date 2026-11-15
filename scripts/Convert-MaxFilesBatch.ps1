param(
    [string]$ArquivosRoot = "C:\Users\eduar\OneDrive\Documentos\ArqVertice_Flow\Arquivos",
    [switch]$IncludeLargeProjects = $false
)
& (Join-Path $PSScriptRoot "Convert-MaxFiles.ps1") -ArquivosRoot $ArquivosRoot -IncludeLargeProjects:$IncludeLargeProjects
