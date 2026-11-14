# Relatório de Avaliação de Segurança (AppSec / Red Team) — ArqVértice Flow

- **Data:** 2026-11-14
- **Escopo:** `./src` (App Router, API Routes, Middleware, Auth/Session, RBAC)
- **Nota sobre Strix AI:** As variáveis `AI_GATEWAY_API_KEY` e `OPENROUTER_API_KEY` não estão configuradas neste ambiente, impossibilitando a execução do scanner LLM automatizado do Strix CLI. Foi executada auditoria manual ofensiva completa (Red Team / AppSec) em 100% das rotas de API, middleware e controle de sessão, com todas as falhas encontradas corrigidas na causa-raiz.

---

## Vulnerabilidades Identificadas e Corrigidas

| ID | Severidade | Alvo | Achado | Correção Aplicada |
| :--- | :---: | :--- | :--- | :--- |
| SEC-01 | **ALTA** | `src/app/api/realtime/stream/route.ts` | A rota SSE verificava apenas se o cookie `arqvertice_session` era não-vazio (`request.cookies.get(...)?.value`), sem validar o token no banco nem checar `isActive`, `sessionVersion` ou `buildId`. Um atacante podia abrir o stream enviando um cookie arbitrário. | Substituído por `await currentUser()`, validando sessão real no Neon Postgres, expiração, status ativo, `sessionVersion` e `buildId`. |
| SEC-02 | **MÉDIA** | `src/app/api/cron/housekeeping/route.ts`<br>`src/app/api/cron/process-events/route.ts` | Comparação de `CRON_SECRET` via operador `===` (suscetível a timing side-channel) e sem validação de tamanho mínimo do segredo. | Implementada comparação em tempo constante via `node:crypto` `timingSafeEqual` com exigência de `CRON_SECRET.length >= 16`. |
| SEC-03 | **MÉDIA** | `src/server/auth.ts`<br>`src/middleware.ts`<br>`src/app/api/auth/session-status/route.ts` | Sessões antigas permaneciam válidas após um novo build/deploy publicado na Vercel. | Adicionado `buildId` (`NEXT_PUBLIC_BUILD_ID` / `APP_BUILD_ID`) gerado por build, vinculado ao modelo `Session` no Prisma e ao cookie `arqvertice_build_id`. Divergências invalidam a sessão no banco, limpam cookies (`Max-Age=0`) e redirecionam para `/`. |
| SEC-04 | **MÉDIA** | `src/app/page.tsx`<br>`src/components/auth/session-guard.tsx` | A rota `/` redirecionava automaticamente sessões pré-existentes sem exigir nova autenticação explícita, e o `SessionGuard` podia exibir modal sobre layout parcial quando a aba era reaberta. | Removido o auto-redirect de `/`. O `SessionGuard` agora exige `arqvertice_tab_authenticated === "true"` e `arqvertice_build_id === NEXT_PUBLIC_BUILD_ID`, aplicando overlay opaco de tela cheia e logout imediato em qualquer divergência. |
| SEC-05 | **MÉDIA** | `src/app/equipe/*` | Páginas de `/equipe` utilizavam `requireModulePermission` sem redirecionamento bloqueante e passavam `environment="admin"` ao `AppShell`. | Substituído por `await requireModuleAccess(...)` no servidor e removido `environment="admin"`. |

---

## Controles Verificados e Aprovados

- **Cookies de Sessão:** `httpOnly: true`, `sameSite: "lax"`, `secure: true` em produção, sem `Max-Age`/`Expires` (Session Cookie estrito).
- **CSRF / Origem:** Validação de `Origin` no middleware para métodos mutantes (`POST`, `PUT`, `PATCH`, `DELETE`).
- **IDOR / BOLA:** Todas as rotas `/api/projects/[id]/*`, `/api/clients/[id]/*`, `/api/propostas/[id]/*`, `/api/admin/settings/*` e páginas `[id]` validam `requireRole("ADMIN")` ou `requirePageProjectAccess(id)` + `requireModuleAccess(...)`.
- **Segredos:** Nenhuma chave de API ou credencial hardcoded no repositório.
