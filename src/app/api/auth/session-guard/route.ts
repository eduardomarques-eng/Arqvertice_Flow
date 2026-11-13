import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        forcedLogout: true,
        reason: "Sua sessão foi encerrada pelo Administrador devido a alterações em seus privilégios ou credenciais.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
    },
  });
}

