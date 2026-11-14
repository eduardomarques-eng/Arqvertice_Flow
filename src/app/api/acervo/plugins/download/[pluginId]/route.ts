import { NextResponse } from "next/server";
import { buildZipArchive } from "@/lib/acervo/zip-builder";
import {
  getPluginPackageEntries,
  PLUGIN_PACKAGES,
  type PluginPackageId,
} from "@/lib/acervo/plugin-packages";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pluginId: string }> }
) {
  const { pluginId } = await params;
  const valid = PLUGIN_PACKAGES.some((p) => p.id === pluginId);
  if (!valid) {
    return NextResponse.json({ error: "Plugin não encontrado." }, { status: 404 });
  }

  const { meta, entries } = getPluginPackageEntries(pluginId as PluginPackageId);
  const zipBuffer = buildZipArchive(entries);

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${meta.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
