"use server";

export interface GoogleCalendarEventParams {
  title: string;
  description: string;
  location?: string;
  startDate: Date | string;
  endDate?: Date | string | null;
}

/**
 * Formata data no padrão ISO para Google Calendar (YYYYMMDD ou YYYYMMDDTHHmmssZ)
 */
function formatGoogleDate(date: Date, allDay = true): string {
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Gera o link direto de adição de evento no Google Calendar
 */
export async function generateGoogleCalendarUrl({
  title,
  description,
  location = "ArqVértice Studio / Canteiro Litorâneo",
  startDate,
  endDate,
}: GoogleCalendarEventParams): Promise<string> {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = endDate ? (typeof endDate === "string" ? new Date(endDate) : endDate) : new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const startStr = formatGoogleDate(start, true);
  const endStr = formatGoogleDate(end, true);

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", `${startStr}/${endStr}`);
  url.searchParams.set("details", description);
  url.searchParams.set("location", location);

  return url.toString();
}

/**
 * Retorna os links de inscrição direta no Google Agenda para o Admin
 */
export async function getCalendarSubscriptionLinks(baseUrl = "https://arqvertice-flow.vercel.app") {
  const icsFeedUrl = `${baseUrl}/api/calendar/export`;
  const webcalUrl = icsFeedUrl.replace(/^https?:\/\//i, "webcal://");
  const googleSubscribeUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  return {
    icsFeedUrl,
    webcalUrl,
    googleSubscribeUrl,
  };
}

