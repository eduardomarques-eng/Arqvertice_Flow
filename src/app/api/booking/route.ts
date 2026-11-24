import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { ensureEmailBootstrap } from "@/lib/email/email-infra";
import { sendEmail } from "@/server/services/email-service";
import { buildArqVerticeEmailTemplate } from "@/lib/email/resend-service";
import {
  resolveOfficialGatewayConfig,
  sendViaOfficialGateway,
} from "@/lib/whatsapp/gateway-client";
import { buildBucketKey, checkRateLimit } from "@/lib/rate-limit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeHeaderField(val: string, maxLen = 120): string {
  return val.replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(total: number): string {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export async function GET(req: Request) {
  await ensureEmailBootstrap();
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD
  const targetDate = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
  const dayOfWeek = targetDate.getUTCDay();

  const [slotConfig, existingBookings] = await Promise.all([
    prisma.bookingSlotConfig.findUnique({ where: { dayOfWeek } }),
    dateStr
      ? prisma.clientBooking.findMany({
          where: {
            status: "CONFIRMED",
            scheduledAt: {
              gte: new Date(`${dateStr}T00:00:00.000Z`),
              lte: new Date(`${dateStr}T23:59:59.999Z`),
            },
          },
          select: { scheduledAt: true },
        })
      : Promise.resolve([]),
  ]);

  if (!slotConfig || !slotConfig.isEnabled) {
    return NextResponse.json({
      date: dateStr,
      slots: [],
      message: "Sem horários disponíveis neste dia da semana.",
    });
  }

  const startMin = toMinutes(slotConfig.startTime);
  const endMin = toMinutes(slotConfig.endTime);
  const step = Math.max(15, slotConfig.slotMinutes);
  const takenSet = new Set(
    existingBookings.map((b) => {
      const d = new Date(b.scheduledAt);
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
        d.getUTCMinutes()
      ).padStart(2, "0")}`;
    })
  );

  const slots: Array<{ time: string; available: boolean }> = [];
  for (let t = startMin; t + step <= endMin; t += step) {
    const label = fromMinutes(t);
    slots.push({ time: label, available: !takenSet.has(label) });
  }

  return NextResponse.json({
    date: dateStr,
    slotMinutes: step,
    slots,
  });
}

export async function POST(req: Request) {
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "local";
  const rate = checkRateLimit(buildBucketKey("public-booking", clientIp), {
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas de agendamento. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  await ensureEmailBootstrap();
  const body = (await req.json().catch(() => ({}))) as {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    topic?: string;
    meetingType?: "ONLINE" | "PRESENCIAL";
    date?: string;
    time?: string;
    notes?: string;
  };

  if (
    !body.clientName?.trim() ||
    !body.clientEmail?.trim() ||
    !body.topic?.trim() ||
    !body.date ||
    !body.time
  ) {
    return NextResponse.json(
      { error: "Preencha nome, e-mail, assunto, data e horário." },
      { status: 400 }
    );
  }

  const cleanName = sanitizeHeaderField(body.clientName, 100);
  const cleanEmail = body.clientEmail.trim().toLowerCase().slice(0, 160);
  const cleanTopic = sanitizeHeaderField(body.topic, 160);
  const cleanNotes = body.notes ? body.notes.trim().slice(0, 600) : null;
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !/^\d{2}:\d{2}$/.test(body.time)) {
    return NextResponse.json({ error: "Formato de data ou horário inválido." }, { status: 400 });
  }

  const scheduledAt = new Date(`${body.date}T${body.time}:00.000Z`);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Data ou horário deve ser no futuro." }, { status: 400 });
  }

  const dayOfWeek = scheduledAt.getUTCDay();
  const slotCfg = await prisma.bookingSlotConfig.findUnique({ where: { dayOfWeek } });
  const reqMin = toMinutes(body.time);
  if (
    !slotCfg ||
    !slotCfg.isEnabled ||
    reqMin < toMinutes(slotCfg.startTime) ||
    reqMin + Math.max(15, slotCfg.slotMinutes) > toMinutes(slotCfg.endTime)
  ) {
    return NextResponse.json(
      { error: "Horário fora da janela de atendimento configurada." },
      { status: 400 }
    );
  }

  const conflict = await prisma.clientBooking.findFirst({
    where: {
      status: "CONFIRMED",
      scheduledAt,
    },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "Este horário acabou de ser reservado. Escolha outro." },
      { status: 409 }
    );
  }

  const created = await prisma.clientBooking.create({
    data: {
      clientName: cleanName,
      clientEmail: cleanEmail,
      clientPhone: body.clientPhone?.trim().slice(0, 30) || null,
      topic: cleanTopic,
      meetingType: body.meetingType === "PRESENCIAL" ? "PRESENCIAL" : "ONLINE",
      scheduledAt,
      durationMin: 45,
      status: "CONFIRMED",
      notes: cleanNotes,
    },
  });

  const dateLabel = `${body.date} às ${body.time}`;
  const clientBody = [
    `Sua reunião com o ArqVértice Studio foi confirmada!`,
    `• Assunto: ${created.topic}`,
    `• Modalidade: ${created.meetingType}`,
    `• Data e Horário: ${dateLabel} (45 min)`,
    ...(created.notes ? [`• Observações: ${created.notes}`] : []),
  ].join("\n");

  const adminEmail =
    process.env.ADMIN_ALERT_EMAIL?.trim() || "eduardo.marques.arq@gmail.com";
  const adminBody = [
    `Novo agendamento recebido via /agendar:`,
    `• Cliente: ${created.clientName} (${created.clientEmail})`,
    ...(created.clientPhone ? [`• WhatsApp: ${created.clientPhone}`] : []),
    `• Assunto: ${created.topic}`,
    `• Modalidade: ${created.meetingType}`,
    `• Data e Horário: ${dateLabel}`,
  ].join("\n");

  await Promise.allSettled([
    sendEmail({
      to: created.clientEmail,
      subject: `Reunião confirmada (${dateLabel}) — ArqVértice Studio`,
      text: clientBody,
      html: buildArqVerticeEmailTemplate({
        recipientName: created.clientName,
        category: "Agenda Confirmada",
        messageBody: clientBody,
      }),
      eventType: "message.sent",
      entityType: "ClientBooking",
      entityId: created.id,
    }),
    sendEmail({
      to: adminEmail,
      subject: `Novo Agendamento: ${sanitizeHeaderField(created.clientName, 60)} — ${dateLabel}`,
      text: adminBody,
      html: buildArqVerticeEmailTemplate({
        recipientName: "Eduardo Marques",
        category: "Novo Agendamento",
        messageBody: adminBody,
      }),
      eventType: "message.sent",
      entityType: "ClientBooking",
      entityId: created.id,
    }),
  ]);

  const gwCfg = await resolveOfficialGatewayConfig().catch(() => null);
  if (gwCfg?.autoNotifyBooking && created.clientPhone) {
    await sendViaOfficialGateway({
      phone: created.clientPhone,
      message: `Olá, ${created.clientName}! Sua reunião no ArqVértice Studio está confirmada para ${dateLabel} (${created.meetingType}) sobre: ${created.topic}.`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, booking: created });
}
