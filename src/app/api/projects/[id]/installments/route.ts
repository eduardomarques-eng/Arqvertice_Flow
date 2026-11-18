import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    const created = await createProjectInstallment({ ...body, projectId: id });
    revalidatePath("/admin/financeiro");
    revalidatePath("/equipe/financeiro");
    revalidatePath(`/admin/projetos/${id}`);
    revalidatePath(`/portal/${id}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Dados da parcela inválidos." }, { status: 422 });
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível criar a parcela." }, { status: 500 });
  }
}
