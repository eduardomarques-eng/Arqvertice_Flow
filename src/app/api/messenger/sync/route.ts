import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();

  // Bloqueio estrito para clientes
  if (!user || user.role === "CLIENTE" || (user.role as string) === "CLIENT") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // Atualiza heartbeat lastSeenAt do usuário autenticado
  await prisma.user
    .update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => null);

  const { searchParams } = new URL(request.url);
  const withUserId = searchParams.get("withUserId");

  // Lista os colegas profissionais ativos (exclui CLIENTE)
  const colleagues = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { notIn: ["CLIENTE", "CLIENT"] },
      id: { not: user.id },
    },
    select: {
      id: true,
      name: true,
      role: true,
      specialty: true,
      lastSeenAt: true,
    },
    orderBy: { name: "asc" },
  });

  const now = Date.now();
  const contactsWithPresence = colleagues.map((c) => {
    let presence: "ONLINE" | "AUSENTE" | "OFFLINE" = "OFFLINE";
    if (c.lastSeenAt) {
      const diffSec = Math.floor((now - new Date(c.lastSeenAt).getTime()) / 1000);
      if (diffSec <= 45) {
        presence = "ONLINE";
      } else if (diffSec <= 300) {
        presence = "AUSENTE";
      }
    }
    return {
      id: c.id,
      name: c.name,
      role: c.role,
      specialty: c.specialty,
      presence,
    };
  });

  // Mensagens não lidas por remetente
  const unreadGroups = await prisma.internalMessage.groupBy({
    by: ["senderId"],
    where: {
      receiverId: user.id,
      isRead: false,
    },
    _count: { id: true },
  });

  const unreadByUser: Record<string, number> = {};
  let totalUnread = 0;
  for (const group of unreadGroups) {
    unreadByUser[group.senderId] = group._count.id;
    totalUnread += group._count.id;
  }

  // Se com withUserId, buscar as últimas 50 mensagens da conversa
  let messages: Array<{
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    isRead: boolean;
    createdAt: string;
  }> = [];

  if (withUserId) {
    const rawMessages = await prisma.internalMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, receiverId: withUserId },
          { senderId: withUserId, receiverId: user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    messages = rawMessages.reverse().map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      isRead: m.isRead,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  return NextResponse.json({
    currentUserId: user.id,
    totalUnread,
    unreadByUser,
    contacts: contactsWithPresence,
    messages,
  });
}

