import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function OperacaoRedirectPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/?next=/operacao");
  }

  if (user.role === "ADMIN") {
    redirect("/admin/cronograma");
  }

  redirect("/equipe/cronograma");
}
