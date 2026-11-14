import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/server/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: revisionId } = await params;

    const revision = await prisma.acervoRevision.findUnique({
      where: { id: revisionId },
      select: { qrVerificationToken: true, revisionNumber: true },
    });

    if (!revision || !revision.qrVerificationToken) {
      return NextResponse.json({ error: "Revisão ou token não encontrado." }, { status: 404 });
    }

    const host = request.headers.get("host") || "arqvertice-flow.vercel.app";
    const protocol = host.includes("localhost") ? "http" : "https";
    const verificationUrl = `${protocol}://${host}/verificar/${revision.qrVerificationToken}`;

    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 256,
      margin: 1,
      color: {
        dark: "#18181B",
        light: "#FFFFFF",
      },
    });

    return NextResponse.json({
      success: true,
      verificationUrl,
      qrDataUrl,
    });
  } catch (err: unknown) {
    console.error("[ACERVO_QR_ERROR]", err);
    return NextResponse.json({ error: "Falha ao gerar QR code." }, { status: 500 });
  }
}
