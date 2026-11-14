import { NextResponse } from "next/server";
import { buildZipArchive } from "@/lib/acervo/zip-builder";
import {
  getPluginPackageEntries,
  generateEnvCheckerScript,
  PLUGIN_PACKAGES,
  type PluginPackageId,
} from "@/lib/acervo/plugin-packages";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packageSlug: string }> }
) {
  const { packageSlug } = await params;

  if (packageSlug === "check-env") {
    const script = generateEnvCheckerScript();
    return new NextResponse(script, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Check-ArqVerticeEnv.ps1"',
        "Cache-Control": "no-store",
      },
    });
  }

  const valid = PLUGIN_PACKAGES.some((p) => p.id === packageSlug);
  if (!valid) {
    return NextResponse.json({ error: "Pacote de plugin não encontrado." }, { status: 404 });
  }

  const { meta, entries } = getPluginPackageEntries(packageSlug as PluginPackageId);
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
