import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { createHash } from "crypto";

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

    // 3. Atualiza heartbeat lastSeenAt de forma assíncrona
    prisma.user
      .update({
        where: { id: session.user.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => null);

    return NextResponse.json(
      {
        valid: true,
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

