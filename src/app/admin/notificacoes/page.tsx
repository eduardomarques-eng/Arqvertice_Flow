import { redirect } from "next/navigation";
import { requirePageAdminRole } from "@/server/auth";

export default async function AdminNotificationsPage() {
  await requirePageAdminRole();
  redirect("/admin/equipe");
}
