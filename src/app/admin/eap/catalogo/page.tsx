import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { EapCatalogHub } from "@/components/eap/eap-catalog-hub";
import { prisma } from "@/server/db";
import { requirePageAdminRole } from "@/server/auth";
import {
  DEFAULT_PROPOSAL_EXCLUSIONS,
  DEFAULT_PROPOSAL_PREMISES,
  MASTER_EAP_STAGES,
  MASTER_LOB_PACKAGES,
} from "@/server/eap/templates/residential-master";

export const metadata = { title: "EAP — Catálogo Regional & Templates — ArqVértice Flow" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EapCatalogoPage() {
  const admin = await requirePageAdminRole();

  const citiesRaw = await prisma.cityCatalog
    .findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            holidays: true,
            materialPrices: true,
            laborPrices: true,
          },
        },
      },
    })
    .catch(() => []);

  const defaultCity = citiesRaw.find((c) => c.isDefault) ?? citiesRaw[0] ?? null;

  const [materialsRaw, laborRaw, holidaysRaw] = defaultCity
    ? await Promise.all([
        prisma.materialCatalogItem
          .findMany({
            where: { active: true },
            orderBy: [{ eapStageCode: "asc" }, { category: "asc" }, { name: "asc" }],
            include: { cityPrices: { where: { cityId: defaultCity.id }, take: 1 } },
          })
          .catch(() => []),
        prisma.laborRoleCatalog
          .findMany({
            where: { active: true },
            orderBy: { name: "asc" },
            include: { cityPrices: { where: { cityId: defaultCity.id }, take: 1 } },
          })
          .catch(() => []),
        prisma.cityHoliday
          .findMany({
            where: { cityId: defaultCity.id },
            orderBy: { date: "asc" },
          })
          .catch(() => []),
      ])
    : [[], [], []];

  const initialCities = citiesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state,
    isDefault: c.isDefault,
    active: c.active,
    defaultBdiPercent: c.defaultBdiPercent,
    holidaysCount: c._count.holidays,
    materialPricesCount: c._count.materialPrices,
    laborPricesCount: c._count.laborPrices,
  }));

  const initialMaterials = materialsRaw.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    category: m.category,
    unit: m.unit,
    defaultLossPercent: m.defaultLossPercent,
    eapStageCode: m.eapStageCode,
    sourceSoftwareHint: m.sourceSoftwareHint,
    materialUnitCost: m.cityPrices[0]?.materialUnitCost ?? 0,
    thirdPartyUnitCost: m.cityPrices[0]?.thirdPartyUnitCost ?? 0,
    note: m.cityPrices[0]?.note ?? null,
  }));

  const initialLabor = laborRaw.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    productivityUnit: r.productivityUnit,
    dailyProductivityPerTeam: r.dailyProductivityPerTeam,
    laborUnitCost: r.cityPrices[0]?.laborUnitCost ?? 0,
    dailyTeamRate: r.cityPrices[0]?.dailyTeamRate ?? 0,
    socialChargesPercent: r.cityPrices[0]?.socialChargesPercent ?? 85,
  }));

  const initialHolidays = holidaysRaw.map((h) => ({
    id: h.id,
    cityId: h.cityId,
    date: h.date.toISOString().slice(0, 10),
    name: h.name,
    type: h.type,
  }));

  return (
    <AppShell eyebrow="EAP & Planejamento" role={admin.role}>
      <SectionHeading
        title="Catálogo Regional de Preços, Feriados & Templates Mestres"
        description="Base regional por cidade (Fortaleza/CE padrão), insumos padronizados, produtividade de mão de obra e estrutura mestre de 26 etapas EAP + 38 pacotes LOB."
      />
      <EapCatalogHub
        initialCities={initialCities}
        initialActiveCityId={defaultCity?.id ?? ""}
        initialMaterials={initialMaterials}
        initialLabor={initialLabor}
        initialHolidays={initialHolidays}
        masterStages={MASTER_EAP_STAGES}
        masterPackages={MASTER_LOB_PACKAGES}
        defaultPremises={DEFAULT_PROPOSAL_PREMISES}
        defaultExclusions={DEFAULT_PROPOSAL_EXCLUSIONS}
      />
    </AppShell>
  );
}
