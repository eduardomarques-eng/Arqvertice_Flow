import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { SearchForm } from "@/components/search-form";
import { ClientForm } from "@/components/clients/client-form";
import { requirePageRole } from "@/server/auth";
import { listClients } from "@/server/services/client-service";
import {
  BentoCollapsiblePanel,
  BentoDonutDistribution,
  BentoKpiStrip,
} from "@/components/analytics";

export const metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageRole("ADMIN");
  const { q = "" } = await searchParams;
  const clients = await listClients(q);
  const activeCount = clients.filter((c) => c.status === "ACTIVE").length;
  const inactiveCount = Math.max(0, clients.length - activeCount);

  return (
    <AppShell eyebrow="Relacionamento">
      <SectionHeading
        title="Clientes"
        description="Centralize contatos, projetos e histórico de relacionamento."
        action={<ClientForm />}
      />

      <div className="mb-6">
        <BentoCollapsiblePanel title="Inteligência de Carteira" badge={`${clients.length} clientes`}>
          <BentoKpiStrip
            columns={4}
            items={[
              { id: "act", label: "Clientes Ativos", value: String(activeCount), featured: true },
              { id: "rec", label: "Recorrência", value: clients.length ? `${Math.round((activeCount / clients.length) * 100)}%` : "0%" },
              { id: "ltv", label: "Carteira Total", value: `${clients.length} contas` },
              { id: "new", label: "Inativos / Arquivo", value: String(inactiveCount) },
            ]}
          />
          <BentoDonutDistribution
            title="Perfil de Status da Carteira"
            centerLabel="Contas"
            centerValue={String(clients.length)}
            slices={[
              { id: "active", label: "Ativos", value: activeCount, formattedValue: String(activeCount) },
              { id: "other", label: "Inativos / Leads", value: inactiveCount, formattedValue: String(inactiveCount) },
            ]}
          />
        </BentoCollapsiblePanel>
      </div>

      <SearchForm action="/admin/clientes" query={q} placeholder="Buscar por nome ou e-mail" />

      {clients.length === 0 ? (
        <EmptyState
          title={q ? `Nada encontrado para "${q}"` : "Nenhum cliente cadastrado"}
          description={
            q
              ? "Tente outra palavra, ou limpe a busca para ver todos os clientes."
              : "Os clientes criados aqui ou pelos serviços aparecem nesta lista."
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/clientes/${client.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                    {client.name}
                  </Link>
                  {client.email ? (
                    <p className="mt-1 break-all text-sm text-slate-500">{client.email}</p>
                  ) : null}
                </div>
                <Badge tone={client.status === "ACTIVE" ? "green" : "neutral"}>{client.status}</Badge>
              </div>
              <Link href={`/admin/clientes/${client.id}`} className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
                Abrir ficha →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
