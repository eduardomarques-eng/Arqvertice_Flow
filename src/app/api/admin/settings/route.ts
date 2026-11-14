import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { DomainError } from "@/server/errors";
import {
  changeAdminPassword,
  forceGlobalLgpdReaccept,
  getInfrastructureHealth,
  getStudioSettings,
  revokeOtherSessions,
  updateAdminProfile,
  updateStudioSettings,
} from "@/server/services/settings-service";

export const dynamic = "force-dynamic";

async function requireAdminApi() {
  const user = await currentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Acesso restrito ao Administrador." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  try {
    const [settings, health] = await Promise.all([
      getStudioSettings(),
      getInfrastructureHealth(),
    ]);
    return NextResponse.json({
      settings,
      health,
      adminProfile: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        phone: auth.user.phone ?? "",
        whatsapp: auth.user.whatsapp ?? "",
        professionalReg: auth.user.professionalReg ?? "",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao carregar configurações.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleSave(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "update_settings";

    if (action === "update_profile") {
      const profile = await updateAdminProfile(auth.user.id, {
        name: typeof body.name === "string" ? body.name : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : undefined,
        professionalReg: typeof body.professionalReg === "string" ? body.professionalReg : undefined,
      });
      return NextResponse.json({ ok: true, profile, message: "Perfil do Administrador atualizado." });
    }

    if (action === "change_password") {
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");
      const confirmPassword = String(body.confirmPassword ?? "");
      if (newPassword !== confirmPassword) {
        return NextResponse.json({ error: "A nova senha e a confirmação não coincidem." }, { status: 400 });
      }
      await changeAdminPassword(auth.user.id, currentPassword, newPassword);
      return NextResponse.json({ ok: true, message: "Senha alterada com segurança. Sua sessão atual foi preservada." });
    }

    if (action === "revoke_other_sessions") {
      await revokeOtherSessions(auth.user.id);
      return NextResponse.json({ ok: true, message: "Todas as outras sessões ativas foram encerradas." });
    }

    if (action === "force_lgpd_reaccept") {
      const res = await forceGlobalLgpdReaccept(auth.user.id);
      return NextResponse.json({
        ok: true,
        forceLgpdReacceptAt: res.forceLgpdReacceptAt,
        message: "Novo aceite LGPD solicitado para a próxima entrada dos usuários.",
      });
    }

    const settings = await updateStudioSettings(auth.user.id, body as Parameters<typeof updateStudioSettings>[1]);
    return NextResponse.json({ ok: true, settings, message: "Parâmetros salvos no Neon Postgres." });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : "Erro ao salvar configurações.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return handleSave(request);
}

export async function PATCH(request: Request) {
  return handleSave(request);
}
