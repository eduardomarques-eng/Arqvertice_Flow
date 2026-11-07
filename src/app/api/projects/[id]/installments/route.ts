import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { createProjectInstallment, listProjectInstallments } from "@/server/services/installment-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireRole("ADMIN");
    return NextResponse.json(await listProjectInstallments(id));
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível carregar as parcelas." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    return NextResponse.json(await createProjectInstallment({ ...body, projectId: id }), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Dados da parcela inválidos." }, { status: 422 });
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível criar a parcela." }, { status: 500 });
  }
}
