import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import {
  ensureDefaultTeamsAndPackages,
  getContrastTextHex,
} from "@/server/eap/teams-and-packages";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createPackageSchema = z.object({
  packageNumber: z.number().int().min(1).max(999).optional(),
  name: z.string().trim().min(2, "Nome do pacote deve ter ao menos 2 caracteres.").max(160),
  discipline: z.string().trim().min(2).max(120).default("Geral"),
  corHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor hexadecimal inválida.")
    .default("#1D4ED8"),
  textHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  predecessorNumbers: z.array(z.number().int().min(1).max(999)).max(50).default([]),
  productivityPerDay: z.number().positive().max(100000).default(10),
  productivityUnit: z.string().trim().min(1).max(30).default("un/dia"),
  linkedEapStageCodes: z.array(z.string().trim().min(1).max(10)).max(30).default([]),
  isActive: z.boolean().default(true),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    await ensureDefaultTeamsAndPackages(eap.id);

    const packages = await prisma.eapServicePackage.findMany({
      where: { eapProjectId: eap.id },
      orderBy: { packageNumber: "asc" },
    });

    return jsonNoStore({ ok: true, packages });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao listar pacotes de serviço.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const body = await request.json();
    const parsed = createPackageSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    let nextNumber = parsed.packageNumber;
    if (!nextNumber) {
      const agg = await prisma.eapServicePackage.aggregate({
        where: { eapProjectId: eap.id },
        _max: { packageNumber: true },
      });
      nextNumber = (agg._max.packageNumber ?? 0) + 1;
    }

    const created = await prisma.eapServicePackage.create({
      data: {
        eapProjectId: eap.id,
        packageNumber: nextNumber,
        name: parsed.name,
        discipline: parsed.discipline,
        corHex: parsed.corHex.toUpperCase(),
        textHex: (parsed.textHex ?? getContrastTextHex(parsed.corHex)).toUpperCase(),
        predecessorNumbers: Array.from(new Set(parsed.predecessorNumbers)).filter(
          (n) => n !== nextNumber
        ),
        productivityPerDay: parsed.productivityPerDay,
        productivityUnit: parsed.productivityUnit,
        linkedEapStageCodes: Array.from(new Set(parsed.linkedEapStageCodes)),
        isActive: parsed.isActive,
      },
    });

    return jsonNoStore({ ok: true, package: created }, 201);
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao criar pacote de serviço.",
      "Já existe um pacote com este número neste projeto."
    );
  }
}
