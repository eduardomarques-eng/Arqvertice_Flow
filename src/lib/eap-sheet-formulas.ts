/**
 * Avaliador seguro de fórmulas estilo planilha ("Sheets") para EAP & Planejamento LOB.
 * Não utiliza `eval` nem `new Function` — parser recursivo descendente puro.
 *
 * Suporta:
 * - Expressões aritméticas: +, -, *, /, parênteses, unário -, porcentagens (10%)
 * - Decimais pt-BR (12,5) e padrão (12.5)
 * - Funções: SOMA/SUM, MEDIA/AVERAGE, MIN/MÍN, MAX/MÁX, ARRED/ROUND
 * - Referências de célula e intervalos: C1, D4, C1:C5
 */

export type SheetFormulaResult =
  | { ok: true; value: number; isFormula: boolean; rawExpression: string }
  | { ok: false; error: string; rawExpression: string };

export type CellValueResolver = (cellRef: string) => number | null;

type Token =
  | { type: "NUMBER"; value: number }
  | { type: "IDENT"; value: string }
  | { type: "CELL"; value: string }
  | { type: "OP"; value: "+" | "-" | "*" | "/" }
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "COLON" }
  | { type: "SEP" }
  | { type: "PERCENT" };

const CELL_REF_REGEX = /^[A-Z]{1,3}[1-9][0-9]*$/;

function normalizeNumberLiteral(raw: string): number {
  const cleaned = raw.trim();
  // Se contém vírgula e ponto, assume pt-BR se a vírgula vier depois do ponto (1.234,56)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return Number(cleaned.replace(/\./g, "").replace(",", "."));
    }
    return Number(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", "."));
  }
  return Number(cleaned);
}

function tokenizeFormula(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN" });
      i += 1;
      continue;
    }
    if (ch === ":") {
      tokens.push({ type: "COLON" });
      i += 1;
      continue;
    }
    if (ch === ";") {
      tokens.push({ type: "SEP" });
      i += 1;
      continue;
    }
    if (ch === ",") {
      // Vírgula pode ser separador de argumento em inglês se estiver fora de número
      // Dentro de números (ex: 12,5), é lida pelo branch numérico abaixo.
      tokens.push({ type: "SEP" });
      i += 1;
      continue;
    }
    if (ch === "%") {
      tokens.push({ type: "PERCENT" });
      i += 1;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "OP", value: ch });
      i += 1;
      continue;
    }

    // Número: dígitos, ponto ou vírgula decimal (desde que seguido por dígito)
    if ((ch >= "0" && ch <= "9") || (ch === "." && i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "9")) {
      let start = i;
      while (i < s.length) {
        const c = s[i];
        if ((c >= "0" && c <= "9") || c === ".") {
          i += 1;
        } else if (c === "," && i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "9") {
          i += 1;
        } else {
          break;
        }
      }
      const numVal = normalizeNumberLiteral(s.slice(start, i));
      if (!Number.isFinite(numVal)) {
        throw new Error(`Número inválido: "${s.slice(start, i)}"`);
      }
      tokens.push({ type: "NUMBER", value: numVal });
      continue;
    }

    // Identificador (função ou referência de célula)
    if (/[A-Za-zÀ-ÿ_]/.test(ch)) {
      let start = i;
      while (i < s.length && /[A-Za-zÀ-ÿ0-9_]/.test(s[i])) {
        i += 1;
      }
      const rawIdent = s.slice(start, i).toUpperCase();
      if (CELL_REF_REGEX.test(rawIdent)) {
        tokens.push({ type: "CELL", value: rawIdent });
      } else {
        tokens.push({ type: "IDENT", value: rawIdent });
      }
      continue;
    }

    throw new Error(`Caractere não suportado na fórmula: "${ch}"`);
  }

  return tokens;
}

function colLettersToNumber(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i += 1) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n;
}

function numberToColLetters(num: number): string {
  let n = num;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function expandCellRange(startRef: string, endRef: string): string[] {
  const m1 = /^([A-Z]{1,3})([1-9][0-9]*)$/.exec(startRef.toUpperCase());
  const m2 = /^([A-Z]{1,3})([1-9][0-9]*)$/.exec(endRef.toUpperCase());
  if (!m1 || !m2) {
    throw new Error(`Intervalo inválido: ${startRef}:${endRef}`);
  }
  const c1 = colLettersToNumber(m1[1]);
  const r1 = Number(m1[2]);
  const c2 = colLettersToNumber(m2[1]);
  const r2 = Number(m2[2]);

  const minC = Math.min(c1, c2);
  const maxC = Math.max(c1, c2);
  const minR = Math.min(r1, r2);
  const maxR = Math.max(r1, r2);

  if ((maxC - minC + 1) * (maxR - minR + 1) > 2000) {
    throw new Error("Intervalo excede o limite de 2000 células.");
  }

  const refs: string[] = [];
  for (let r = minR; r <= maxR; r += 1) {
    for (let c = minC; c <= maxC; c += 1) {
      refs.push(`${numberToColLetters(c)}${r}`);
    }
  }
  return refs;
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function evaluateSheetInput(
  rawInput: string,
  resolveCell?: CellValueResolver
): SheetFormulaResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: true, value: 0, isFormula: false, rawExpression: rawInput };
  }

  if (!trimmed.startsWith("=")) {
    const directNum = normalizeNumberLiteral(trimmed.replace(/\s+/g, ""));
    if (!Number.isFinite(directNum)) {
      return { ok: false, error: "Valor numérico inválido.", rawExpression: rawInput };
    }
    return { ok: true, value: directNum, isFormula: false, rawExpression: rawInput };
  }

  const exprBody = trimmed.slice(1).trim();
  if (!exprBody) {
    return { ok: false, error: "Fórmula vazia após '='.", rawExpression: rawInput };
  }

  try {
    const tokens = tokenizeFormula(exprBody);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const resolveRef = (ref: string): number => {
      if (!resolveCell) return 0;
      const val = resolveCell(ref);
      return val !== null && Number.isFinite(val) ? val : 0;
    };

    const parseFunctionArgs = (): number[] => {
      const values: number[] = [];
      if (peek()?.type === "RPAREN") {
        consume();
        return values;
      }
      while (pos < tokens.length) {
        const t0 = peek();
        const t1 = tokens[pos + 1];
        const t2 = tokens[pos + 2];
        // Verifica intervalo A1:B5 como argumento direto
        if (t0?.type === "CELL" && t1?.type === "COLON" && t2?.type === "CELL") {
          consume();
          consume();
          consume();
          const refs = expandCellRange(t0.value, t2.value);
          for (const ref of refs) {
            values.push(resolveRef(ref));
          }
        } else {
          values.push(parseExpression());
        }

        const next = peek();
        if (next?.type === "SEP") {
          consume();
          continue;
        }
        if (next?.type === "RPAREN") {
          consume();
          return values;
        }
        throw new Error("Esperado ',' / ';' ou ')' na chamada de função.");
      }
      throw new Error("Parêntese ')' ausente na função.");
    };

    const callFunction = (nameRaw: string, args: number[]): number => {
      const fn = stripAccents(nameRaw.toUpperCase());
      if (fn === "SOMA" || fn === "SUM") {
        return args.reduce((acc, v) => acc + v, 0);
      }
      if (fn === "MEDIA" || fn === "AVERAGE" || fn === "AVG") {
        if (args.length === 0) return 0;
        return args.reduce((acc, v) => acc + v, 0) / args.length;
      }
      if (fn === "MIN") {
        if (args.length === 0) return 0;
        return Math.min(...args);
      }
      if (fn === "MAX") {
        if (args.length === 0) return 0;
        return Math.max(...args);
      }
      if (fn === "ARRED" || fn === "ROUND") {
        const val = args[0] ?? 0;
        const dec = Math.max(0, Math.min(6, Math.trunc(args[1] ?? 2)));
        const factor = Math.pow(10, dec);
        return Math.round(val * factor) / factor;
      }
      throw new Error(`Função desconhecida: ${nameRaw}`);
    };

    const parsePrimary = (): number => {
      const t = peek();
      if (!t) throw new Error("Expressão incompleta.");

      if (t.type === "NUMBER") {
        consume();
        return t.value;
      }
      if (t.type === "CELL") {
        consume();
        return resolveRef(t.value);
      }
      if (t.type === "IDENT") {
        consume();
        if (peek()?.type !== "LPAREN") {
          throw new Error(`Identificador inesperado: ${t.value}`);
        }
        consume(); // '('
        const args = parseFunctionArgs();
        return callFunction(t.value, args);
      }
      if (t.type === "LPAREN") {
        consume();
        const val = parseExpression();
        if (peek()?.type !== "RPAREN") {
          throw new Error("Parêntese ')' ausente.");
        }
        consume();
        return val;
      }
      throw new Error("Token inesperado na fórmula.");
    };

    const parsePostfix = (): number => {
      let val = parsePrimary();
      while (peek()?.type === "PERCENT") {
        consume();
        val = val / 100;
      }
      return val;
    };

    const parseUnary = (): number => {
      const t = peek();
      if (t?.type === "OP" && (t.value === "-" || t.value === "+")) {
        consume();
        const v = parseUnary();
        return t.value === "-" ? -v : v;
      }
      return parsePostfix();
    };

    const parseTerm = (): number => {
      let left = parseUnary();
      while (true) {
        const t = peek();
        if (t?.type === "OP" && (t.value === "*" || t.value === "/")) {
          consume();
          const right = parseUnary();
          if (t.value === "/") {
            if (right === 0) throw new Error("Divisão por zero.");
            left = left / right;
          } else {
            left = left * right;
          }
        } else {
          break;
        }
      }
      return left;
    };

    const parseExpression = (): number => {
      let left = parseTerm();
      while (true) {
        const t = peek();
        if (t?.type === "OP" && (t.value === "+" || t.value === "-")) {
          consume();
          const right = parseTerm();
          left = t.value === "+" ? left + right : left - right;
        } else {
          break;
        }
      }
      return left;
    };

    const result = parseExpression();
    if (pos < tokens.length) {
      throw new Error("Tokens extras após o fim da expressão.");
    }
    if (!Number.isFinite(result)) {
      return { ok: false, error: "Resultado inválido (NaN/Infinito).", rawExpression: rawInput };
    }
    const rounded = Math.round(result * 10000) / 10000;
    return { ok: true, value: rounded, isFormula: true, rawExpression: trimmed };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao avaliar fórmula.",
      rawExpression: rawInput,
    };
  }
}

export interface EapSheetRowLike {
  quantity: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  directTotal?: number;
  commercialTotal?: number;
}

/**
 * Cria um resolvedor de células (C=Qtd, D=Mat, E=MO, F=Terc, G=Subtotal, H=Total c/ BDI)
 * indexado pelas linhas visíveis (1-based: C1, D2, etc.).
 */
export function buildEapCellMatrixResolver(
  rows: ReadonlyArray<EapSheetRowLike>
): CellValueResolver {
  return (cellRef: string) => {
    const m = /^([A-Z]+)([1-9][0-9]*)$/.exec(cellRef.toUpperCase());
    if (!m) return null;
    const col = m[1];
    const rowIdx = Number(m[2]) - 1;
    const row = rows[rowIdx];
    if (!row) return 0;

    switch (col) {
      case "C":
        return row.quantity;
      case "D":
        return row.materialUnitCost;
      case "E":
        return row.laborUnitCost;
      case "F":
        return row.thirdPartyUnitCost;
      case "G":
        return (
          row.directTotal ??
          row.quantity * (row.materialUnitCost + row.laborUnitCost + row.thirdPartyUnitCost)
        );
      case "H":
        return row.commercialTotal ?? row.directTotal ?? 0;
      default:
        return 0;
    }
  };
}
