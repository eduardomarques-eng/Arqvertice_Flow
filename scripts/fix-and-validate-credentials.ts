import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "../src/lib/password";

for (const fileName of [".env.local", ".env"]) {
  const envPath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) continue;
  for (const rawLine of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key] && val) process.env[key] = val;
  }
}

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

const TEAM_CREDENTIALS = [
  { name: "Eduardo Marques", email: "eduardo.marques.arq@gmail.com", password: "Edu@152013", role: "ADMIN" },
  { name: "Luan Almeida", email: "luan.almeida@arqvertice.com.br", password: "LA@123456", role: "ENGENHEIRO" },
  { name: "Erick Santiago", email: "erick.santiago@arqvertice.com.br", password: "ES@123456", role: "ARQUITETO" },
  { name: "Claudio Marrocos", email: "claudiomarrocos2018@gmail.com", password: "CM@123456", role: "ARQUITETO" },
  { name: "Wagner Silva", email: "wagner.silva@arqvertice.com.br", password: "WS@123456", role: "ENGENHEIRO" },
];

async function main() {
  const testStartedAt = new Date();
  const report: Array<Record<string, string>> = [];
  let hasFailure = false;

  for (const cred of TEAM_CREDENTIALS) {
    let dbCheck = "❌";
    let loginCheck = "❌";
    let adminCheck = "❌";
    let detail = "";

    try {
      const user = await (prisma.user as any).findUnique({
        where: { email: cred.email.toLowerCase() },
      });
      if (!user) throw new Error("Usuário ausente");
      const hashField = user.passwordHash ? "passwordHash" : "password";
      const validHash = await Promise.resolve(verifyPassword(cred.password, user[hashField]));
      if (!validHash) throw new Error("Hash inválido");
      dbCheck = "✅ OK";

      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cred.email, password: cred.password }),
        redirect: "manual",
      });

      const setCookies =
        typeof loginRes.headers.getSetCookie === "function"
          ? loginRes.headers.getSetCookie()
          : [loginRes.headers.get("set-cookie")].filter((c): c is string => Boolean(c));
      const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");

      if (loginRes.status !== 200 || !cookieHeader) {
        throw new Error(`HTTP ${loginRes.status} no login`);
      }
      loginCheck = "✅ OK";

      const adminRes = await fetch(`${BASE_URL}/admin`, {
        method: "GET",
        headers: { Cookie: cookieHeader },
        redirect: "manual",
      });

      if (adminRes.status !== 200) {
        const loc = adminRes.headers.get("location") || "";
        throw new Error(`/admin retornou HTTP ${adminRes.status} ${loc ? `-> ${loc}` : ""}`);
      }
      adminCheck = "✅ OK";
      detail = "Login e painel /admin liberados";
    } catch (err: any) {
      hasFailure = true;
      detail = err?.message || "Erro";
    }

    report.push({
      Profissional: cred.name,
      "E-mail": cred.email,
      Papel: cred.role,
      "Banco/Hash": dbCheck,
      "Login HTTP": loginCheck,
      "Acesso /admin": adminCheck,
      Resultado: adminCheck === "✅ OK" ? "✅ APROVADO" : "❌ FALHA",
      Diagnóstico: detail,
    });
  }

  try {
    if ((prisma as any).userAccessLog) {
      await (prisma as any).userAccessLog.deleteMany({
        where: {
          userEmail: { in: TEAM_CREDENTIALS.map((c) => c.email.toLowerCase()) },
          createdAt: { gte: testStartedAt },
        },
      });
    }
  } catch {}

  console.table(report);
  await prisma.$disconnect();
  if (hasFailure) process.exit(1);
}

main();
