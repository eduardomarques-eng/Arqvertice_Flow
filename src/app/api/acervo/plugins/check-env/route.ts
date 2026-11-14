import { NextResponse } from "next/server";
import { generateEnvCheckerScript } from "@/lib/acervo/plugin-packages";

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
