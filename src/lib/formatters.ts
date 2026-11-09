/**
 * Utilitários Oficiais de Formatação Regional (pt-BR) - ArqVértice Flow
 * Padroniza datas (DD/MM/AAAA) e valores monetários (R$ 1.234,56),
 * prevenindo erros de "Invalid Date" e desvios de fuso horário (UTC offset).
 */

export function formatCurrencyBRL(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date || date === "—") return "—";

  // Tratamento seguro para strings no formato YYYY-MM-DD ou ISO
  let d: Date;
  if (typeof date === "string") {
    const trimmed = date.trim();
    // Se já estiver no formato DD/MM/AAAA
    const brParts = trimmed.split("/");
    if (brParts.length === 3 && brParts[0].length === 2 && brParts[2].length === 4) {
      d = new Date(parseInt(brParts[2], 10), parseInt(brParts[1], 10) - 1, parseInt(brParts[0], 10));
    } else {
      // Trata formato YYYY-MM-DD sem shift de timezone UTC
      const parts = trimmed.split("T")[0].split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        d = new Date(date);
      }
    }
  } else {
    d = date;
  }

  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function toInputDateFormat(date: string | Date | null | undefined): string {
  if (!date) return "";

  if (typeof date === "string") {
    const trimmed = date.trim();
    // Se for formato DD/MM/AAAA
    const brParts = trimmed.split("/");
    if (brParts.length === 3 && brParts[0].length === 2 && brParts[2].length === 4) {
      return `${brParts[2]}-${brParts[1].padStart(2, "0")}-${brParts[0].padStart(2, "0")}`;
    }
    // Se for formato YYYY-MM-DD ou ISO
    const parts = trimmed.split("T")[0].split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Alias de compatibilidade
export const toISODateInput = toInputDateFormat;

export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const str = String(value).trim();
  const brParts = str.split("/");
  if (brParts.length === 3 && brParts[0].length === 2 && brParts[2].length === 4) {
    return new Date(parseInt(brParts[2], 10), parseInt(brParts[1], 10) - 1, parseInt(brParts[0], 10));
  }

  const isoParts = str.split("T")[0].split("-");
  if (isoParts.length === 3 && isoParts[0].length === 4) {
    return new Date(parseInt(isoParts[0], 10), parseInt(isoParts[1], 10) - 1, parseInt(isoParts[2], 10));
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
