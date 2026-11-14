import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { handleDataSubjectRight, type DataSubjectRight } from "@/server/services/privacy-service";

export const metadata = {
  title: "Privacidade & Titularidade (LGPD) — Admin",
};

export const dynamic = "force-dynamic";

type ActionKey = DataSubjectRight | "list";

const RIGHTS: { key: ActionKey; label: string }[] = [
  { key: "access", label: "Acesso" },
  { key: "anonymization", label: "Anonimização" },
  { key: "obliteration", label: "Obiteração" },
  { key: "revocation", label: "Revogação" },
];

export default async function AdminPrivacyTitularidadePage() {
  const user = await requirePageAdminRole();

  const userList = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      whatsapp: true,
      consentAcceptedAt: true,
      privacyPolicyVersion: true,
      createdAt: true,
    },
  });

  return (
    <AppShell eyebrow="Privacidade & Titularidade" environment="admin">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Privacidade & Titularidade (LGPD)
          </h1>
          <p className="text-sm text-slate-500">
            Controle de direitos de titulares e gestão de anonimização de PII.
            Registros fiscais preservados por prazo legal.
          </p>
        </header>

        <Card className="border-slate-200">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">
                Gestão de direitos de titulares
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Selecione um titular para exercer os direitos (acesso, anonimização,
                obliteração, revogação). A anonimização substitui identificadores
                pessoais por pseudónimos, preservando registros obrigatórios.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Actions are performed per-user from the table below.
              }}
            >
              ♻️ Executar
            </Button>
          </div>
        </Card>

        {userList.map((u) => {
          const userRight: Record<string, any> = {};
          RIGHTS.forEach(({ key }) => {
            if (key === "anonymization" || key === "obliteration" || key === "revocation") return;
            (userRight as any)[key] = { ok: true, note: "Disponível via perfil do titular." };
          });
          return (
            <Card key={u.id} className="border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                  <div className="text-xs text-slate-400">
                    {u.role} · Cadastro {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge tone={u.role === "ADMIN" ? "neutral" : "blue"}>{u.role}</Badge>
                <Badge tone="neutral">
                  {u.consentAcceptedAt ? "Consentido" : "Sem consentimento"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/api/privacy/export?subjectId=${u.id}`}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Exportar JSON →
                </a>
                {RIGHTS.map(({ key }) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const res = await fetch("/api/privacy/action", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ subjectId: u.id, right: key }),
                      });
                      const data = await res.json();
                      alert(key === "anonymization" ? "Anonimização solicitada." : "Ação encerrada.");
                    }}
                  >
                    {key === "obliteration" ? "Obiter" : key === "revocation" ? "Revogar" : key}
                  </Button>
                ))}
              </div>
            </Card>
          );
        })}

        <div className="text-xs text-slate-400">
          Legenda: dados fiscais permanecem por prazo legal (≥ 5 anos para
          obrigações tributárias). Anonimização substitui identificadores
          pessoais, mantendo a integridade dos registos.
        </div>
      </div>
    </AppShell>
  );
}
