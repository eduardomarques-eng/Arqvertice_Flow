import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { createHash } from "crypto";
import { getCurrentBuildId } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("arqvertice_session")?.value;

    if (!token) {
      return NextResponse.json(
        { valid: false, reason: "UNAUTHENTICATED" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const hashed = tokenHash(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashed },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            sessionVersion: true,
            role: true,
            permissions: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || !session.user) {
      return NextResponse.json(
        { valid: false, reason: "UNAUTHENTICATED" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // 1. Conta Desativada
    if (!session.user.isActive) {
      return NextResponse.json(
        { valid: false, reason: "ACCOUNT_DISABLED" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // 2. Versão de sessão desatualizada (Admin alterou permissões, cargo, senha ou status)
    if (session.sessionVersion !== session.user.sessionVersion) {
      return NextResponse.json(
        { valid: false, reason: "PERMISSIONS_UPDATED" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // 3. Novo build/deploy publicado -> invalida sessão antiga e limpa cookies
    const currentBuildId = getCurrentBuildId();
    if (session.buildId && session.buildId !== currentBuildId) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
      const res = NextResponse.json(
        { valid: false, reason: "BUILD_UPDATED" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
      for (const name of ["arqvertice_session", "arqvertice_role", "arqvertice_permissions", "arqvertice_build_id"]) {
        res.cookies.set(name, "", { maxAge: 0, path: "/" });
      }
      return res;
    }

    // 3. Atualiza heartbeat lastSeenAt de forma assíncrona
    prisma.user
      .update({
        where: { id: session.user.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => null);

    const setting = await prisma.studioSetting
      .findUnique({ where: { id: "default" }, select: { inactivityTimeoutMin: true } })
      .catch(() => null);

    return NextResponse.json(
      {
        valid: true,
        inactivityTimeoutMin: setting?.inactivityTimeoutMin ?? 30,
        user: {
          id: session.user.id,
          role: session.user.role,
          permissions: session.user.permissions,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return NextResponse.json(
      { valid: false, reason: "UNAUTHENTICATED" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

