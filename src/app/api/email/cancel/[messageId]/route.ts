import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { getAccessibleMailboxes } from "@/lib/email/email-infra";

export async function POST(
  _req: Request,
  context: { params: Promise<{ messageId: string }> }
) {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { messageId } = await context.params;
  const msg = await prisma.emailMessage.findUnique({
    where: { id: messageId },
    include: { thread: true },
  });

  if (!msg) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  const accessible = await getAccessibleMailboxes(user);
  if (!accessible.some((m) => m.id === msg.thread.mailboxId)) {
    return NextResponse.json({ error: "Sem permissão nesta caixa." }, { status: 403 });
  }

  if (msg.status === "SENT") {
    return NextResponse.json(
      { error: "O e-mail já foi despachado e não pode mais ser cancelado." },
      { status: 409 }
    );
  }

  const updated = await prisma.emailMessage.update({
    where: { id: msg.id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({
    ok: true,
    cancelled: true,
    messageId: updated.id,
    status: updated.status,
  });
}
