import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { createBriefingLink } from "@/server/services/briefing-link-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const briefing = await prisma.briefing.findUnique({
      where: { id },
      select: { projectId: true, project: { select: { client: { select: { email: true } } } } },
    });
    if (!briefing) return NextResponse.json({ error: "Briefing não encontrado." }, { status: 404 });
    if (!briefing.project.client.email) {
      return NextResponse.json({ error: "O cliente não possui e-mail cadastrado." }, { status: 422 });
    }

    const result = await createBriefingLink(briefing.projectId);
    return NextResponse.json({
      ok: true,
      url: result.url,
      recipient: briefing.project.client.email,
      configured: Boolean(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível enviar o briefing por e-mail." },
      { status: 500 },
    );
  }
}
