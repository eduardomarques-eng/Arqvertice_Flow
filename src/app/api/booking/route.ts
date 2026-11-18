import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { ensureEmailBootstrap } from "@/lib/email/email-infra";

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

  const scheduledAt = new Date(`${body.date}T${body.time}:00.000Z`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Data ou horário inválido." }, { status: 400 });
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
      clientName: body.clientName.trim(),
      clientEmail: body.clientEmail.trim().toLowerCase(),
      clientPhone: body.clientPhone?.trim() || null,
      topic: body.topic.trim(),
      meetingType: body.meetingType === "PRESENCIAL" ? "PRESENCIAL" : "ONLINE",
      scheduledAt,
      durationMin: 45,
      status: "CONFIRMED",
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, booking: created });
}
