import type { ZoneQuantities } from "@/server/eap/calculator";
import {
  DEFAULT_LOB_FLOORS,
  generateIntelligentFloorLobMatrix,
  type EapStageFloorLoad,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
  type LobFloorAllocationItem,
  type LobFloorDefinition,
} from "@/lib/eap-lob-grid";

export type EapDataOrigin =
  | "PRELIMINAR_PADRAO"
  | "QUANTITATIVO_IMPORTADO"
  | "EDITADO_USUARIO";

export const DATA_ORIGIN_META: Record<
  EapDataOrigin,
  {
    label: string;
    shortBadge: string;
    tooltip: string;
  }
> = {
  PRELIMINAR_PADRAO: {
    label: "Preliminar",
    shortBadge: "Est.",
    tooltip:
      "Valor preliminar estimado pelas medidas do projeto — clique para editar ou suba os quantitativos",
  },
  QUANTITATIVO_IMPORTADO: {
    label: "Quantitativos",
    shortBadge: "Proj.",
    tooltip: "Dado oficial minerado de arquivo PDF/HTML (TQS/Revit) da Etapa 1",
  },
  EDITADO_USUARIO: {
    label: "Editados",
    shortBadge: "Manual",
    tooltip: "Valor inserido ou ajustado manualmente pelo usuário",
  },
};

export function normalizeDataOrigin(
  raw?: string | null,
  fallback?: { sourceSoftware?: string | null; revisionTag?: string | null }
): EapDataOrigin {
  if (
    raw === "PRELIMINAR_PADRAO" ||
    raw === "QUANTITATIVO_IMPORTADO" ||
    raw === "EDITADO_USUARIO"
  ) {
    return raw;
  }
  if (fallback?.revisionTag && fallback.revisionTag !== "ORIGINAL") {
    return "EDITADO_USUARIO";
  }
  if (fallback?.sourceSoftware === "TQS" || fallback?.sourceSoftware === "REVIT") {
    return "QUANTITATIVO_IMPORTADO";
  }
  if (fallback?.sourceSoftware === "MANUAL") {
    return "EDITADO_USUARIO";
  }
  return "PRELIMINAR_PADRAO";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula quantitativos paramétricos preliminares coerentes com a área construída (m²)
 * e distribuídos nos 4 setores da EAP (FUND_TERREO, PAV_SUPERIOR, COBERTURA, EXTERNO).
 */
export function computePreliminaryEapQuantities(
  item: {
    code?: string | null;
    stageCode: string;
    unit: string;
    description: string;
  },
  builtAreaM2: number
): ZoneQuantities {
  const area = builtAreaM2 > 0 ? builtAreaM2 : 180;
  const code = (item.code || "").toUpperCase();
  const unit = (item.unit || "").trim().toLowerCase();
  const desc = (item.description || "").toLowerCase();
  const st = item.stageCode.padStart(2, "0");

  // Por padrão, 52% Térreo, 48% Pav. Superior para edificações residenciais de 2 pavimentos
  const terreo = area * 0.52;
  const sup = area * 0.48;
  const cob = area * 0.55;
  const ext = Math.max(40, area * 0.45);

  if (st === "01") {
    if (unit === "vb") return { FUND_TERREO: 1, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 };
    return { FUND_TERREO: round2(area * 1.15), PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: round2(ext * 0.5) };
  }

  if (st === "02") {
    const isAterro = code.includes("ATERRO") || desc.includes("aterro");
    return {
      FUND_TERREO: round2(area * (isAterro ? 0.35 : 0.45)),
      PAV_SUPERIOR: 0,
      COBERTURA: 0,
      EXTERNO: round2(ext * 0.1),
    };
  }

  if (st === "03") {
    if (unit === "m³" || unit === "m3") {
      const factor = code.includes("MAGRO") ? 0.06 : 0.18;
      return { FUND_TERREO: round2(area * factor), PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 };
    }
    if (unit === "kg") {
      return { FUND_TERREO: round2(area * 14), PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 };
    }
    return { FUND_TERREO: round2(area * 0.42), PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 };
  }

  if (st === "04") {
    if (unit === "m³" || unit === "m3") {
      return {
        FUND_TERREO: round2(terreo * 0.22),
        PAV_SUPERIOR: round2(sup * 0.21),
        COBERTURA: round2(cob * 0.08),
        EXTERNO: 0,
      };
    }
    if (unit === "kg") {
      return {
        FUND_TERREO: round2(terreo * 22),
        PAV_SUPERIOR: round2(sup * 21),
        COBERTURA: round2(cob * 7),
        EXTERNO: 0,
      };
    }
    // Fôrmas (m²)
    return {
      FUND_TERREO: round2(terreo * 1.35),
      PAV_SUPERIOR: round2(sup * 1.3),
      COBERTURA: round2(cob * 0.45),
      EXTERNO: 0,
    };
  }

  if (st === "05") {
    // Alvenaria e vergas
    if (unit === "m") {
      return { FUND_TERREO: round2(terreo * 0.35), PAV_SUPERIOR: round2(sup * 0.35), COBERTURA: 0, EXTERNO: round2(ext * 0.15) };
    }
    return {
      FUND_TERREO: round2(terreo * 1.25),
      PAV_SUPERIOR: round2(sup * 1.2),
      COBERTURA: round2(cob * 0.2),
      EXTERNO: round2(ext * 0.4),
    };
  }

  if (st === "06") {
    if (unit === "m") {
      return { FUND_TERREO: 0, PAV_SUPERIOR: 0, COBERTURA: round2(Math.sqrt(cob) * 4.5), EXTERNO: 0 };
    }
    return { FUND_TERREO: 0, PAV_SUPERIOR: 0, COBERTURA: round2(cob * 1.1), EXTERNO: 0 };
  }

  if (st === "07") {
    return {
      FUND_TERREO: round2(terreo * 0.22),
      PAV_SUPERIOR: round2(sup * 0.22),
      COBERTURA: round2(cob * 0.45),
      EXTERNO: round2(ext * 0.12),
    };
  }

  if (st === "08" || st === "09" || st === "10") {
    if (unit === "vb") return { FUND_TERREO: 0.5, PAV_SUPERIOR: 0.4, COBERTURA: 0.1, EXTERNO: 0 };
    if (unit === "pt" || unit === "un") {
      return {
        FUND_TERREO: Math.max(4, Math.round(terreo * 0.28)),
        PAV_SUPERIOR: Math.max(4, Math.round(sup * 0.26)),
        COBERTURA: 2,
        EXTERNO: 4,
      };
    }
    return {
      FUND_TERREO: round2(terreo * 0.85),
      PAV_SUPERIOR: round2(sup * 0.8),
      COBERTURA: round2(cob * 0.2),
      EXTERNO: round2(ext * 0.25),
    };
  }

  if (st === "11" || st === "12") {
    if (st === "12") {
      return {
        FUND_TERREO: round2(terreo * 0.55),
        PAV_SUPERIOR: round2(sup * 0.55),
        COBERTURA: round2(cob * 0.25),
        EXTERNO: round2(ext * 0.85),
      };
    }
    return {
      FUND_TERREO: round2(terreo * 2.1),
      PAV_SUPERIOR: round2(sup * 2.0),
      COBERTURA: 0,
      EXTERNO: 0,
    };
  }

  if (st === "13" || st === "14" || st === "15") {
    return {
      FUND_TERREO: round2(terreo * 0.95),
      PAV_SUPERIOR: round2(sup * 0.95),
      COBERTURA: 0,
      EXTERNO: st === "14" ? round2(ext * 0.45) : 0,
    };
  }

  if (st === "16" || st === "17") {
    if (unit === "un") {
      return {
        FUND_TERREO: Math.max(3, Math.round(terreo / 18)),
        PAV_SUPERIOR: Math.max(3, Math.round(sup / 18)),
        COBERTURA: 0,
        EXTERNO: 1,
      };
    }
    return {
      FUND_TERREO: round2(terreo * 0.28),
      PAV_SUPERIOR: round2(sup * 0.26),
      COBERTURA: 0,
      EXTERNO: round2(ext * 0.08),
    };
  }

  if (st === "18" || st === "19" || st === "20" || st === "21") {
    if (unit === "un") {
      return {
        FUND_TERREO: Math.max(3, Math.round(terreo / 15)),
        PAV_SUPERIOR: Math.max(3, Math.round(sup / 15)),
        COBERTURA: 0,
        EXTERNO: st === "21" ? 4 : 1,
      };
    }
    if (unit === "vb") return { FUND_TERREO: 0.5, PAV_SUPERIOR: 0.5, COBERTURA: 0, EXTERNO: 0 };
    return {
      FUND_TERREO: round2(terreo * 1.4),
      PAV_SUPERIOR: round2(sup * 1.35),
      COBERTURA: 0,
      EXTERNO: round2(ext * 0.55),
    };
  }

  if (st === "22" || st === "23" || st === "24" || st === "25" || st === "26") {
    if (unit === "vb") return { FUND_TERREO: 0.4, PAV_SUPERIOR: 0.35, COBERTURA: 0.05, EXTERNO: 0.2 };
    return {
      FUND_TERREO: st === "26" ? round2(terreo) : 0,
      PAV_SUPERIOR: st === "26" ? round2(sup) : 0,
      COBERTURA: 0,
      EXTERNO: round2(ext * 0.6),
    };
  }

  return {
    FUND_TERREO: round2(terreo * 0.5),
    PAV_SUPERIOR: round2(sup * 0.5),
    COBERTURA: 0,
    EXTERNO: 0,
  };
}

function countUniqueWorkingDays(allocations: LobFloorAllocationItem[]): number {
  const uniqueDates = new Set(allocations.map((a) => a.dateIso));
  return uniqueDates.size;
}

/**
 * Gera matriz LOB preliminar calibrada para um horizonte realista de ~13 meses (~260–280 dias úteis),
 * mantendo 100% da sequência construtiva e zero conflitos de equipe.
 * Todas as células geradas recebem dataOrigin = "PRELIMINAR_PADRAO" (preservando células EDITADO_USUARIO).
 */
export function generatePreliminary13MonthLobMatrix(input: {
  startDate: string;
  builtAreaM2: number;
  floors?: LobFloorDefinition[];
  servicePackages: FloorMatrixServicePackage[];
  workTeams: FloorMatrixWorkTeam[];
  stageLoads?: EapStageFloorLoad[];
  holidaySet: Set<string>;
  existingAllocations?: LobFloorAllocationItem[];
  preserveEdited?: boolean;
}): {
  allocations: LobFloorAllocationItem[];
  scheduledPackagesCount: number;
  endDate: string;
  workingDaysSpan: number;
} {
  const floors =
    input.floors && input.floors.length > 0 ? input.floors : DEFAULT_LOB_FLOORS;
  const lockedEdited = input.preserveEdited
    ? (input.existingAllocations ?? [])
        .filter((a) => a.dataOrigin === "EDITADO_USUARIO" || a.isLocked)
        .map((a) => ({ ...a, isLocked: true, dataOrigin: "EDITADO_USUARIO" as const }))
    : [];

  // Calibra produtividade/área de referência para encaixar os 38 pacotes no horizonte de ~13 meses (260-280 d.u.)
  const baseRun = generateIntelligentFloorLobMatrix({
    startDate: input.startDate,
    floors,
    servicePackages: input.servicePackages,
    workTeams: input.workTeams,
    stageLoads: input.stageLoads ?? [],
    holidaySet: input.holidaySet,
    existingAllocations: lockedEdited,
    preserveLocked: input.preserveEdited,
    builtAreaM2: input.builtAreaM2,
    defaultDataOrigin: "PRELIMINAR_PADRAO",
  });

  const currentDays = countUniqueWorkingDays(baseRun.allocations);
  // Se já estiver dentro da faixa otimizada abaixo de 13 meses (210..245 d.u.), retorna direto
  if (currentDays >= 210 && currentDays <= 245) {
    return {
      allocations: baseRun.allocations.map((a) => ({
        ...a,
        dataOrigin: a.dataOrigin ?? "PRELIMINAR_PADRAO",
      })),
      scheduledPackagesCount: baseRun.scheduledPackagesCount,
      endDate: baseRun.endDate,
      workingDaysSpan: currentDays,
    };
  }

  // Ajusta dinamicamente o fator de escala paramétrica (sem depender de EAP vazia) para fechar em ~11 meses (232 d.u. < 13 meses)
  const targetDays = 232;
  const scaleRatio = currentDays > 0 ? targetDays / currentDays : 1;
  const tunedPackages = input.servicePackages.map((sp) => {
    const baseProd = sp.productivityPerDay > 0 ? sp.productivityPerDay : 1;
    // Menor produtividade/dia = mais dias úteis; maior = menos dias úteis
    const adjustedProd = Math.max(0.15, Math.round((baseProd / scaleRatio) * 1000) / 1000);
    return { ...sp, productivityPerDay: adjustedProd };
  });

  const calibratedRun = generateIntelligentFloorLobMatrix({
    startDate: input.startDate,
    floors,
    servicePackages: tunedPackages,
    workTeams: input.workTeams,
    // Quando calibra preliminarmente, usa fallback paramétrico se EAP ainda estiver vazia ou stageLoads calibrados
    stageLoads: input.stageLoads ?? [],
    holidaySet: input.holidaySet,
    existingAllocations: lockedEdited,
    preserveLocked: input.preserveEdited,
    builtAreaM2: Math.max(120, Math.min(450, (input.builtAreaM2 || 180) * scaleRatio)),
    defaultDataOrigin: "PRELIMINAR_PADRAO",
  });

  const finalSpan = countUniqueWorkingDays(calibratedRun.allocations);
  return {
    allocations: calibratedRun.allocations.map((a) => ({
      ...a,
      dataOrigin: a.dataOrigin ?? "PRELIMINAR_PADRAO",
    })),
    scheduledPackagesCount: calibratedRun.scheduledPackagesCount,
    endDate: calibratedRun.endDate,
    workingDaysSpan: finalSpan,
  };
}
