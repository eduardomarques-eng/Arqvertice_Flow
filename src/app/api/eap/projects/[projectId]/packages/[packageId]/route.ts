import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { getContrastTextHex } from "@/server/eap/teams-and-packages";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchPackageSchema = z.object({
  packageNumber: z.number().int().min(1).max(999).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  discipline: z.string().trim().min(2).max(120).optional(),
  corHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  textHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  predecessorNumbers: z.array(z.number().int().min(1).max(999)).max(50).optional(),
  productivityPerDay: z.number().positive().max(100000).optional(),
  productivityUnit: z.string().trim().min(1).max(30).optional(),
  linkedEapStageCodes: z.array(z.string().trim().min(1).max(10)).max(30).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; packageId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const packageId = uuidParamSchema.parse(rawParams.packageId);
    const body = await request.json();
    const parsed = patchPackageSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const existing = await prisma.eapServicePackage.findFirst({
      where: { id: packageId, eapProjectId: eap.id },
      select: { id: true, packageNumber: true },
    });
    if (!existing) {
      return jsonNoStore({ ok: false, error: "Pacote de serviço não encontrado." }, 404);
    }

    const nextNumber = parsed.packageNumber ?? existing.packageNumber;
    const nextCor = parsed.corHex?.toUpperCase();
    const nextText =
      parsed.textHex?.toUpperCase() ?? (nextCor ? getContrastTextHex(nextCor) : undefined);

    const updated = await prisma.eapServicePackage.update({
      where: { id: existing.id },
      data: {
        ...(parsed.packageNumber !== undefined ? { packageNumber: parsed.packageNumber } : {}),
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.discipline !== undefined ? { discipline: parsed.discipline } : {}),
        ...(nextCor !== undefined ? { corHex: nextCor } : {}),
        ...(nextText !== undefined ? { textHex: nextText } : {}),
        ...(parsed.predecessorNumbers !== undefined
          ? {
              predecessorNumbers: Array.from(new Set(parsed.predecessorNumbers)).filter(
                (n) => n !== nextNumber
              ),
            }
          : {}),
        ...(parsed.productivityPerDay !== undefined
          ? { productivityPerDay: parsed.productivityPerDay }
          : {}),
        ...(parsed.productivityUnit !== undefined
          ? { productivityUnit: parsed.productivityUnit }
          : {}),
        ...(parsed.linkedEapStageCodes !== undefined
          ? { linkedEapStageCodes: Array.from(new Set(parsed.linkedEapStageCodes)) }
          : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
    });

    return jsonNoStore({ ok: true, package: updated });
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao atualizar pacote de serviço.",
      "Número de pacote já utilizado neste projeto."
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; packageId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const packageId = uuidParamSchema.parse(rawParams.packageId);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const existing = await prisma.eapServicePackage.findFirst({
      where: { id: packageId, eapProjectId: eap.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonNoStore({ ok: false, error: "Pacote de serviço não encontrado." }, 404);
    }

    await prisma.eapServicePackage.delete({ where: { id: existing.id } });

    return jsonNoStore({ ok: true, deletedId: existing.id });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao remover pacote de serviço.");
  }
}
