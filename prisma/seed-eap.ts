import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const FORTALEZA_MATERIALS = [
  // AÇO CA-50 / CA-60 (TQS)
  { code: "ACO-CA60-50", name: "Aço CA-60 Ø 5,0 mm (corte e dobra)", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 8.45, thirdPartyUnitCost: 0 },
  { code: "ACO-CA50-63", name: "Aço CA-50 Ø 6,3 mm (corte e dobra)", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 8.20, thirdPartyUnitCost: 0 },
  { code: "ACO-CA50-80", name: "Aço CA-50 Ø 8,0 mm (corte e dobra)", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 7.95, thirdPartyUnitCost: 0 },
  { code: "ACO-CA50-100", name: "Aço CA-50 Ø 10,0 mm (corte e dobra)", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 7.80, thirdPartyUnitCost: 0 },
  { code: "ACO-CA50-125", name: "Aço CA-50 Ø 12,5 mm (corte e dobra)", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 7.75, thirdPartyUnitCost: 0 },
  { code: "ACO-CA50-160", name: "Aço CA-50 Ø 16,0 mm (corte e dobra)", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 7.85, thirdPartyUnitCost: 0 },
  { code: "ACO-CA50-200", name: "Aço CA-50 Ø 20,0 mm (corte e dobra)", category: "ACO", unit: "kg", defaultLossPercent: 10, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 8.10, thirdPartyUnitCost: 0 },

  // CONCRETO USINADO (TQS)
  { code: "CONC-FCK25", name: "Concreto Usinado fck 25 MPa + Bombeamento/Lançamento", category: "CONCRETO", unit: "m³", defaultLossPercent: 5, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 560.0, thirdPartyUnitCost: 65.0 },
  { code: "CONC-FCK30", name: "Concreto Usinado fck 30 MPa + Bombeamento/Lançamento", category: "CONCRETO", unit: "m³", defaultLossPercent: 5, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 595.0, thirdPartyUnitCost: 65.0 },
  { code: "CONC-FCK35", name: "Concreto Usinado fck 35 MPa + Bombeamento/Lançamento", category: "CONCRETO", unit: "m³", defaultLossPercent: 5, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 635.0, thirdPartyUnitCost: 70.0 },
  { code: "CONC-MAGRO", name: "Concreto Magro fck 15 MPa (Lastro de Fundação)", category: "CONCRETO", unit: "m³", defaultLossPercent: 5, eapStageCode: "03", sourceSoftwareHint: "TQS", materialUnitCost: 430.0, thirdPartyUnitCost: 0 },

  // FÔRMAS & ESCORAMENTO (TQS)
  { code: "FORM-MAD-COMP", name: "Fôrma de Madeira Compensado Plastificado 14mm (3 usos)", category: "FORMAS", unit: "m²", defaultLossPercent: 8, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 58.0, thirdPartyUnitCost: 14.0 },
  { code: "FORM-ESCOR-MET", name: "Locação de Escoramento Metálico (mês/m²)", category: "FORMAS", unit: "m²", defaultLossPercent: 0, eapStageCode: "04", sourceSoftwareHint: "TQS", materialUnitCost: 0, thirdPartyUnitCost: 22.0 },

  // ALVENARIA (REVIT)
  { code: "ALV-TJC8", name: "Bloco Cerâmico Vedação 9x19x19 (TJC8) + Argamassa", category: "ALVENARIA", unit: "m²", defaultLossPercent: 8, eapStageCode: "05", sourceSoftwareHint: "REVIT", materialUnitCost: 44.5, thirdPartyUnitCost: 0 },
  { code: "ALV-TJC14", name: "Bloco Cerâmico Vedação 14x19x19 (TJC14) + Argamassa", category: "ALVENARIA", unit: "m²", defaultLossPercent: 8, eapStageCode: "05", sourceSoftwareHint: "REVIT", materialUnitCost: 56.0, thirdPartyUnitCost: 0 },
  { code: "ALV-TJC19", name: "Bloco Cerâmico Vedação 19x19x19 (TJC19) + Argamassa", category: "ALVENARIA", unit: "m²", defaultLossPercent: 8, eapStageCode: "05", sourceSoftwareHint: "REVIT", materialUnitCost: 68.0, thirdPartyUnitCost: 0 },
  { code: "ALV-TJM", name: "Tijolo Maciço / Dobrado (TJM) para Vergas e Detalhes", category: "ALVENARIA", unit: "m²", defaultLossPercent: 10, eapStageCode: "05", sourceSoftwareHint: "REVIT", materialUnitCost: 92.0, thirdPartyUnitCost: 0 },
  { code: "ALV-CBG", name: "Cobogó Cerâmico / Cimentício Decorativo (CBG)", category: "ALVENARIA", unit: "m²", defaultLossPercent: 8, eapStageCode: "05", sourceSoftwareHint: "REVIT", materialUnitCost: 165.0, thirdPartyUnitCost: 0 },

  // REVESTIMENTOS & ARGAMASSAS (REVIT)
  { code: "REV-CHAP-EMB", name: "Chapisco + Emboço / Massa Única (Argamassa Estabilizada)", category: "REVESTIMENTOS", unit: "m²", defaultLossPercent: 10, eapStageCode: "11", sourceSoftwareHint: "REVIT", materialUnitCost: 28.0, thirdPartyUnitCost: 0 },
  { code: "REV-GESSO-LISO", name: "Reboco de Gesso Liso Desempenado em Paredes", category: "REVESTIMENTOS", unit: "m²", defaultLossPercent: 8, eapStageCode: "11", sourceSoftwareHint: "REVIT", materialUnitCost: 18.5, thirdPartyUnitCost: 22.0 },
  { code: "REV-CONTRAPISO", name: "Contrapiso Regularizado e=4cm traço 1:4", category: "REVESTIMENTOS", unit: "m²", defaultLossPercent: 8, eapStageCode: "13", sourceSoftwareHint: "REVIT", materialUnitCost: 34.0, thirdPartyUnitCost: 0 },
  { code: "REV-PORC-90", name: "Porcelanato Retificado Grande Formato 90x90 + AC-III + Rejunte", category: "REVESTIMENTOS", unit: "m²", defaultLossPercent: 12, eapStageCode: "14", sourceSoftwareHint: "REVIT", materialUnitCost: 148.0, thirdPartyUnitCost: 0 },
  { code: "REV-RODAPE-15", name: "Rodapé Porcelanato / Poliestireno h=15cm + Cola", category: "REVESTIMENTOS", unit: "m", defaultLossPercent: 10, eapStageCode: "14", sourceSoftwareHint: "REVIT", materialUnitCost: 36.0, thirdPartyUnitCost: 0 },
  { code: "REV-FORRO-GESSO", name: "Forro de Gesso Acartonado (Drywall) com Tabica Metálica", category: "REVESTIMENTOS", unit: "m²", defaultLossPercent: 5, eapStageCode: "15", sourceSoftwareHint: "REVIT", materialUnitCost: 42.0, thirdPartyUnitCost: 48.0 },

  // IMPERMEABILIZAÇÃO
  { code: "IMP-MANTA-4MM", name: "Impermeabilização com Manta Asfáltica 4mm + Primer + Proteção", category: "IMPERMEABILIZACAO", unit: "m²", defaultLossPercent: 10, eapStageCode: "07", sourceSoftwareHint: "REVIT", materialUnitCost: 88.0, thirdPartyUnitCost: 52.0 },
  { code: "IMP-POLIMERICA", name: "Impermeabilização Argamassa Polimérica Flexível (Áreas Molhadas)", category: "IMPERMEABILIZACAO", unit: "m²", defaultLossPercent: 8, eapStageCode: "07", sourceSoftwareHint: "REVIT", materialUnitCost: 46.0, thirdPartyUnitCost: 0 },

  // ESQUADRIAS & BANCADAS (REVIT)
  { code: "ESQ-ALUM-VIDRO", name: "Esquadria de Alumínio Linha Suprema/Gold com Vidro Temperado", category: "ESQUADRIAS", unit: "m²", defaultLossPercent: 0, eapStageCode: "16", sourceSoftwareHint: "REVIT", materialUnitCost: 0, thirdPartyUnitCost: 1180.0 },
  { code: "ESQ-GUARDA-CORPO", name: "Guarda-Corpo em Alumínio e Vidro Laminado 10mm", category: "ESQUADRIAS", unit: "m", defaultLossPercent: 0, eapStageCode: "16", sourceSoftwareHint: "REVIT", materialUnitCost: 0, thirdPartyUnitCost: 890.0 },
  { code: "ESQ-PORTA-MAD", name: "Kit Porta Pronta de Madeira Laqueada + Alizar + Fechadura", category: "ESQUADRIAS", unit: "unid", defaultLossPercent: 0, eapStageCode: "17", sourceSoftwareHint: "REVIT", materialUnitCost: 1350.0, thirdPartyUnitCost: 180.0 },
  { code: "BANC-GRANITO", name: "Bancada em Granito / Quartzo com Frontão e Saia", category: "BANCADAS", unit: "m²", defaultLossPercent: 5, eapStageCode: "18", sourceSoftwareHint: "REVIT", materialUnitCost: 0, thirdPartyUnitCost: 960.0 },

  // PINTURA
  { code: "PINT-PVA-INT", name: "Pintura Interna (Selador + 2 demãos Massa Corrida + 2 demãos Acrílica Fosca)", category: "PINTURA", unit: "m²", defaultLossPercent: 8, eapStageCode: "19", sourceSoftwareHint: "REVIT", materialUnitCost: 24.0, thirdPartyUnitCost: 0 },
  { code: "PINT-ACRL-EXT", name: "Pintura Externa Acrílica Premium / Textura Projetada de Fachada", category: "PINTURA", unit: "m²", defaultLossPercent: 10, eapStageCode: "19", sourceSoftwareHint: "REVIT", materialUnitCost: 38.0, thirdPartyUnitCost: 0 },

  // INSTALAÇÕES & LOUÇAS
  { code: "INST-PTO-ELET", name: "Ponto Elétrico Completo (Eletroduto, Caixa, Cabo Flexível e Acabamento)", category: "INSTALACOES", unit: "unid", defaultLossPercent: 5, eapStageCode: "08", sourceSoftwareHint: "MANUAL", materialUnitCost: 185.0, thirdPartyUnitCost: 0 },
  { code: "INST-PTO-LUMI", name: "Ponto Luminotécnico (Spot/Perfil LED + Driver + Instalação)", category: "INSTALACOES", unit: "unid", defaultLossPercent: 5, eapStageCode: "21", sourceSoftwareHint: "MANUAL", materialUnitCost: 145.0, thirdPartyUnitCost: 0 },
  { code: "INST-PTO-HIDRO", name: "Ponto Hidrossanitário (Água Fria/Esgoto PVC Soldável + Conexões)", category: "INSTALACOES", unit: "unid", defaultLossPercent: 5, eapStageCode: "09", sourceSoftwareHint: "MANUAL", materialUnitCost: 265.0, thirdPartyUnitCost: 0 },
  { code: "LOUC-CONJ-BWC", name: "Conjunto Louças e Metais por Banheiro (Bacia, Cuba, Misturador, Chuveiro)", category: "LOUCAS_METAIS", unit: "unid", defaultLossPercent: 0, eapStageCode: "20", sourceSoftwareHint: "REVIT", materialUnitCost: 2450.0, thirdPartyUnitCost: 0 },

  // IMPLANTAÇÃO & CANTEIRO
  { code: "IMPL-CANTEIRO", name: "Implantação de Canteiro, Tapume, Barracão e Ligações Provisórias", category: "IMPLANTACAO", unit: "vb", defaultLossPercent: 0, eapStageCode: "01", sourceSoftwareHint: "MANUAL", materialUnitCost: 12500.0, thirdPartyUnitCost: 6500.0 },
  { code: "IMPL-ADMIN-MES", name: "Administração Local de Obra (Mestre + Equipamentos + Caçambas)", category: "IMPLANTACAO", unit: "mês", defaultLossPercent: 0, eapStageCode: "25", sourceSoftwareHint: "MANUAL", materialUnitCost: 1800.0, thirdPartyUnitCost: 3200.0 },
];

export const FORTALEZA_LABOR_ROLES = [
  { code: "MO-PEDREIRO-EQ", name: "Pedreiro + Servente (Alvenaria / Reboco)", unit: "m²", productivityUnit: "m²/dia", dailyProductivityPerTeam: 16.0, laborUnitCost: 34.0, dailyTeamRate: 420.0, socialChargesPercent: 85.0 },
  { code: "MO-ARMADOR", name: "Armador + Ajudante (Corte, Dobra e Montagem)", unit: "kg", productivityUnit: "kg/dia", dailyProductivityPerTeam: 140.0, laborUnitCost: 3.10, dailyTeamRate: 410.0, socialChargesPercent: 85.0 },
  { code: "MO-CARPINTEIRO", name: "Carpinteiro de Fôrma + Ajudante", unit: "m²", productivityUnit: "m²/dia", dailyProductivityPerTeam: 12.0, laborUnitCost: 42.0, dailyTeamRate: 430.0, socialChargesPercent: 85.0 },
  { code: "MO-CONCRETAGEM", name: "Equipe de Concretagem (Lançamento/Vibração/Cura)", unit: "m³", productivityUnit: "m³/dia", dailyProductivityPerTeam: 18.0, laborUnitCost: 68.0, dailyTeamRate: 620.0, socialChargesPercent: 85.0 },
  { code: "MO-AZULEJISTA", name: "Azulejista / Porcelanatista + Ajudante", unit: "m²", productivityUnit: "m²/dia", dailyProductivityPerTeam: 14.0, laborUnitCost: 52.0, dailyTeamRate: 480.0, socialChargesPercent: 85.0 },
  { code: "MO-ELETRICISTA", name: "Eletricista + Auxiliar (Infra + Enfiação)", unit: "unid", productivityUnit: "pontos/dia", dailyProductivityPerTeam: 10.0, laborUnitCost: 75.0, dailyTeamRate: 460.0, socialChargesPercent: 85.0 },
  { code: "MO-ENCANADOR", name: "Encanador Hidráulico + Auxiliar", unit: "unid", productivityUnit: "pontos/dia", dailyProductivityPerTeam: 6.0, laborUnitCost: 95.0, dailyTeamRate: 460.0, socialChargesPercent: 85.0 },
  { code: "MO-PINTOR", name: "Pintor Profissional + Auxiliar", unit: "m²", productivityUnit: "m²/dia", dailyProductivityPerTeam: 28.0, laborUnitCost: 24.0, dailyTeamRate: 420.0, socialChargesPercent: 85.0 },
  { code: "MO-GESSEIRO", name: "Gesseiro (Reboco Gesso / Forro Drywall)", unit: "m²", productivityUnit: "m²/dia", dailyProductivityPerTeam: 24.0, laborUnitCost: 22.0, dailyTeamRate: 410.0, socialChargesPercent: 85.0 },
  { code: "MO-MESTRE", name: "Mestre de Obras (Administração Indireta Mensal)", unit: "mês", productivityUnit: "mês", dailyProductivityPerTeam: 1.0, laborUnitCost: 6800.0, dailyTeamRate: 310.0, socialChargesPercent: 85.0 },
];

export const FORTALEZA_HOLIDAYS_2026_2027: Array<{
  date: string;
  name: string;
  type: "NACIONAL" | "ESTADUAL" | "MUNICIPAL" | "RECESSO";
}> = [
  // 2026
  { date: "2026-01-01", name: "Confraternização Universal", type: "NACIONAL" },
  { date: "2026-02-16", name: "Carnaval (Segunda-feira)", type: "RECESSO" },
  { date: "2026-02-17", name: "Carnaval (Terça-feira)", type: "RECESSO" },
  { date: "2026-03-19", name: "Dia de São José (Padroeiro do Ceará)", type: "ESTADUAL" },
  { date: "2026-03-25", name: "Data Magna do Ceará (Abolição no CE)", type: "ESTADUAL" },
  { date: "2026-04-03", name: "Sexta-Feira Santa", type: "NACIONAL" },
  { date: "2026-04-13", name: "Aniversário de Fortaleza (Ponto Facultativo/Ref.)", type: "MUNICIPAL" },
  { date: "2026-04-21", name: "Tiradentes", type: "NACIONAL" },
  { date: "2026-05-01", name: "Dia do Trabalho", type: "NACIONAL" },
  { date: "2026-06-04", name: "Corpus Christi", type: "MUNICIPAL" },
  { date: "2026-08-15", name: "Nossa Senhora da Assunção (Padroeira de Fortaleza)", type: "MUNICIPAL" },
  { date: "2026-09-07", name: "Independência do Brasil", type: "NACIONAL" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida", type: "NACIONAL" },
  { date: "2026-11-02", name: "Finados", type: "NACIONAL" },
  { date: "2026-11-15", name: "Proclamação da República", type: "NACIONAL" },
  { date: "2026-11-20", name: "Dia Nacional de Zumbi e da Consciência Negra", type: "NACIONAL" },
  { date: "2026-12-25", name: "Natal", type: "NACIONAL" },

  // 2027
  { date: "2027-01-01", name: "Confraternização Universal", type: "NACIONAL" },
  { date: "2027-02-08", name: "Carnaval (Segunda-feira)", type: "RECESSO" },
  { date: "2027-02-09", name: "Carnaval (Terça-feira)", type: "RECESSO" },
  { date: "2027-03-19", name: "Dia de São José (Padroeiro do Ceará)", type: "ESTADUAL" },
  { date: "2027-03-25", name: "Data Magna do Ceará (Abolição no CE)", type: "ESTADUAL" },
  { date: "2027-03-26", name: "Sexta-Feira Santa", type: "NACIONAL" },
  { date: "2027-04-21", name: "Tiradentes", type: "NACIONAL" },
  { date: "2027-05-01", name: "Dia do Trabalho", type: "NACIONAL" },
  { date: "2027-05-27", name: "Corpus Christi", type: "MUNICIPAL" },
  { date: "2027-08-15", name: "Nossa Senhora da Assunção (Padroeira de Fortaleza)", type: "MUNICIPAL" },
  { date: "2027-09-07", name: "Independência do Brasil", type: "NACIONAL" },
  { date: "2027-10-12", name: "Nossa Senhora Aparecida", type: "NACIONAL" },
  { date: "2027-11-02", name: "Finados", type: "NACIONAL" },
  { date: "2027-11-15", name: "Proclamação da República", type: "NACIONAL" },
  { date: "2027-11-20", name: "Dia Nacional de Zumbi e da Consciência Negra", type: "NACIONAL" },
  { date: "2027-12-25", name: "Natal", type: "NACIONAL" },
];

export async function seedEapFortaleza() {
  const city = await prisma.cityCatalog.upsert({
    where: { name_state: { name: "Fortaleza", state: "CE" } },
    update: { isDefault: true, active: true },
    create: {
      name: "Fortaleza",
      state: "CE",
      isDefault: true,
      active: true,
      defaultBdiPercent: 22.0,
    },
  });

  for (const h of FORTALEZA_HOLIDAYS_2026_2027) {
    const dt = new Date(`${h.date}T00:00:00.000Z`);
    await prisma.cityHoliday.upsert({
      where: { cityId_date: { cityId: city.id, date: dt } },
      update: { name: h.name, type: h.type },
      create: { cityId: city.id, date: dt, name: h.name, type: h.type },
    });
  }

  for (const mat of FORTALEZA_MATERIALS) {
    const item = await prisma.materialCatalogItem.upsert({
      where: { code: mat.code },
      update: {
        name: mat.name,
        category: mat.category,
        unit: mat.unit,
        defaultLossPercent: mat.defaultLossPercent,
        eapStageCode: mat.eapStageCode,
        sourceSoftwareHint: mat.sourceSoftwareHint,
        active: true,
      },
      create: {
        code: mat.code,
        name: mat.name,
        category: mat.category,
        unit: mat.unit,
        defaultLossPercent: mat.defaultLossPercent,
        eapStageCode: mat.eapStageCode,
        sourceSoftwareHint: mat.sourceSoftwareHint,
        active: true,
      },
    });

    await prisma.cityMaterialPrice.upsert({
      where: { cityId_materialId: { cityId: city.id, materialId: item.id } },
      update: {
        materialUnitCost: mat.materialUnitCost,
        thirdPartyUnitCost: mat.thirdPartyUnitCost,
      },
      create: {
        cityId: city.id,
        materialId: item.id,
        materialUnitCost: mat.materialUnitCost,
        thirdPartyUnitCost: mat.thirdPartyUnitCost,
        note: "Base referencial Fortaleza/CE",
      },
    });
  }

  for (const role of FORTALEZA_LABOR_ROLES) {
    const lr = await prisma.laborRoleCatalog.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        unit: role.unit,
        productivityUnit: role.productivityUnit,
        dailyProductivityPerTeam: role.dailyProductivityPerTeam,
        active: true,
      },
      create: {
        code: role.code,
        name: role.name,
        unit: role.unit,
        productivityUnit: role.productivityUnit,
        dailyProductivityPerTeam: role.dailyProductivityPerTeam,
        active: true,
      },
    });

    await prisma.cityLaborPrice.upsert({
      where: { cityId_laborRoleId: { cityId: city.id, laborRoleId: lr.id } },
      update: {
        laborUnitCost: role.laborUnitCost,
        dailyTeamRate: role.dailyTeamRate,
        socialChargesPercent: role.socialChargesPercent,
      },
      create: {
        cityId: city.id,
        laborRoleId: lr.id,
        laborUnitCost: role.laborUnitCost,
        dailyTeamRate: role.dailyTeamRate,
        socialChargesPercent: role.socialChargesPercent,
      },
    });
  }

  return {
    cityId: city.id,
    cityLabel: `${city.name}/${city.state}`,
    materialsCount: FORTALEZA_MATERIALS.length,
    laborRolesCount: FORTALEZA_LABOR_ROLES.length,
    holidaysCount: FORTALEZA_HOLIDAYS_2026_2027.length,
  };
}

if (require.main === module) {
  seedEapFortaleza()
    .then((summary) => {
      console.log("[seed-eap] Concluído com sucesso:", summary);
    })
    .catch((err) => {
      console.error("[seed-eap] Erro ao executar seed:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
