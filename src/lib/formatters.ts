/**
 * Utilitários Oficiais de Formatação Regional (pt-BR) - ArqVértice OS
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

/**
 * Converte entradas monetárias BRL ("R$ 2.440,50", "2.440,50", "2440.5", 2440.5)
 * de forma determinística para number arredondado em 2 casas decimais.
 * Retorna null se inválido, negativo ou vazio.
 */
export function parseCurrencyBRL(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") return null;

  let cleaned = value
    .replace(/R\$/gi, "")
    .replace(/\u00A0/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned) return null;

  if (cleaned.includes(",")) {
    // Formato pt-BR: pontos são separadores de milhar, vírgula é decimal
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Formato "2.440" ou "1.250.000" sem vírgula decimal
    cleaned = cleaned.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
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
