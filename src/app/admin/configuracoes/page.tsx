import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { requirePageRole } from "@/server/auth";

export const metadata = { title: "Configurações & Cadastros Mestres" };
export const dynamic = "force-dynamic";

const STANDARD_PROJECT_TYPES = [
  { name: "Residencial Unifamiliar", code: "RES-UNI", desc: "Casas de alto padrão, sobrados e residências litorâneas" },
  { name: "Residencial Multifamiliar", code: "RES-MULTI", desc: "Edifícios residenciais, vilas e condomínios fechados" },
  { name: "Comercial & Varejo", code: "COM-RET", desc: "Lojas, restaurantes, quiosques e pontos comerciais" },
  { name: "Interiores & Retrofit", code: "INT-RET", desc: "Design de interiores, iluminação e reformas completas" },
  { name: "Corporativo", code: "CORP", desc: "Escritórios, sedes empresariais e consultórios" },
];

const STANDARD_DISCIPLINES = [
  { name: "Arquitetura", lead: "Arq. Eduardo Marques", tool: "Desenho Técnico e Plantas Executivas", color: "indigo" },
  { name: "Engenharia Estrutural", lead: "Eng. Emanoel Luan", tool: "Cálculo Estrutural e Concreto Armado", color: "amber" },
  { name: "Hidrossanitário", lead: "Equipe Técnica", tool: "Modelagem e Instalações Prediais", color: "sky" },
  { name: "Elétrico & Iluminação", lead: "Equipe Técnica", tool: "Modelagem e Instalações Prediais", color: "yellow" },
  { name: "Combate a Incêndio", lead: "Equipe Técnica", tool: "Modelagem e Instalações Prediais", color: "rose" },
  { name: "Modelagem 3D e Imagens Finais", lead: "Visualização 3D", tool: "Renderização e Iluminação Fotorrealista", color: "fuchsia" },
  { name: "Aprovação Legal / ART", lead: "Eng. Emanoel Luan", tool: "CREA / CAU / Prefeituras", color: "slate" },
];

const STANDARD_PHASES = [
  {
    order: "Fase 01",
    name: "Projeto Preliminar",
    code: "PROJETO_PRELIMINAR",
    desc: "Estudo de viabilidade, volumetria 3D, zoneamento e plantas conceituais de layout.",
  },
  {
    order: "Fase 02",
    name: "Projeto Legal",
    code: "PROJETO_LEGAL",
    desc: "Plantas de situação, memoriais normativos, alinhamentos e aprovações em órgãos municipais.",
  },
  {
    order: "Fase 03",
    name: "Projeto Executivo",
    code: "PROJETO_EXECUTIVO",
    desc: "Detalhamentos construtivos, fôrmas, armações, compatibilização BIM e memoriais de obra.",
  },
];

const RBAC_PROFILES = [
  { role: "ADMIN", label: "Administrador Geral", access: "Acesso total: financeiro, parametrização, contratos, auditoria e usuários." },
  { role: "ARQUITETO", label: "Arquiteto", access: "Gestão do acervo de arquitetura, aprovação de briefings, cronograma e relatórios." },
  { role: "ENGENHEIRO", label: "Engenheiro", access: "Gestão de memoriais de cálculo, pranchas estruturais, projetos complementares e checklist de integridade." },
  { role: "EQUIPE", label: "Equipe Operacional", access: "Acompanhamento do cronograma, atualização de avanço de etapas atribuídas." },
  { role: "CLIENTE", label: "Cliente", access: "Portal exclusivo do cliente, visualização de pranchas liberadas e relatório executivo." },
];

const AREAS = [
  { href: "/admin/gestao", label: "Painel de Gestão & Cadastros Mestres", description: "Área executiva de gerenciamento de permissões, papéis (RBAC) e SSOT normativo." },
  { href: "/admin/equipe", label: "Controle de Acesso (RBAC)", description: "Atribuição de papéis e privilégios para membros do estúdio e clientes." },
  { href: "/admin/servicos", label: "Serviços e Preços", description: "Catálogo de serviços, pacotes comerciais e histórico de precificação." },
  { href: "/admin/mensagens", label: "Templates de Mensagens", description: "Modelos pré-configurados para notificações de WhatsApp e e-mail." },
  { href: "/admin/briefing", label: "Central de Briefings", description: "Links protegidos de briefing e acompanhamento de respostas." },
] as const;

export default async function ConfiguracoesPage() {
  await requirePageRole("ADMIN");

  return (
    <AppShell eyebrow="Estúdio">
      <SectionHeading
        title="Configurações & Cadastros Mestres"
        description="Central de parametrização global do escritório: tipologias de projetos, matriz de disciplinas normativas, fases executivas e controle de acesso RBAC."
      />

      {/* Atalhos Rápidos de Gestão */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.map((area) => (
          <Card key={area.href} className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-400 transition">
            <Link href={area.href} className="font-bold text-slate-900 hover:text-blue-600 transition flex items-center justify-between">
              <span>{area.label}</span>
              <span className="text-slate-400 text-xs">→</span>
            </Link>
            <p className="mt-2 text-xs leading-5 text-slate-500">{area.description}</p>
          </Card>
        ))}
      </div>

      {/* Cadastros Mestres 1: Tipologias de Projetos */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">1. Tipologias Padrão de Projetos</h3>
            <p className="text-xs text-slate-500">Categorias padronizadas para parametrização dos novos empreendimentos</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-600">
            {STANDARD_PROJECT_TYPES.length} Tipologias
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STANDARD_PROJECT_TYPES.map((t) => (
            <Card key={t.code} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-slate-400">{t.code}</span>
                <Badge tone="blue">Ativo</Badge>
              </div>
              <h4 className="mt-2 text-sm font-bold text-slate-900">{t.name}</h4>
              <p className="mt-1 text-xs text-slate-500">{t.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Cadastros Mestres 2: Matriz de Disciplinas Normativas */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">2. Matriz de Disciplinas & Softwares</h3>
            <p className="text-xs text-slate-500">Disciplinas técnicas homologadas para o Acervo de Pranchas e Cronograma Físico</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-600">
            {STANDARD_DISCIPLINES.length} Disciplinas
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STANDARD_DISCIPLINES.map((d) => (
            <Card key={d.name} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{d.name}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">{d.tool}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 font-medium">Responsável: {d.lead}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Cadastros Mestres 3: Fases Normativas Oficiais */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">3. Fases Normativas Oficiais do Acervo</h3>
            <p className="text-xs text-slate-500">Estrutura de subpastas normativas padronizadas em todos os projetos</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-600">
            3 Fases Oficiais
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STANDARD_PHASES.map((p) => (
            <Card key={p.code} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-blue-600">{p.order}</span>
                <span className="font-mono text-[10px] text-slate-400">{p.code}</span>
              </div>
              <h4 className="mt-2 text-sm font-bold text-slate-900">{p.name}</h4>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{p.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Cadastros Mestres 4: Matriz de Privilégios (RBAC) */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">4. Matriz de Perfis e Acesso (RBAC)</h3>
            <p className="text-xs text-slate-500">Definições de privilégios e papéis no sistema</p>
          </div>
          <Link
            href="/admin/equipe"
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            Gerenciar Usuários →
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4 font-mono">Papel (Role)</th>
                <th className="py-2.5 px-3">Identificação</th>
                <th className="py-2.5 px-4">Escopo de Privilégios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RBAC_PROFILES.map((p) => (
                <tr key={p.role} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    <span className="rounded bg-slate-100 px-2 py-0.5">{p.role}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">{p.label}</td>
                  <td className="py-3 px-4 text-slate-600">{p.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
