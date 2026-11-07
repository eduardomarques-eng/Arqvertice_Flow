import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { updateClient } from "@/server/services/client-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireRole("ADMIN");
    return NextResponse.json(await updateClient(id, await request.json()));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Dados cadastrais inválidos." }, { status: 422 });
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    return NextResponse.json({ error: "Não foi possível atualizar o cliente." }, { status: 500 });
  }
}
