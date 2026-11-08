import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/server/auth";
import { listAssignableProjects, listOperadores } from "@/server/services/operation-service";
import { OperatorAccessManager } from "@/components/team/operator-access-manager";

export const dynamic = "force-dynamic";

/**
 * Equipa — gestão dos funcionários (OPERADOR) e dos projetos que cada um pode
 * operar. Só o ADMIN entra aqui (`requirePageRole("ADMIN")`). A lista de
 * operadores e de projetos vem do banco; nenhum nome é inventado. A atribuição
 * em si é feita pelo cliente em `OperatorAccessManager`, que chama a server
 * action — a autorização volta a ser provada no serviço.
 */
export default async function EquipePage() {
  await requirePageRole("ADMIN");
  const [operadores, projects] = await Promise.all([listOperadores(), listAssignableProjects()]);

  return (
    <AppShell eyebrow="Equipa">
      <SectionHeading
        title="Painel de Controle de Acesso (RBAC) & Equipe"
        description="Gerenciamento enterprise de privilégios e papéis: ADMIN, ARQUITETO, ENGENHEIRO, EQUIPE e CLIENTE."
      />

      {operadores.length === 0 ? (
        <Card className="mt-6 border-dashed text-center">
          <p className="py-8 text-sm text-slate-500">
            Ainda não há usuários cadastrados.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {operadores.map((operador) => (
            <OperatorAccessManager
              key={operador.id}
              operatorId={operador.id}
              operatorName={operador.name}
              operatorEmail={operador.email}
              initialRole={operador.role}
              initialIsActive={operador.isActive ?? true}
              initialCanEdit={operador.projectAccess.some((a) => a.canEdit)}
              assignedProjectIds={operador.projectAccess.map((access) => access.projectId)}
              projects={projects.map((project) => ({
                id: project.id,
                name: project.name,
                clientName: project.client.name,
              }))}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
