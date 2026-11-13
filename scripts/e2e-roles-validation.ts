import { createHash } from "crypto";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const RESULTS: Array<{ test: string; status: "PASS" | "FAIL"; detail: string }> = [];

async function req(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: { "Cache-Control": "no-store", ...opts.headers },
    ...opts,
  });
}

function assert(
  name: string,
  condition: boolean,
  detail = ""
): void {
  RESULTS.push({ test: name, status: condition ? "PASS" : "FAIL", detail });
  console.log(
    `${condition ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`
  );
}

async function login(email: string, password: string) {
  const res = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const body = (await res.json().catch(() => ({}))) as any;
  return { res, setCookie, body };
}

async function main() {
  console.log("============================================================");
  console.log("ARQVÉRTICE FLOW — SUÍTE E2E DE VALIDAÇÃO DE ROLES");
  console.log("============================================================\n");

  const USERS = [
    { name: "Eduardo Marques", email: "eduardo.marques@arqvertice.com.br", password: "ArqVertice@2026", role: "ADMIN", route: "/admin", expectedDashboard: "Painel" },
    { name: "Wagner Silva", email: "wagner.silva@arqvertice.com.br", password: "ArqVertice@2026", role: "ENGENHEIRO", route: "/equipe", expectedDashboard: "Equipe técnica" },
    { name: "Luan Almeida", email: "luan.almeida@arqvertice.com.br", password: "ArqVertice@2026", role: "ENGENHEIRO", route: "/equipe", expectedDashboard: "Equipe técnica" },
    { name: "Erick Santiago", email: "erick.santiago@arqvertice.com.br", password: "ArqVertice@2026", role: "ARQUITETO", route: "/equipe", expectedDashboard: "Equipe técnica" },
    { name: "Claudio Marrocos", email: "claudio.marrocos@arqvertice.com.br", password: "ArqVertice@2026", role: "ARQUITETO", route: "/equipe", expectedDashboard: "Equipe técnica" },
  ];

  for (const user of USERS) {
    console.log(`\n👤 ${user.name} (${user.role}) → ${user.route}`);

    const { res: loginRes, setCookie } = await login(user.email, user.password);
    assert(`Login: ${user.name}`, loginRes.ok, `status=${loginRes.status}`);

    const res = await req(user.route, { headers: { Cookie: setCookie } });
    assert(`HTTP ${user.route} → 200`, res.status === 200, `status=${res.status}`);

    const html = await res.text();
    assert(`Sem "Painel temporariamente indisponível"`, !html.includes("Painel temporariamente indisponível"), "card amarelo não encontrado");
    assert(`Sem Error Boundary`, !html.includes("Error Boundary"), "Error Boundary não encontrado");
    assert(`Nome do usuário presente: ${user.name}`, html.includes(user.name), "nome não encontrado no HTML");
    assert(`Menu compatível com ${user.role}`, html.includes(user.route), `rota ${user.route} presente no HTML`);

    // Verificar que o usuário não acessa rota errada
    if (user.role === "ADMIN") {
      const resEquipe = await req("/equipe", { headers: { Cookie: setCookie } });
      assert(`ADMIN não acessa /equipe`, resEquipe.status === 302 || resEquipe.status === 307 || resEquipe.status === 403, `status=${resEquipe.status}`);
    } else {
      const resAdmin = await req("/admin", { headers: { Cookie: setCookie } });
      assert(`${user.role} não acessa /admin`, resAdmin.status === 302 || resAdmin.status === 307 || resAdmin.status === 403, `status=${resAdmin.status}`);
    }
  }

  console.log("\n============================================================");
  const passed = RESULTS.filter((r) => r.status === "PASS").length;
  const failed = RESULTS.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL: ${RESULTS.length} | PASS: ${passed} | FAIL: ${failed}`);
  console.log("============================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Erro crítico na validação E2E:", err);
  process.exit(1);
});