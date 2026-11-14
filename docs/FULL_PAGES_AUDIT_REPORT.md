# Relatório de Auditoria Completa de Páginas — ArqVértice Flow

- **Data/Hora:** 2026-11-14T03:31:39.553Z
- **Base URL:** `http://127.0.0.1:3000`
- **Total de Rotas Verificadas:** 46
- **Aprovadas:** 46
- **Falhas:** 0

| Perfil | Rota | HTTP Status | Esperado | Resultado | Observações |
| :--- | :--- | :---: | :---: | :---: | :--- |
| PUBLIC | `/` | **200** | 200 | PASS | OK |
| PUBLIC | `/login` | **200** | 200 | PASS | OK |
| PUBLIC | `/privacidade` | **200** | 200 | PASS | OK |
| PUBLIC | `/cookies` | **200** | 200 | PASS | OK |
| PUBLIC | `/termos` | **200** | 200 | PASS | OK |
| PUBLIC | `/cadastro` | **200** | 200 | PASS | OK |
| PUBLIC | `/recuperar-senha` | **200** | 200 | PASS | OK |
| PUBLIC | `/redefinir-senha` | **200** | 200 | PASS | OK |
| ADMIN | `/admin` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/cronograma` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/projetos` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/projetos/8ed368d6-e601-4c67-98f3-db6bed920e0a` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/projetos/8ed368d6-e601-4c67-98f3-db6bed920e0a/cronograma` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/projetos/8ed368d6-e601-4c67-98f3-db6bed920e0a/relatorio` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/financeiro` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/clientes` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/equipe` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/briefing` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/propostas` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/mensagens` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/servicos` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/configuracoes` | **200** | 200 | PASS | OK |
| ADMIN | `/admin/privacidade-titularidade` | **200** | 200 | PASS | OK |
| ADMIN | `/api/admin/settings` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/cronograma` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/projetos` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/projetos/8ed368d6-e601-4c67-98f3-db6bed920e0a` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/projetos/8ed368d6-e601-4c67-98f3-db6bed920e0a/cronograma` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/projetos/8ed368d6-e601-4c67-98f3-db6bed920e0a/relatorio` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/financeiro` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/clientes` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/equipe` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/briefing` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/propostas` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/mensagens` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/servicos` | **200** | 200 | PASS | OK |
| ENGENHEIRO | `/equipe/configuracoes` | **200** | 200 | PASS | OK |
| ENGENHEIRO (RBAC) | `/admin` | **307** | 307 | PASS | Redirect -> /equipe |
| ENGENHEIRO (RBAC) | `/admin/configuracoes` | **307** | 307 | PASS | Redirect -> /equipe |
| ENGENHEIRO (RBAC) | `/api/admin/settings` | **403** | 403 | PASS | OK |
| ANON (RBAC) | `/portal` | **307** | 307 | PASS | Redirect -> /login?next=%2Fportal |
| ANON (RBAC) | `/portal/projetos` | **307** | 307 | PASS | Redirect -> /login?next=%2Fportal%2Fprojetos |
| ANON (RBAC) | `/portal/relatorio` | **307** | 307 | PASS | Redirect -> /login?next=%2Fportal%2Frelatorio |
| ANON (RBAC) | `/portal/privacidade-titularidade` | **307** | 307 | PASS | Redirect -> /login?next=%2Fportal%2Fprivacidade-titularidade |