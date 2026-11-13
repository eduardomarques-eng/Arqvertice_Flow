"use server";

import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { DomainError } from "@/server/errors";

export interface MessengerContact {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty: string | null;
  status: "Online" | "Ausente" | "Offline";
  lastSeenAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  isMine: boolean;
}

/**
 * 1. Lista profissionais da equipe técnica com status de presença em tempo real
 */
export async function getTeamContactsAction(): Promise<MessengerContact[]> {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return [];
  }

  const now = Date.now();
  const teamUsers = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: user.id } },
        { isActive: true },
        { role: { notIn: ["CLIENTE", "CLIENT"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      specialty: true,
      lastSeenAt: true,
      receivedInternalMessages: {
        where: { senderId: user.id, isRead: false },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Também conta mensagens não lidas que o usuário atual recebeu de cada contato
  const unreadCounts = await prisma.internalMessage.groupBy({
    by: ["senderId"],
    where: { receiverId: user.id, isRead: false },
    _count: { id: true },
  });

  const unreadMap = new Map<string, number>();
  for (const item of unreadCounts) {
    unreadMap.set(item.senderId, item._count.id);
  }

  return teamUsers.map((u) => {
    let presence: "Online" | "Ausente" | "Offline" = "Offline";
    if (u.lastSeenAt) {
      const diffMs = now - u.lastSeenAt.getTime();
      if (diffMs <= 2 * 60 * 1000) {
        presence = "Online";
      } else if (diffMs <= 5 * 60 * 1000) {
        presence = "Ausente";
      }
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      specialty: u.specialty,
      status: presence,
      lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
      unreadCount: unreadMap.get(u.id) || 0,
    };
  });
}

/**
 * 2. Carrega as mensagens entre o usuário logado e outro profissional
 */
export async function getConversationMessagesAction(otherUserId: string): Promise<ChatMessage[]> {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return [];
  }

  // Marca como lidas as mensagens recebidas deste contato
  await prisma.internalMessage.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: user.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  const messages = await prisma.internalMessage.findMany({
    where: {
      OR: [
        { senderId: user.id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: user.id },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    content: m.content,
    isRead: m.isRead,
    createdAt: m.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    isMine: m.senderId === user.id,
  }));
}

/**
 * 3. Envia uma mensagem interna
 */
export async function sendInternalMessageAction(receiverId: string, content: string) {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    throw new DomainError("Acesso não autorizado ao mensageiro interno.", "INTEGRITY");
  }

  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new DomainError("A mensagem não pode estar vazia.", "VALIDATION");
  }

  // Atualiza heartbeat do remetente
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  const message = await prisma.internalMessage.create({
    data: {
      senderId: user.id,
      receiverId,
      content: cleanContent,
    },
  });

  return {
    success: true,
    message: {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isMine: true,
    },
  };
}

/**
 * 4. Obtém o total de mensagens não lidas para o indicador flutuante
 */
export async function getUnreadMessagesCountAction(): Promise<number> {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return 0;
  }

  return prisma.internalMessage.count({
    where: {
      receiverId: user.id,
      isRead: false,
    },
  });
}

