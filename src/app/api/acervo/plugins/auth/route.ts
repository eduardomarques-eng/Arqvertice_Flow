import { NextResponse } from "next/server";
import {
  authenticatePluginRequest,
  authenticatePluginCredentials,
  getAllowedProjectsAndDisciplines,
} from "@/lib/acervo/plugin-auth";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const headerPluginName = request.headers.get("x-plugin-name") || undefined;
    const headerSoftwareVersion = request.headers.get("x-software-version") || undefined;

    let userId = "";
    let userName = "";
    let userRole = "";
    let tokenProjectId: string | null = null;
    let authMethod: "BEARER_TOKEN" | "CREDENTIALS" = "BEARER_TOKEN";
    let bodyPluginName: string | undefined;
    let bodySoftwareVersion: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const res = await authenticatePluginRequest(request);
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: res.status });
      }
      userId = res.ctx.userId;
      userName = res.ctx.userName;
      userRole = res.ctx.userRole;
      tokenProjectId = res.ctx.tokenProjectId;
      bodyPluginName = res.ctx.pluginName;
      bodySoftwareVersion = res.ctx.softwareVersion;
    } else {
      const body = await request.json().catch(() => ({}));
      const email = String(body.email || "");
      const password = String(body.password || "");
      bodyPluginName = body.pluginName ? String(body.pluginName) : undefined;
      bodySoftwareVersion = body.softwareVersion ? String(body.softwareVersion) : undefined;

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

    const pluginName = bodyPluginName || headerPluginName || "Plugin Desconhecido";
    const softwareVersion = bodySoftwareVersion || headerSoftwareVersion || "2025/2026";

    const projects = await getAllowedProjectsAndDisciplines(userId, userRole, tokenProjectId);

    return NextResponse.json({
      success: true,
      authMethod,
      client: {
        pluginName,
        softwareVersion,
        timestamp: new Date().toISOString(),
      },
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
