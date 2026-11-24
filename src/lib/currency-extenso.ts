const UNITS = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];

const TEENS = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];

const TENS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function groupToWords(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rem = n % 100;

  if (h > 0) parts.push(HUNDREDS[h]);

  if (rem >= 10 && rem <= 19) {
    parts.push(TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const u = rem % 10;
    if (t > 0) parts.push(TENS[t]);
    if (u > 0) parts.push(UNITS[u]);
  }

  return parts.join(" e ");
}

function integerToWords(n: number): string {
  if (n === 0) return "zero";

  const scales: Array<[string, string]> = [
    ["", ""],
    ["mil", "mil"],
    ["milhão", "milhões"],
    ["bilhão", "bilhões"],
  ];

  const groups: number[] = [];
  let temp = n;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;

    if (i === 1 && g === 1) {
      parts.push("mil");
      continue;
    }

    const words = groupToWords(g);
    const scale = scales[i];
    if (!scale || !scale[0]) {
      parts.push(words);
    } else {
      parts.push(`${words} ${g === 1 ? scale[0] : scale[1]}`);
    }
  }

  if (parts.length <= 1) return parts[0] ?? "";

  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1);
  const lastGroup = groups[0];
  const joinWithE = lastGroup > 0 && (lastGroup < 100 || lastGroup % 100 === 0);
  return `${rest.join(", ")}${joinWithE ? " e " : " "}${last}`;
}

/**
 * Converte um valor monetário em reais (BRL) para extenso em português brasileiro.
 */
export function valorPorExtensoBRL(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) {
    return "zero real";
  }

  const totalCents = Math.round(num * 100);
  const reais = Math.floor(totalCents / 100);
  const centavos = totalCents % 100;

  const chunks: string[] = [];
  if (reais > 0) {
    const reaisWord = integerToWords(reais);
    const suffix =
      reais === 1
        ? "real"
        : reais >= 1_000_000 && reais % 1_000_000 === 0
          ? "de reais"
          : "reais";
    chunks.push(`${reaisWord} ${suffix}`);
  }

  if (centavos > 0) {
    const centavosWord = integerToWords(centavos);
    chunks.push(`${centavosWord} ${centavos === 1 ? "centavo" : "centavos"}`);
  }

  return chunks.join(" e ");
}
