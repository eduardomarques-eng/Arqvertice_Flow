/**
 * Ambiente E2E local, de ponta a ponta.
 *
 * Os testes de isolamento do portal provam que um cliente NAO acede ao projeto
 * de outro. Sem base de dados eles ficavam `skipped` e a garantia de seguranca
 * central nunca era executada. Este script sobe um PostgreSQL embebido, aplica
 * as migrations, cria as fixtures de isolamento e corre o Playwright.
 *
 *   node scripts/e2e-local.mjs [e2e/<spec>.ts]
 *
 * Nada toca a producao: a base vive numa pasta temporaria e e destruida no fim.
 *
 * Servidor:
 *   - Se E2E_BASE_URL estiver definida, valida a URL, confirma que o servidor
 *     responde e NAO inicia outro Next.js.
 *   - Se nao estiver definida, delega ao `webServer` do playwright.config.ts,
 *     que inicia e supervisiona `npm run dev` (nunca duplicamos inicializacao).
 *
 * Este script NAO mata processos externos nem limpa a porta 3000.
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORTA = 55432;
const UTILIZADOR = "e2e";
const SENHA = "e2e-local";
const BASE = "arqvertice_e2e";
const PORTA_APP = 3000;

// Bypass: se E2E_DATABASE_URL estiver definida, usa uma base externa de teste
// (ex.: Neon/Supabase). O PostgreSQL embebido nao funciona neste Windows, por
// isso este e o caminho suportado para correr o E2E dependente de banco.
const isExternalDB = Boolean(process.env.E2E_DATABASE_URL);
let url = process.env.E2E_DATABASE_URL || `postgresql://${UTILIZADOR}:${SENHA}@localhost:${PORTA}/${BASE}`;

const pastaDados = mkdtempSync(join(tmpdir(), "arqvertice-e2e-"));

// Segredo local de 32+ caracteres, exclusivo da base temporaria. Nunca producao.
const AUTH_SECRET = process.env.AUTH_SECRET ?? "e2e-local-only-secret-com-32-ou-mais-caracteres";

/**
 * Corre um comando e trata erro de spawn, sinal e codigo de saida.
 * `linha` e o comando completo; corre com shell para resolver npx/cmd no Windows.
 */
function correr(linha, ambiente, opcoes = {}) {
  const { stdio = "inherit" } = opcoes;
  const resultado = spawnSync(linha, [], {
    stdio,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, ...ambiente },
  });
  if (resultado.error) {
    throw new Error(`Falha ao executar "${linha}": ${resultado.error.message}`);
  }
  if (resultado.signal) {
    throw new Error(`"${linha}" morto por sinal ${resultado.signal}`);
  }
  if (resultado.status !== 0) {
    throw new Error(`"${linha}" terminou com codigo ${resultado.status}`);
  }
  return resultado;
}

/** Faz polling HTTP ate o servidor responder (<500) ou esgotar o tempo. */
async function servidorResponde(baseURL, timeoutMs = 90000) {
  const alvo = baseURL.replace(/\/+$/, "");
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(alvo, { signal: controller.signal, redirect: "manual" });
      clearTimeout(timer);
      if (res.status > 0 && res.status < 500) return true;
    } catch {
      /* servidor ainda a subir */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

const ambiente = {
  DATABASE_URL: url,
  AUTH_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${PORTA_APP}`,
};

const usarBaseURL = Boolean(process.env.E2E_BASE_URL);
if (usarBaseURL) {
  try {
    new URL(process.env.E2E_BASE_URL);
  } catch {
    console.error(`E2E_BASE_URL nao e uma URL valida: ${process.env.E2E_BASE_URL}`);
    process.exit(2);
  }
}

const postgres = new EmbeddedPostgres({
  databaseDir: pastaDados,
  user: UTILIZADOR,
  password: SENHA,
  port: PORTA,
  persistent: false,
});

try {
  if (isExternalDB) {
    console.log("Usando banco de dados E2E externo fornecido via E2E_DATABASE_URL.");
  } else {
    console.log("A inicializar PostgreSQL embebido (a primeira vez descarrega binarios; pode demorar)...");
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase(BASE);
    console.log(`Postgres embebido em ${url}`);
  }

  correr("npx prisma migrate deploy", ambiente);
  console.log("Migrations aplicadas.");

  const seed = correr("npx tsx e2e/seed-isolation.ts", ambiente, { stdio: "pipe" });
  const variaveis = {};
  for (const linha of (seed.stdout ?? "").split("\n")) {
    const achado = linha.match(/^(E2E_[A-Z_]+)=(.*)$/);
    if (achado) variaveis[achado[1]] = achado[2].trim();
  }
  const obrigatorias = [
    "E2E_CLIENT_EMAIL",
    "E2E_CLIENT_PASSWORD",
    "E2E_OWN_PROJECT_ID",
    "E2E_FOREIGN_PROJECT_ID",
    "E2E_BRIEFING_TOKEN",
  ];
  for (const chave of obrigatorias) {
    if (!variaveis[chave]) {
      throw new Error(`O seed nao gerou a variavel obrigatoria ${chave}.`);
    }
  }
  console.log(`Fixtures criadas (${Object.keys(variaveis).length} variaveis E2E_*).`);

  if (usarBaseURL) {
    console.log(`A validar servidor em ${process.env.E2E_BASE_URL} ...`);
    const ok = await servidorResponde(process.env.E2E_BASE_URL);
    if (!ok) {
      throw new Error(
        `O servidor nao responde em ${process.env.E2E_BASE_URL}. Inicie o Next.js antes de correr o E2E.`,
      );
    }
    console.log("Servidor disponivel (reutilizado, sem iniciar segundo Next.js).");
  } else {
    console.log("E2E_BASE_URL nao definida: o webServer do Playwright iniciara `npm run dev`.");
  }

  const specs = process.argv.slice(2);
  const filtro = specs.join(" ");
  console.log(filtro ? `A correr Playwright: ${filtro}` : "A correr suite E2E completa.");
  const pw = correr(`npx playwright test ${filtro} --workers=1`, { ...ambiente, ...variaveis });
  if (pw.status !== 0) {
    process.exitCode = pw.status;
    console.error(`Playwright terminou com codigo ${pw.status}.`);
  } else {
    console.log("E2E concluido.");
  }
} finally {
  // Encerra o PostgreSQL embebido (apenas se foi iniciado) e limpa a pasta temporaria, mesmo em erro.
  if (!isExternalDB) {
    await postgres.stop().catch(() => {});
  }
  try {
    rmSync(pastaDados, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* pasta temporaria ja libertada */
  }
}
