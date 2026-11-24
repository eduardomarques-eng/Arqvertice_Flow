import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";

export const metadata = { title: "EAP & Controle de Obra — ArqVértice Flow" };
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
          title="Central EAP, Orçamento Regional & Controle de Obra"
          description="Selecione um empreendimento para inicializar a EAP, minerar PDFs (TQS + Revit), compatibilizar conflitos e gerar o planejamento LOB."
        />
        <Link
          href="/admin/eap/catalogo"
          className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-900 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          ⚙️ Catálogo Regional & Templates
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((proj) => {
          const eap = proj.eapProject;
          return (
            <Card
              key={proj.id}
              className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">{proj.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {proj.client?.name || "Cliente"}
                    </p>
                  </div>
                  <Badge tone={eap ? (eap.status === "EM_CONFERENCIA" ? "blue" : "green") : "neutral"}>
                    {eap ? eap.status : "Sem EAP"}
                  </Badge>
                </div>

                {eap ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">Praça Base</span>
                      <p className="font-semibold text-slate-900 dark:text-zinc-100">
                        {eap.city.name}/{eap.city.state}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">Área / BDI</span>
                      <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                        {eap.builtAreaM2} m² · {eap.bdiPercent}%
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">Fontes PDF</span>
                      <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                        {eap._count.sourceFiles} arquivo(s)
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">Conflitos TQS×Revit</span>
                      <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                        {eap._count.conflictLogs} registro(s)
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                    EAP ainda não inicializada. Abra para configurar cidade base, área construída e importar PDFs do Acervo.
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <Link
                  href={`/admin/eap/${proj.id}`}
                  className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
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
