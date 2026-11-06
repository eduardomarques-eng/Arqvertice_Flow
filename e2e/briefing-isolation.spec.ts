/**
 * Isolamento do briefing — a garantia central do portal.
 *
 * O briefing é o canal por onde o cliente descreve o projeto. A segurança aqui
 * não é "esconder a página": é garantir que um cliente só chega ao SEU projeto
 * e que um token de briefing de um projeto não serve para o projeto de outro.
 * Sem banco estes testes ficavam `skipped` — a garantia nunca era exercitada.
 *
 * Pré-condições (injetadas por scripts/e2e-local.mjs a partir do seed):
 *   E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD  -> cliente dono de um projeto
 *   E2E_OWN_PROJECT_ID / E2E_FOREIGN_PROJECT_ID -> dois projetos distintos
 *   E2E_BRIEFING_TOKEN                      -> token de briefing válido (projeto do cliente)
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { CLIENT_STORAGE_STATE } from "./auth-state";

/** Só corre com as variáveis do seed; sem banco, fica `skipped` (nunca verde falso). */
const CONFIGURADO = Boolean(
  process.env.E2E_CLIENT_EMAIL &&
    process.env.E2E_CLIENT_PASSWORD &&
    process.env.E2E_OWN_PROJECT_ID &&
    process.env.E2E_FOREIGN_PROJECT_ID,
);

const constrangedor = { describe: CONFIGURADO ? test.describe.bind(test) : test.describe.skip.bind(test) };

/** Abre o briefing guiado do projeto do cliente e espera a interface estar pronta. */
async function abrir(page: Page, projectId: string) {
  await page.goto(`/portal/${projectId}/briefing`);
  // A primeira pergunta da etapa 1 é `SHORT_TEXT` e renderiza um <input id="p1_nome_preferido">.
  await expect(page.locator("#p1_nome_preferido")).toBeVisible({ timeout: 30_000 });
}

constrangedor.describe("persistência do briefing", () => {
  test("nega token de briefing inválido sem expor dados", async ({ page }) => {
    await page.goto("/briefing/token-que-nao-existe-000");
    // Token inexistente -> a rota chama notFound(): a página 404 é renderizada.
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible({ timeout: 30_000 });
    // Garantia central: o formulário de briefing NUNCA aparece para token inválido.
    await expect(page.getByText("Vamos construir esse projeto juntos")).toHaveCount(0);
  });

  test("rejeita token de briefing inventado sem expor dados", async ({ page }) => {
    await page.goto("/briefing/00000000-0000-4000-8000-000000000000");
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Vamos construir esse projeto juntos")).toHaveCount(0);
  });
});

constrangedor.describe("Briefing – isolamento", () => {
  // Reutiliza a sessão gravada pelo global-setup (cookie httpOnly), sem novo login:
  // evita estourar o rate-limit de 8 logins / 5 min do fluxo de autenticação real.
  test.use({ storageState: CLIENT_STORAGE_STATE });

  test("cliente não acede ao projeto de outro cliente", async ({ page }) => {
    const foreignProjectId = process.env.E2E_FOREIGN_PROJECT_ID!;

    // Acesso direto ao projeto alheio, já autenticado como o CLIENT dono:
    // o servidor tem de negar, não devolver dados.
    await page.goto(`/portal/${foreignProjectId}`);
    const conteudo = (await page.content()).toLowerCase();
    const redirecionou = /\/portal(\/|$|\?)|não encontrado|nao encontrado|sem permiss|acesso negado/i.test(
      page.url(),
    );
    const negou =
      /não encontrado|nao encontrado|sem permiss|acesso negado|403|404/.test(conteudo) ||
      redirecionou;
    expect(negou, "o projeto alheio não deve ser acessível pelo cliente").toBeTruthy();
  });
});

constrangedor.describe("Isolamento do briefing", () => {
  // Sessão reutilizada (cookie gravado no global-setup): sem novo login, sob o rate-limit.
  test.use({ storageState: CLIENT_STORAGE_STATE });

  test("persiste a resposta e a mantém após recarregar a página", async ({ page }) => {
    // Este teste é mais lento por natureza (hidratação do briefing + autosave com
    // debounce + recarga). O default de 30s do Playwright corta-o a meio; por isso
    // um timeout explícito e honesto, em vez de enfraquecer qualquer verificação.
    test.setTimeout(180_000);
    const ownProjectId = process.env.E2E_OWN_PROJECT_ID!;

    await abrir(page, ownProjectId);
    // A primeira pergunta (SHORT_TEXT) é um <input> CONTROLADO por React, e é o
    // ponto mais sensível da suíte. Falhas reais observadas em mobile-chrome
    // (em chromium passa sempre):
    //   · escrever antes de o componente cliente hidratar é REVERTIDO pelo React
    //     (o estado fica "Tudo guardado"/inactivo, sem autosave) — uma corrida que
    //     alterna entre execuções;
    //   · e os projetos chromium e mobile partilham o mesmo E2E_OWN_PROJECT_ID e a
    //     mesma base — o teste 9 (chromium) já gravou "Resposta E2E persistida"
    //     aqui, pelo que reescrever o mesmo valor não gera mudança nem autosave.
    // Correção determinística e idempotente: dentro de `toPass`, escrever um valor
    // DIFERENTE (força mudança, evita a colisão) e só depois o valor final; ter
    // sucesso APENAS quando "Guardado" aparecer — prova real de que o autosave
    // correu. `toPass` reexecuta a sequência através de qualquer corrida de
    // hidratação, sem enfraquecer as asserções (o valor persistido é verificado
    // abaixo, após recarregar).
    const primeiraResposta = page.locator("#p1_nome_preferido");
    await expect(async () => {
      await primeiraResposta.fill("rascunho temporario e2e");
      await primeiraResposta.fill("Resposta E2E persistida");
      await expect(page.getByText(/^Guardado$/).first()).toBeVisible({ timeout: 8000 });
    }).toPass({ timeout: 60_000 });
    // Confirmação definitiva do autosave (estado pós-guardar, não o "Tudo guardado").
    await expect(page.getByText(/^Guardado$/).first()).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.locator("#p1_nome_preferido")).toHaveValue("Resposta E2E persistida", {
      timeout: 30_000,
    });
  });
});
