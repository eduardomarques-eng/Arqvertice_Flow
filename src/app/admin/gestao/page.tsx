import { redirect } from "next/navigation";
import { requirePageAdminRole } from "@/server/auth";

export default async function GestaoPage() {
  await requirePageAdminRole();
  redirect("/admin/equipe");
}
