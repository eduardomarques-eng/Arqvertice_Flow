import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { exportCadastral } from "@/server/services/privacy-service";

export const dynamic = "force-dynamic";

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  if (!subjectId) {
    return NextResponse.json(
      { error: "subjectId é obrigatório." },
      { status: 400 },
    );
  }

  // Serviço de exportação só expõe o próprio titular ou um ADMIN.
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (user.role !== "ADMIN" && user.id !== subjectId) {
    return NextResponse.json(
      { error: "Acesso negado." },
      { status: 403 },
    );
  }

  try {
    const data = await exportCadastral(subjectId, user.role);
    const json = JSON.stringify(data, null, 2);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=privacidade-portabilidade-" +
          new Date().toISOString().slice(0, 10) +
          ".json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Falha ao exportar." },
      { status: 500 },
    );
  }
}
