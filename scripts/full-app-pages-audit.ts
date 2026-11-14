import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3000";
const TARGET_PROJECT_ID = "8ed368d6-e601-4c67-98f3-db6bed920e0a";

interface AuditRow {
  role: string;
  route: string;
  status: number;
  expected: string;
  location: string | null;
  passed: boolean;
  notes: string;
}

const ERROR_MARKERS = [
  "Painel temporariamente indisponível",
  "Application error",
  "Application error: a server-side exception",
  "Atualização de Permissões e Governança",
];

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login falhou para ${email}: HTTP ${res.status}`);
  }
  const cookiesList = res.headers.getSetCookie();
  return cookiesList.map((c) => c.split(";")[0]).join("; ");
}

async function probeRoute(
  role: string,
  route: string,
  cookie: string | null,
  expectedStatuses: number[],
  forbiddenSidebarPrefix?: string
): Promise<AuditRow> {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;

  const res = await fetch(`${BASE_URL}${route}`, {
    headers,
    redirect: "manual",
  });

  const location = res.headers.get("location");
  const isRedirect = res.status >= 300 && res.status < 400;
  let body = "";
  if (!isRedirect) {
    body = await res.text();
  }

  const foundErrors = ERROR_MARKERS.filter((m) => body.includes(m));
  let sidebarLeak = false;
  if (forbiddenSidebarPrefix && res.status === 200) {
    // Verifica se o menu lateral (nav) contém links hardcoded do outro ambiente
    const navMatch = body.match(/<nav[\s\S]*?<\/nav>/);
    if (navMatch && navMatch[0].includes(`href="${forbiddenSidebarPrefix}`)) {
      sidebarLeak = true;
    }
  }

  const statusOk = expectedStatuses.includes(res.status);
  const passed = statusOk && foundErrors.length === 0 && !sidebarLeak;
  const notes: string[] = [];
  if (!statusOk) notes.push(`Status inesperado: ${res.status}`);
  if (foundErrors.length > 0) notes.push(`Erros no HTML: ${foundErrors.join(", ")}`);
  if (sidebarLeak) notes.push(`Sidebar contém link ${forbiddenSidebarPrefix}`);
  if (location) notes.push(`Redirect -> ${location}`);
  if (notes.length === 0) notes.push("OK");

  return {
    role,
    route,
    status: res.status,
    expected: expectedStatuses.join("/"),
    location,
    passed,
    notes: notes.join(" | "),
  };
}

async function main() {
  const results: AuditRow[] = [];

  // 1. Rotas Públicas
  const publicRoutes = [
    "/",
    "/login",
    "/privacidade",
    "/cookies",
    "/termos",
    "/cadastro",
    "/recuperar-senha",
    "/redefinir-senha",
  ];
  for (const r of publicRoutes) {
    results.push(await probeRoute("PUBLIC", r, null, [200]));
  }

  // 2. Autenticação Admin e Equipe
  const adminCookie = await login("eduardo.marques.arq@gmail.com", "Edu@152013");
  const wagnerCookie = await login("wagner.silva@arqvertice.com.br", "WS@123456");

  // 3. Rotas Admin
  const adminRoutes = [
    "/admin",
    "/admin/cronograma",
    "/admin/projetos",
    `/admin/projetos/${TARGET_PROJECT_ID}`,
    `/admin/projetos/${TARGET_PROJECT_ID}/cronograma`,
    `/admin/projetos/${TARGET_PROJECT_ID}/relatorio`,
    "/admin/financeiro",
    "/admin/clientes",
    "/admin/equipe",
    "/admin/briefing",
    "/admin/propostas",
    "/admin/mensagens",
    "/admin/servicos",
    "/admin/configuracoes",
    "/admin/privacidade-titularidade",
    "/api/admin/settings",
  ];
  for (const r of adminRoutes) {
    results.push(await probeRoute("ADMIN", r, adminCookie, [200], "/equipe/"));
  }

  // 4. Rotas Equipe (Wagner Silva com todas as permissões)
  const equipeRoutes = [
    "/equipe",
    "/equipe/cronograma",
    `/equipe/cronograma/${TARGET_PROJECT_ID}`,
    "/equipe/projetos",
    `/equipe/projetos/${TARGET_PROJECT_ID}`,
    `/equipe/projetos/${TARGET_PROJECT_ID}/cronograma`,
    `/equipe/projetos/${TARGET_PROJECT_ID}/relatorio`,
    "/equipe/financeiro",
    "/equipe/clientes",
    "/equipe/equipe",
    "/equipe/briefing",
    "/equipe/propostas",
    "/equipe/mensagens",
    "/equipe/servicos",
    "/equipe/configuracoes",
  ];
  for (const r of equipeRoutes) {
    results.push(await probeRoute("ENGENHEIRO", r, wagnerCookie, [200], "/admin/"));
  }

  // 5. Isolamento RBAC e Proteção de Borda
  results.push(await probeRoute("ENGENHEIRO (RBAC)", "/admin", wagnerCookie, [307]));
  results.push(await probeRoute("ENGENHEIRO (RBAC)", "/admin/configuracoes", wagnerCookie, [307]));
  results.push(await probeRoute("ENGENHEIRO (RBAC)", "/api/admin/settings", wagnerCookie, [403]));
  results.push(await probeRoute("ANON (RBAC)", "/portal", null, [307]));
  results.push(await probeRoute("ANON (RBAC)", "/portal/projetos", null, [307]));
  results.push(await probeRoute("ANON (RBAC)", "/portal/relatorio", null, [307]));
  results.push(await probeRoute("ANON (RBAC)", "/portal/privacidade-titularidade", null, [307]));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  const lines: string[] = [
    "# Relatório de Auditoria Completa de Páginas — ArqVértice Flow",
    "",
    `- **Data/Hora:** ${new Date().toISOString()}`,
    `- **Base URL:** \`${BASE_URL}\``,
    `- **Total de Rotas Verificadas:** ${results.length}`,
    `- **Aprovadas:** ${passedCount}`,
    `- **Falhas:** ${failedCount}`,
    "",
    "| Perfil | Rota | HTTP Status | Esperado | Resultado | Observações |",
    "| :--- | :--- | :---: | :---: | :---: | :--- |",
  ];

  for (const r of results) {
    lines.push(
      `| ${r.role} | \`${r.route}\` | **${r.status}** | ${r.expected} | ${r.passed ? "PASS" : "FAIL"} | ${r.notes} |`
    );
  }

  const outPath = path.join(process.cwd(), "docs", "FULL_PAGES_AUDIT_REPORT.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(`Auditoria concluída: ${passedCount}/${results.length} aprovadas.`);
  if (failedCount > 0) {
    console.error("Rotas com falha:", results.filter((r) => !r.passed));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
