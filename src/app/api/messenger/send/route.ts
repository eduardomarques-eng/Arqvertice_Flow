import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  const user = await currentUser();

  // Bloqueio estrito para clientes
  if (!user || user.role === "CLIENTE" || (user.role as string) === "CLIENT") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const receiverId = String(body.receiverId || "").trim();
    const content = String(body.content || "").trim();

    if (!receiverId || !content) {
      return NextResponse.json(
        { error: "Destinatário e mensagem são obrigatórios." },
        { status: 400 }
      );
    }

    // Valida que o destinatário não é cliente
    const recipient = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, role: true, isActive: true },
    });

    if (!recipient || !recipient.isActive || recipient.role === "CLIENTE" || (recipient.role as string) === "CLIENT") {
      return NextResponse.json(
        { error: "Destinatário inválido ou não autorizado para chat interno." },
        { status: 400 }
      );
    }

    const message = await prisma.internalMessage.create({
      data: {
        senderId: user.id,
        receiverId,
        content,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        isRead: message.isRead,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Falha ao enviar mensagem." }, { status: 500 });
  }
}

