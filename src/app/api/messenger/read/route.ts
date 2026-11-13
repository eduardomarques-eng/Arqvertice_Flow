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
    const fromUserId = String(body.fromUserId || "").trim();

    if (!fromUserId) {
      return NextResponse.json({ error: "fromUserId é obrigatório." }, { status: 400 });
    }

    const updated = await prisma.internalMessage.updateMany({
      where: {
        senderId: fromUserId,
        receiverId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ success: true, count: updated.count });
  } catch (err) {
    return NextResponse.json({ error: "Falha ao marcar como lido." }, { status: 500 });
  }
}

