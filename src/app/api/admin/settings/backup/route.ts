import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { exportStudioBackup } from "@/server/services/settings-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito ao Administrador." }, { status: 403 });
  }

  try {
    const backup = await exportStudioBackup(user.id);
    const dateStamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="arqvertice-backup-${dateStamp}.json"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Falha ao exportar backup.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
