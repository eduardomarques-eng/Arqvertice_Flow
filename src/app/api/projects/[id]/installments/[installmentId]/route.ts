import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { deleteProjectInstallment, updateProjectInstallment } from "@/server/services/installment-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; installmentId: string }> }) {
  const { id, installmentId } = await params;
  try {
    await requireRole("ADMIN");
    return NextResponse.json(await updateProjectInstallment(id, installmentId, await request.json()));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Dados da parcela inválidos." }, { status: 422 });
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível atualizar a parcela." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; installmentId: string }> }) {
  const { id, installmentId } = await params;
  try {
    await requireRole("ADMIN");
    await deleteProjectInstallment(id, installmentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível excluir a parcela." }, { status: 500 });
  }
}
