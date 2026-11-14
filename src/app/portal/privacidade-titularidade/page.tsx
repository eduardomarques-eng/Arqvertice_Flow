import { prisma } from "@/server/db";
import { requirePageClientPortal } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { handleDataSubjectRight } from "@/server/services/privacy-service";

export const metadata = {
  title: "Privacidade & Titularidade (LGPD) — Portal",
};

export const dynamic = "force-dynamic";

export default async function PortalPrivacyTitularidadePage() {
  const user = await requirePageClientPortal();

  const results = {
    access: await handleDataSubjectRight("access", user),
    portability: await handleDataSubjectRight("portability", user),
    anonymization: await handleDataSubjectRight("anonymization", user),
    revocation: await handleDataSubjectRight("revocation", user),
  };

  return (
    <AppShell eyebrow="Privacidade & Titularidade" environment="client">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Privacidade & Titularidade (LGPD)
          </h1>
          <p className="text-sm text-slate-500">
            Exercício dos direitos do titular de dados. Registros fiscais permanecem
            gravados por prazo legal.
          </p>
        </header>

        {([
          ["access", "Acesso aos dados"],
          ["portability", "Portabilidade (JSON)"],
          ["anonymization", "Anonimização de PII"],
          ["revocation", "Revogação de consentimento"],
        ] as const).map(([id, label]) => {
          const r = results[id];
          const payload = (r as any)?.data as any;
          const isOk = r.ok ?? true;
          const note = r.note ?? payload?.nota ?? "Operação realizada com sucesso.";
          const data = payload?.subject;

          return (
            <Card key={id} className="border-slate-200">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">{label}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {note}
                    {data && (
                      <div className="mt-2 grid gap-1.5 text-xs text-slate-500">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Registros</span>
                          <span className="font-medium text-slate-700">
                            {new Date(data.recordCreatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Política</span>
                          <span className="font-medium text-slate-700">v{data.privacyPolicyVersion}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Consentimento</span>
                          <span className="font-medium text-slate-700">
                            {data.consent?.acceptedAt
                              ? new Date(data.consent.acceptedAt).toLocaleString("pt-BR")
                              : "—"}
                          </span>
                        </div>
                      </div>
                    )}
                  </p>
                </div>
                {id === "portability" && (
                  <a
                    href={`/api/privacy/export?subjectId=${encodeURIComponent(data?.id ?? user.id)}`}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Baixar JSON →
                  </a>
                )}
                {id === "anonymization" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDataSubjectRight("anonymization", user)}
                  >
                    Executar anonimização
                  </Button>
                )}
              </div>
            </Card>
          );
        })}

        <div className="text-xs text-slate-400">
          Controlador: ArqVértice Studio · CNPJ 66.773.164/0001-60
          <br />
          Parceiro estrutural: Emanoel Luan Almeida da Rocha · CNPJ 51.510.575/0001-95
        </div>
      </div>
    </AppShell>
  );
}
