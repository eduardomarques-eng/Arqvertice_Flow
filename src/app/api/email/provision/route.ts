import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import {
  ensureEmailBootstrap,
  getMonthlyResendUsage,
  syncEmailInfrastructureApis,
} from "@/lib/email/email-infra";
import { prisma } from "@/server/db";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  await ensureEmailBootstrap();
  const [config, usage] = await Promise.all([
    prisma.emailDomainConfig.findUnique({ where: { id: "default" } }),
    getMonthlyResendUsage(),
  ]);

  return NextResponse.json({ config, usage });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem provisionar infraestrutura DNS/API." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    gmailMirrorAddress?: string;
    gmailMirrorEnabled?: boolean;
    mailflareWorkerUrl?: string | null;
    mailflareMcpUrl?: string | null;
  };

  const result = await syncEmailInfrastructureApis(body);
  const usage = await getMonthlyResendUsage();

  return NextResponse.json({
    ok: true,
    config: result.config,
    diagnostics: result.diagnostics,
    usage,
  });
}
