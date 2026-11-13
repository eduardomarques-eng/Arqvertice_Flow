import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SessionGuard } from "@/components/auth/session-guard";
import { requirePageAdminRole } from "@/server/auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Blindagem de layout: apenas ADMIN acessa /admin/*.
  // Equipe e CLIENTE são redirecionados para seus respectivos ambientes.
  await requirePageAdminRole();

  return (
    <>
      <SessionGuard />
      {children}
    </>
  );
}

