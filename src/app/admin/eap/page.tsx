import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";

export const metadata = { title: "EAP & Controle de Obra" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEapIndexPage() {
  const admin = await requirePageAdminRole();

  const projects = await prisma.project
    .findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        client: { select: { name: true } },
        eapProject: {
          select: {
            id: true,
            status: true,
            builtAreaM2: true,
            bdiPercent: true,
            city: { select: { name: true, state: true } },
            _count: { select: { sourceFiles: true, conflictLogs: true } },
          },
        },
      },
    })
    .catch(() => []);

  return (
    <AppShell eyebrow="EAP & Planejamento" role={admin.role}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          title="Central EAP & Controle de Obra"
          description="Orçamento regional, mineração de quantitativos e planejamento LOB."
        />
        <Link
          href="/admin/eap/catalogo"
          className="apple-glass-btn text-xs"
        >
          Catálogo Regional & Templates
        </Link>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((proj) => {
          const eap = proj.eapProject;
          return (
            <Card
              key={proj.id}
              className="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="apple-card-title font-semibold">{proj.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {proj.client?.name || "Cliente"}
                    </p>
                  </div>
                  <Badge tone={eap ? (eap.status === "EM_CONFERENCIA" ? "blue" : "green") : "neutral"}>
                    {eap ? eap.status : "Sem EAP"}
                  </Badge>
                </div>

                {eap ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border apple-hairline bg-zinc-50/70 p-3 text-xs dark:bg-zinc-900/60">
                    <div>
                      <span className="apple-micro-label text-[10px]">Praça Base</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {eap.city.name}/{eap.city.state}
                      </p>
                    </div>
                    <div>
                      <span className="apple-micro-label text-[10px]">Área / BDI</span>
                      <p className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {eap.builtAreaM2} m² · {eap.bdiPercent}%
                      </p>
                    </div>
                    <div>
                      <span className="apple-micro-label text-[10px]">Fontes PDF</span>
                      <p className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {eap._count.sourceFiles} arquivo(s)
                      </p>
                    </div>
                    <div>
                      <span className="apple-micro-label text-[10px]">Conflitos TQS×Revit</span>
                      <p className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {eap._count.conflictLogs} registro(s)
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed apple-hairline p-3 text-xs text-zinc-500 dark:text-zinc-400">
                    EAP ainda não inicializada. Abra para configurar cidade base e importar PDFs.
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t apple-hairline">
                <Link
                  href={`/admin/eap/${proj.id}`}
                  className="apple-primary-btn w-full h-9 text-xs"
                >
                  {eap ? "Abrir Hub EAP →" : "Inicializar EAP →"}
                </Link>
              </div>
            </Card>
          );
        })}

        {projects.length === 0 && (
          <Card className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
            Nenhum empreendimento encontrado. Cadastre um projeto em /admin/projetos ou verifique a conexão do banco.
          </Card>
        )}
      </div>
    </AppShell>
  );
}
