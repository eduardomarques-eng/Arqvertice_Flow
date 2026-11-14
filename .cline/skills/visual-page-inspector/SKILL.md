---
name: visual-page-inspector
description: Inspeciona visualmente e funcionalmente rotas locais ou de produção do ArqVértice Flow via Playwright MCP em Desktop (1440x900) e Mobile (375x812), validando console, rede, tema Apple-minimalista e responsividade.
---

# Visual Page Inspector — ArqVértice Flow

Use esta skill sempre que precisar validar visualmente uma página ou fluxo no navegador (local `http://localhost:3000` ou produção `https://arqvertice-flow.vercel.app`) usando o servidor **Playwright MCP**.

## Fluxo Obrigatório de Inspeção

1. **Autenticação Automática:**
   - Acesse `/` no Playwright MCP.
   - Se a rota alvo for `/admin/**`, autentique-se como `ADMIN` (`eduardo.marques.arq@gmail.com`).
   - Se a rota alvo for `/equipe/**`, autentique-se como `ENGENHEIRO` (`wagner.silva@arqvertice.com.br`).
   - Para `/portal/**`, utilize uma conta de cliente ativa.

2. **Auditoria Multi-Viewport:**
   - **Desktop (`1440x900`):** Navegue até a URL alvo, aguarde estabilização de rede e DOM.
   - **Mobile (`375x812`):** Redimensione a viewport, abra o drawer do menu lateral (`AppShell` / `MobileNav`) e valide a navegação.

3. **Critérios de Aprovação (Zero Tolerância):**
   - **Console & Runtime:** 0 erros não tratados (`console.error`, `pageerror`, Hydration mismatch).
   - **Rede:** 0 falhas HTTP `4xx`/`5xx` inesperadas nos assets ou chamadas de API da página.
   - **Tema Claro Apple-Minimalista:** Fundo principal claro (`#F5F5F7` / `bg-slate-50`) com cards brancos e contraste nítido. Nunca exibir fundo escuro/preto quebrado na área principal.
   - **Layout & Responsividade Mobile:** Zero overflow horizontal (`document.documentElement.scrollWidth <= window.innerWidth`), tabelas com `overflow-x-auto` e botões clicáveis sem sobreposição.
   - **Links & Ações:** Testar botões principais (`Abrir Kanban`, `Ficha Técnica`, `Pagamentos`, abas e modais) confirmando navegação e `router.refresh()` após mutações.

4. **Correção Imediata:**
   - Caso qualquer critério falhe, corrija a causa raiz no código fonte, valide com `npx tsc --noEmit` e `npm run build` e re-inspecione a rota antes de concluir.
