import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { SearchForm } from "@/components/search-form";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { listClients } from "@/server/services/client-service";

export const metadata = { title: "Base de Clientes — Equipe ArqVértice" };
export const dynamic = "force-dynamic";

export default async function EquipeClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("clientes");
  const { q = "" } = await searchParams;
  const clients = await listClients(q);

  return (
    <AppShell eyebrow="Relacionamento" role={user.role}>
      <SectionHeading
        title="Base de Clientes"
        description="Centralize contatos, projetos e histórico de relacionamento com os clientes."
      />

      <SearchForm action="/equipe/clientes" query={q} placeholder="Buscar por nome ou e-mail" />

      {clients.length === 0 ? (
        <EmptyState
          title={q ? `Nada encontrado para "${q}"` : "Nenhum cliente cadastrado"}
          description={
            q
              ? "Tente outra palavra, ou limpe a busca para ver todos os clientes."
              : "Os clientes cadastrados aparecem nesta lista."
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="border-slate-200 bg-white/95">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/equipe/clientes/${client.id}`}
                    className="font-bold text-slate-900 hover:text-blue-700 transition-colors"
                  >
                    {client.name}
                  </Link>
                  {client.email ? (
                    <p className="mt-1 break-all text-xs text-slate-500">{client.email}</p>
                  ) : null}
                </div>
                <Badge tone={client.status === "ACTIVE" ? "green" : "neutral"}>{client.status}</Badge>
              </div>
              <Link
                href={`/equipe/clientes/${client.id}`}
                className="mt-4 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Abrir ficha do cliente →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
