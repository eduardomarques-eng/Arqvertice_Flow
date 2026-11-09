import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function formatIcsDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const whereClause: { projectId?: string } = {};
  if (projectId) {
    whereClause.projectId = projectId;
  }

  const stages = await prisma.scheduleStage.findMany({
    where: whereClause,
    include: {
      project: { select: { name: true } },
    },
    orderBy: { order: "asc" },
  });

  const now = new Date();
  const dtstamp = formatIcsDate(now);

  const events = stages
    .filter((s) => s.dueDate)
    .map((s) => {
      const due = new Date(s.dueDate!);
      const start = s.startDate ? new Date(s.startDate) : due;
      const end = new Date(due.getTime() + 24 * 60 * 60 * 1000);

      const dtstart = formatIcsDate(start);
      const dtend = formatIcsDate(end);

      const summary = `[${s.project.name}] ${s.name}`;
      const description = `Projeto: ${s.project.name}\\nDisciplina: ${s.discipline || "Geral"}\\nResponsável: ${s.designer || "Eduardo Marques"}\\nAvanço: ${s.completion}%\\nStatus: ${s.status}`;

      return [
        "BEGIN:VEVENT",
        `UID:stage-${s.id}@arqvertice.com.br`,
        `DTSTAMP:${dtstamp}T000000Z`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ArqVertice Studio//Flow Engineering v2.4//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ArqVértice Flow - Cronograma Oficial",
    "X-WR-TIMEZONE:America/Fortaleza",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arqvertice-cronograma.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

