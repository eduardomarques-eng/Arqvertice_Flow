import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { provisionClientAccess } from "@/server/services/client-service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireRole("ADMIN");
    return NextResponse.json(await provisionClientAccess(id));
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    return NextResponse.json({ error: "Não foi possível provisionar o acesso." }, { status: 500 });
  }
}
