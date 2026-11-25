import { describe, expect, it } from "vitest";
import {
  CANONICAL_LOB_PACKAGE_RULES,
  DEFAULT_LOB_FLOORS,
  generateIntelligentFloorLobMatrix,
  getLobPackageMeta,
  hasBrokenPhysicalSequence,
  normalizeLobFloorId,
  summarizeLobAllocationsByPackage,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
  type LobFloorAllocationItem,
} from "@/lib/eap-lob-grid";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";
import { executiveDashboardData } from "@/server/services/dashboard-service";

describe("Fase 25 — Sequência Lógica Estrita LOB, Cura e Resiliência do Dashboard Executivo", () => {
  const servicePackages: FloorMatrixServicePackage[] = MASTER_LOB_PACKAGES.map((p) => {
    const meta = getLobPackageMeta(p.packageNumber, {
      name: p.name,
      waveName: p.waveName,
      teamsCount: p.defaultTeamsCount,
      predecessorNumbers: p.predecessorNumbers,
    });
    return {
      packageNumber: p.packageNumber,
      name: p.name,
      discipline: p.waveName,
      corHex: meta.corHex,
      textHex: meta.textHex,
      predecessorNumbers: p.predecessorNumbers,
      productivityPerDay: 25,
      productivityUnit: "m2/dia",
      linkedEapStageCodes: p.linkedStageCodes,
      isActive: true,
    };
  });

  const workTeams: FloorMatrixWorkTeam[] = [
    {
      teamCode: "A",
      name: "Equipe A — Estrutura & Geral",
      specialty: "Estrutural",
      maxDailyHours: 8,
      maxSimultaneousFronts: 1,
      workers: [{ roleName: "Pedreiro Estrutural", headcount: 4, dailyRate: 180, socialChargesPct: 40 }],
    },
    {
      teamCode: "B",
      name: "Equipe B — Revestimentos & Acabamentos",
      specialty: "Acabamentos",
      maxDailyHours: 8,
      maxSimultaneousFronts: 1,
      workers: [{ roleName: "Azulejista / Gesseiro", headcount: 4, dailyRate: 190, socialChargesPct: 40 }],
    },
    {
      teamCode: "C",
      name: "Equipe C — Instalações MEP",
      specialty: "Instalações",
      maxDailyHours: 8,
      maxSimultaneousFronts: 1,
      workers: [{ roleName: "Eletricista / Encanador", headcount: 3, dailyRate: 210, socialChargesPct: 40 }],
    },
  ];

  it("normaliza IDs de pavimentos com variantes numéricas e textuais", () => {
    expect(normalizeLobFloorId("1")).toBe("FUNDACAO");
    expect(normalizeLobFloorId("2")).toBe("TERREO");
    expect(normalizeLobFloorId("3")).toBe("PAV_SUPERIOR");
    expect(normalizeLobFloorId("4")).toBe("COBERTA");
    expect(normalizeLobFloorId("5")).toBe("AREA_EXTERNA");
    expect(normalizeLobFloorId("Infraestrutura / Fundação")).toBe("FUNDACAO");
    expect(normalizeLobFloorId("Térreo")).toBe("TERREO");
    expect(normalizeLobFloorId("Pavimento Superior")).toBe("PAV_SUPERIOR");
  });

  it("detecta matriz incoerente onde C19 (Chapisco) ou A1 em Pavimento Superior ocorre no dia 1", () => {
    // Cenário do print do usuário: Dia 1 com A1 na fundação, C19 no térreo e A1 no pavimento superior
    const brokenAllocations: LobFloorAllocationItem[] = [
      {
        floorId: "FUNDACAO",
        floorName: "Infraestrutura / Fundação",
        floorOrder: 1,
        dateIso: "2026-02-01",
        teamCode: "A",
        packageNumber: 1,
        isOvertime: false,
      },
      {
        floorId: "TERREO",
        floorName: "Térreo",
        floorOrder: 2,
        dateIso: "2026-02-01",
        teamCode: "C",
        packageNumber: 19, // Incoerência: Chapisco no Dia 1 junto ao Canteiro!
        isOvertime: false,
      },
      {
        floorId: "PAV_SUPERIOR",
        floorName: "Pavimento Superior",
        floorOrder: 3,
        dateIso: "2026-02-01",
        teamCode: "A",
        packageNumber: 1, // Incoerência: Canteiro de obra no Pavimento Superior!
        isOvertime: false,
      },
    ];

    expect(hasBrokenPhysicalSequence(brokenAllocations, servicePackages)).toBe(true);
  });

  it("gera cronograma estritamente lógico onde Semana 1 contém apenas serviços iniciais de fundação", () => {
    const result = generateIntelligentFloorLobMatrix({
      startDate: "2026-02-01",
      builtAreaM2: 250,
      holidaySet: new Set(),
      floors: DEFAULT_LOB_FLOORS,
      servicePackages,
      workTeams,
      stageLoads: [],
    });

    expect(result.allocations.length).toBeGreaterThan(0);

    // Na primeira semana (2026-02-01 a 2026-02-05), só podem existir pacotes 1 e 2 na Fundação
    const week1Allocs = result.allocations.filter((a) => a.dateIso <= "2026-02-05");
    expect(week1Allocs.length).toBeGreaterThan(0);
    for (const a of week1Allocs) {
      expect(a.floorId).toBe("FUNDACAO");
      expect(a.packageNumber).toBeLessThanOrEqual(2);
      expect(a.teamCode).toBe("A");
    }

    // Chapisco e Reboco (Pct 19) só pode começar muito depois das fundações e alvenarias
    const pkg19Allocs = result.allocations.filter((a) => a.packageNumber === 19);
    expect(pkg19Allocs.length).toBeGreaterThan(0);
    const minPkg19Date = pkg19Allocs.map((a) => a.dateIso).sort()[0];
    expect(minPkg19Date > "2026-04-01").toBe(true); // Pelo menos 2 meses após o início

    // Matriz gerada passa no teste de sequência física sem erros
    expect(hasBrokenPhysicalSequence(result.allocations, servicePackages)).toBe(false);
  });

  it("coincide perfeitamente a quantidade de células no calendário com o resumo da tabela de pacotes", () => {
    const result = generateIntelligentFloorLobMatrix({
      startDate: "2026-02-01",
      builtAreaM2: 250,
      holidaySet: new Set(),
      floors: DEFAULT_LOB_FLOORS,
      servicePackages,
      workTeams,
      stageLoads: [],
    });

    const summaryMap = summarizeLobAllocationsByPackage(result.allocations);

    // Para cada pacote, o número de células geradas bate 1:1 com workingDaysCount
    for (const [pkgNum, summary] of summaryMap.entries()) {
      const actualCells = result.allocations.filter((a) => a.packageNumber === pkgNum).length;
      expect(summary.workingDaysCount).toBe(actualCells);
      expect(summary.teamsCount).toBeGreaterThan(0);
    }
  });

  it("executiveDashboardData suporta callerUser e não lança erro fatal mesmo com banco em inicialização", async () => {
    const mockUser = {
      id: "usr-admin-test",
      role: "ADMIN" as const,
      name: "Administrador de Teste",
      permissions: ["dashboard", "projetos", "financeiro", "cronograma", "clientes", "equipe"],
    };

    const data = await executiveDashboardData(mockUser);
    expect(data).toBeDefined();
    expect(data.metrics).toBeDefined();
    expect(typeof data.metrics.clients).toBe("number");
    expect(Array.isArray(data.projects)).toBe(true);
    expect(Array.isArray(data.deliveries)).toBe(true);
    expect(Array.isArray(data.team)).toBe(true);
    expect(Array.isArray(data.proposalFunnel)).toBe(true);
  }, 25000);
});
