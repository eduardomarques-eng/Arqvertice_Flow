import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SessionGuard } from "@/components/auth/session-guard";
import { requirePageTeamRole } from "@/server/auth";

export default async function EquipeLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Blindagem de layout: apenas Equipe Técnica (ou ADMIN como dono) acessa /equipe/*.
  // Qualquer outro papel (CLIENTE, sem sessão) é redirecionado fora de /equipe.
  await requirePageTeamRole();

  return (
    <>
      <SessionGuard />
      {children}
    </>
  );
}
