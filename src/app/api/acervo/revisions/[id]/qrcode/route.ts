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

    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    const requestHost = request.headers.get("host");
    const baseUrl = configuredAppUrl
      ? configuredAppUrl
      : requestHost
        ? `${requestHost.includes("localhost") ? "http" : "https"}://${requestHost}`
        : "https://arqvertice-os.vercel.app";
    const verificationUrl = `${baseUrl}/verificar/${revision.qrVerificationToken}`;

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
