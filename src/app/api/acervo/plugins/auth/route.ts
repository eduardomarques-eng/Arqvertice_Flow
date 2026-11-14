import { NextResponse } from "next/server";
import {
  authenticatePluginRequest,
  authenticatePluginCredentials,
  getAllowedProjectsAndDisciplines,
} from "@/lib/acervo/plugin-auth";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    let userId = "";
    let userName = "";
    let userRole = "";
    let tokenProjectId: string | null = null;
    let authMethod: "BEARER_TOKEN" | "CREDENTIALS" = "BEARER_TOKEN";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const res = await authenticatePluginRequest(request);
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: res.status });
      }
      userId = res.ctx.userId;
      userName = res.ctx.userName;
      userRole = res.ctx.userRole;
      tokenProjectId = res.ctx.tokenProjectId;
    } else {
      const body = await request.json().catch(() => ({}));
      const email = String(body.email || "");
      const password = String(body.password || "");
      if (!email || !password) {
        return NextResponse.json(
          { error: "Informe Bearer Token ou credenciais (email + password)." },
          { status: 401 }
        );
      }
      const cred = await authenticatePluginCredentials(email, password);
      if (!cred) {
        return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
      }
      authMethod = "CREDENTIALS";
      userId = cred.userId;
      userName = cred.userName;
      userRole = cred.userRole;
    }

    const projects = await getAllowedProjectsAndDisciplines(userId, userRole, tokenProjectId);

    return NextResponse.json({
      success: true,
      authMethod,
      user: {
        id: userId,
        name: userName,
        role: userRole,
      },
      projects,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro na autenticação do plugin." },
      { status: 500 }
    );
  }
}
