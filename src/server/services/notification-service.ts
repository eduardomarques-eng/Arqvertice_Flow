import { Prisma } from "@prisma/client";
import { createHmac } from "node:crypto";
import { prisma } from "@/server/db";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  type CommercialEventType,
  type NotificationChannel,
  type NotificationStatus,
} from "@/lib/commercial-events";

export type NotificationInput = {
  type: CommercialEventType;
  channel: NotificationChannel;
  status: NotificationStatus;
  body: string;
  templateKey?: string;
  recipient?: string;
  subject?: string;
  error?: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
};

/**
 * Tópico 22: registra o evento e o resultado do envio. É a base para integrar
 * e-mail, WhatsApp e notificações internas sem alterar os serviços de domínio.
 */
export async function recordNotification(input: NotificationInput) {
  const event = await prisma.notificationEvent.create({
    data: {
      type: input.type,
      channel: input.channel,
      status: input.status,
      body: input.body,
      templateKey: input.templateKey ?? null,
      recipient: input.recipient ?? null,
      subject: input.subject ?? null,
      error: input.error ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: input.payload ? (JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });
  void notifyWebhook(event).catch((error) => {
    console.error("[notification] Falha no webhook de notificação.", error);
  });
  return event;
}

async function notifyWebhook(event: {
  id: string;
  type: string;
  channel: string;
  status: string;
  recipient: string | null;
  entityType: string | null;
  entityId: string | null;
  occurredAt: Date;
}) {
  const url = process.env.NOTIFICATION_WEBHOOK_URL?.trim();
  if (!url) return;
  const payload = JSON.stringify({
    id: event.id,
    type: event.type,
    channel: event.channel,
    status: event.status,
    recipient: event.recipient,
    entityType: event.entityType,
    entityId: event.entityId,
    occurredAt: event.occurredAt.toISOString(),
  });
  const secret = process.env.NOTIFICATION_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers["x-arqvertice-signature"] = createHmac("sha256", secret).update(payload).digest("hex");
  const response = await fetch(url, { method: "POST", headers, body: payload });
  if (!response.ok) throw new Error(`Webhook respondeu ${response.status}.`);
}

export async function listNotificationEvents(entityId: string) {
  await requireModuleAccess("dashboard");
  return prisma.notificationEvent.findMany({
    where: { entityId },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
}

export { NOTIFICATION_CHANNEL, NOTIFICATION_STATUS };

