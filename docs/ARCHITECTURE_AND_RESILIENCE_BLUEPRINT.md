# ARqVértice Flow — Blueprint de Engenharia de Produção e Resiliência

## Visão Geral
Este documento descreve os mecanismos operados pela camada de infraestrutura/nuvem do ArqVértice Flow, complementando a implementação em código da camada de aplicação. O objetivo é proporcionar consistência e auditabilidade para as 81 pilares de engenharia de produção.

---

## Bloco A: Segurança, Borda, API Gateway & Cache
### 1. API Gateway & Controle de Acesso Centralizado (src/middleware.ts)
O middleware.ts atua como a única camada de API Gateway e Proxy Reverso Lógico, aplicando:
- Validação de autenticação: Verificação antecipada de cookie de sessão (arqvertice_session) nas rotas protegidas (/admin, /equipe, /portal, /clientes, /projetos, /propostas, /relatorio).
- Proteção CSRF via verificação de Origin/Host: Requisições com origem/sinkhost não autorizadas são bloqueadas.
- Injeção de cabeçalhos de segurança: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP.
- Injeção de X-Request-Id para rastreamento distribuído em toda resposta.
- Cache-Control: no-store, max-age=0 em rotas autenticadas e /api/auth/session-status para evitar vazamento de sessão entre usuários.
- Revalidação controlada apenas em catálogos públicos/estáticos (serviços e portfólio) via revalidateTag.
### 2. Rate Limiting Multicamada (src/lib/rate-limit.ts)
Três políticas diferenciadas por criticidade declarativas via RATE_LIMITS:
- Autenticação (/api/auth/login): máx. 8 req / 5 min por IP+e-mail. Bloqueio early antes de consultar o banco.
- Mutações críticas (/api/finance/**, /api/projects/**, /api/propostas/**): máx. 60 req / min por usuário.
- Rotas públicas (/api/briefings, /api/health, /api/auth/session-status): máx. 30 req / min por IP.
### 3. Criptografia, Hashing & Auditoria de Dependências
- sslmode=require no Neon Postgres (CONFIGURA EM .env DATABASE_URL).
- src/lib/crypto-fields.ts (AES-256-GCM) para cifrar segredos/tokens armazenados em banco.
- npm audit --audit-level=high: 10 vulnerabilidades (4 moderate, 5 high, 1 critical - Next.js RCE na Image Optimization API). Fix: npm audit fix ou npm audit fix --force.

## Bloco B: Fundamentos (Banco de Dados, Performance, Locks, Controle de Concorrência, Otimização)
### 1. Índices Estratégicos no Prisma (prisma/schema.prisma)
- User: @@index([email]), @@index([role, isActive]) - consultas de login e role-based.
- Project: @@index([status, createdAt]), @@index([clientId]), @@index([clientId, status]), @@index([clientId, status, createdAt]) - queries de quadro e execução.
- Stage/Task: @@index([projectId, status]), @@index([projectId, status, dueDate]), @@index([dependencyId]), @@index([designer]) - queries do kanban e do cronograma.
- Installment/FinancialRecord: @@index([projectId, status, dueDate]) - queries de parcelas e calendário financeiro.
- AuditLog: @@index([userId, createdAt]), @@index([userEmail, createdAt]), @@index([actorLabel, createdAt]), @@index([action, createdAt]), @@index([entityVersion]) - auditoria e investigação.
- UserAccessLog: @@index([userEmail, createdAt]), @@index([userRole, createdAt]) - logs de acesso por usuário.
### 2. Eliminação de Queries N+1 e Otimização
- project-service.ts: select específico em client, stages, payments e briefing.
- installment-service.ts: select específico e counting otimizado.
- dashboard-service.ts: agregações nativas (count, aggregate, groupBy) em vez de loops com await prisma.*.
### 3. Pool de Conexões (src/server/db.ts)
- Pattern Singleton globalForPrisma: uma instância de PrismaClient por processo, essencial para Serverless (Vercel) para evitar esgotamento de conexões.
- URL Pooled com -pooler do Neon Postgres e connection_limit ajustado.
### 4. Locks (Otimista, Pessimista & Distribuído)
- Lock Otimista: campo version Int @default(1) nos modelos críticos (Project, ScheduleStage, ProjectInstallment, Proposal). Validação via where: { id, version: expectedVersion } e incremento via version: { increment: 1 }. Retorna erro 409 Conflict se duas sessões editarem o mesmo registro simultaneamente.
- Lock Pessimista/Prevenção de Race Conditions: operações financeiras envolvem prisma.$transaction com ordenação determinística de IDs (evita deadlocks cruzados). Bloqueio explícito via SELECT ... FOR UPDATE parametrizado via $queryRaw quando aplicável.
- Lock Distribuído: src/lib/distributed-lock.ts usa pg_try_advisory_xact_lock via $queryRaw, com retry exponencial (backoff). Chaves de lock: payment-paid:<id>, installment-update:<id>. Lock é liberado automaticamente no final da transação, garantindo consistência entre containers que compartilham o pool do Neon.
### 5. Estratégia de Escala de Dados (Neon Postgres)
- Replicação Nativa: Neon Postgres são 3 réplicas (1 writer, 2 readers). A camada de aplicação lê do pool pooler que distribui leituras para readers.
- Particionamento Temporal Futuro: AuditLog e UserAccessLog devem ser particionados por ano/mês para evitar crescimento indefinido. (Preparação para reestrutura futura).
- Sharding por Tenant: estratégia para escala SaaS multi-escritório baseada em studioId (ou clientId). Utilização de migrações de data-partitioning para isolar dados por tenant.
- Teorema CAP: Dados Financeiros/RBAC posicionados em CP (Consistência + Tolerância a Partição): transações ACID, locks distribuídos, advisory locks do PostgreSQL. Métricas Analíticas e Notificações em AP (Disponibilidade + Particionabilidade): stores de tempo real, push notifications, métricas agregadas eventualmente consistentes.

## Bloco C: Controle de Concorrência e Prevenção de Vazamento de Memória
### 1. Controle de Concorrência
- PrismaClient singleton com globalForPrisma pattern para evitar esgotamento de conexões em Serverless.
- Locks otimistas (version) e distribuídos (advisory locks) para operações críticas: fechamento financeiro, geração de cronograma de recebíveis, aprovação de proposta.
- $transaction com ordenação determinística de IDs para evitar deadlocks cruzados em queries de múltiplas tabelas.
### 2. Prevenção de Vazamento de Memória
- Rate limiter usa Map com sweep a cada 60s para remover buckets expirados (evita crescimento indefinido de memória).
- createSecurityNonce usa crypto.getRandomValues (API nativa, sem alocações externas).
- parseDeviceReadable no traffic-log.ts não aloca estruturas complexas a partir do User-Agent.

## Conclusão
Este blueprint_documenta os mecanismos operados pela camada de infraestrutura/nuvem, enquanto a implementação em código (TypeScript, Next.js, Prisma, Middleware, API Routes e React Hooks) cobre a camada de aplicação. Juntos, estes componentes formam o ArqVértice Flow com as 81 pilares de engenharia de produção implementados de forma consistente e auditável.

*Documento gerado em 13/11/2026 como parte da operação de endurecimento e documentação das 81 pilares de engenharia de produção.*
