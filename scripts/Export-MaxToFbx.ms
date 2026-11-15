-- ============================================================================
-- ArqVértice Flow — Extrator Batch Silencioso 3ds Max (.MAX -> .FBX)
-- Uso via CLI:
-- "C:\Program Files\Autodesk\3ds Max 2026\3dsmaxbatch.exe" scripts\Export-MaxToFbx.ms -sceneFile "caminho\arquivo.max" -mxsString outFbx:"caminho\arquivo.fbx"
-- ============================================================================

(
    local outPath = undefined
    if (isProperty rootNode #outFbx) then (
        outPath = outFbx
    )
    if (outPath == undefined or outPath == "") then (
        local cleanBase = trimRight (getFilenameFile maxFileName) "."
        outPath = (maxFilePath + cleanBase + ".fbx")
    )

    try (
        -- Configura o FBX Exporter para preservar UVs, Normais e converter unidades para Metros
        pluginManager.loadClass FbxExporter
        FBXExporterSetParam "SmoothingGroups" true
        FBXExporterSetParam "SmoothMeshExport" false
        FBXExporterSetParam "Triangulate" true
        FBXExporterSetParam "PreserveEdgeOrientation" true
        FBXExporterSetParam "ASCII" false
        FBXExporterSetParam "EmbedTextures" false
        FBXExporterSetParam "UpAxis" "Y"
        FBXExporterSetParam "ScaleFactor" 1.0

        exportFile outPath #noPrompt using:FBXEXP
        format "[ArqVertice MAXScript] Exportado com sucesso: %\n" outPath
    ) catch (
        format "[ArqVertice MAXScript ERRO] Falha ao exportar %: %\n" outPath (getCurrentException())
    )
)
