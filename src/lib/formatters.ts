/**
 * Utilitários Oficiais de Formatação Regional (pt-BR) - ArqVértice Flow
 * Padroniza datas (DD/MM/AAAA) e valores monetários (R$ 1.234,56),
 * prevenindo erros comuns como "Invalid Date" ao receber formatos variados.
 */

/**
 * Formata qualquer representação de data (ISO, Date, DD/MM/AAAA) para o padrão estrito brasileiro (DD/MM/AAAA).
 */
export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value || value === "—") return "—";

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "—";
    const day = String(value.getUTCDate()).padStart(2, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const year = value.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(value).trim();

  // Caso 1: Já está no formato DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // Caso 2: Formato ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  // Caso 3: Parse com Date
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  return str;
}

/**
 * Converte qualquer representação de data para o padrão YYYY-MM-DD exigido por inputs do tipo date (<input type="date">).
 */
export function toISODateInput(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return new Date().toISOString().slice(0, 10);
    return value.toISOString().slice(0, 10);
  }

  const str = String(value).trim();

  // Se for DD/MM/AAAA -> converter para YYYY-MM-DD
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  // Se já for ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Converte de forma segura qualquer formato de data para objeto Date nativo.
 */
export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const str = String(value).trim();

  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return new Date(Date.UTC(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1])));
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata valores numéricos para o padrão monetário brasileiro (R$ 1.234,56).
 */
export function formatCurrencyBRL(amount: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount || 0);
}
