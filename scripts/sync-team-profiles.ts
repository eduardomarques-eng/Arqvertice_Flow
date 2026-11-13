import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

interface UserProfile {
  name: string;
  email: string;
  password: string;
  whatsapp: string;
  specialty: string;
  role: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE";
}

const OFFICIAL_PROFILES: UserProfile[] = [
  {
    name: "Eduardo Marques",
    email: "eduardo.marques.arq@gmail.com",
    password: "Edu@152013",
    whatsapp: "85 98590 2642",
    specialty: "Arquiteto Projetista",
    role: "ADMIN",
  },
  {
    name: "Luan Almeida",
    email: "luan.almeida@arqvertice.com.br",
    password: "LA@123456",
    whatsapp: "85 98668 2426",
    specialty: "Engenheiro Calculista",
    role: "ENGENHEIRO",
  },
  {
    name: "Erick Santiago",
    email: "erick.santiago@arqvertice.com.br",
    password: "ES@123456",
    whatsapp: "85 98902 1759",
    specialty: "Arquiteto de Obra",
    role: "ARQUITETO",
  },
  {
    name: "Claudio Marrocos",
    email: "claudiomarrocos2018@gmail.com",
    password: "CM@123456",
    whatsapp: "85 98643-2084",
    specialty: "Arquiteto Projetista",
    role: "ARQUITETO",
  },
  {
    name: "Wagner Silva",
    email: "wagner.silva@arqvertice.com.br",
    password: "WS@123456",
    whatsapp: "85 9866-4738",
    specialty: "Engenheiro Projetista",
    role: "ENGENHEIRO",
  },
];

async function main() {
  console.log("=== INICIANDO SINCRONIZAÇÃO E DEDUPLICAÇÃO DE EQUIPE ===");

  // 1. Atualizar etapas vinculadas a nomes antigos de Luan Almeida
  const updatedStages = await prisma.scheduleStage.updateMany({
    where: {
      OR: [
        { designer: { contains: "Emanoel Luan", mode: "insensitive" } },
        { designer: { contains: "Emanoel", mode: "insensitive" } },
      ],
    },
    data: {
      designer: "Luan Almeida",
    },
  });
  console.log(`[Etapas] ${updatedStages.count} etapa(s) migradas para "Luan Almeida".`);

  // 2. Remover ou unificar usuários duplicados antigos de Luan
  const oldLuanUsers = await prisma.user.findMany({
    where: {
      AND: [
        { email: { not: "luan.almeida@arqvertice.com.br" } },
        {
          OR: [
            { email: "luan@arqvertice.com" },
            { name: { contains: "Emanoel", mode: "insensitive" } },
          ],
        },
      ],
    },
  });

  for (const oldUser of oldLuanUsers) {
    console.log(`[Deduplicação] Removendo usuário legado: ${oldUser.name} (${oldUser.email})`);
    // Limpa dependências antes de excluir
    await prisma.session.deleteMany({ where: { userId: oldUser.id } });
    await prisma.projectAccess.deleteMany({ where: { userId: oldUser.id } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: oldUser.id } });
    await prisma.user.delete({ where: { id: oldUser.id } });
  }

  // 3. Upsert dos 5 perfis oficiais com senhas criptografadas
  const allProjects = await prisma.project.findMany({ select: { id: true } });

  for (const profile of OFFICIAL_PROFILES) {
    const passwordHash = await hash(profile.password, 12);

    const initialPermissions =
      profile.role === "ADMIN"
        ? ["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"]
        : profile.role === "ARQUITETO"
        ? ["dashboard", "cronograma", "projetos", "clientes"]
        : profile.role === "ENGENHEIRO"
        ? ["dashboard", "cronograma", "projetos"]
        : ["dashboard", "cronograma", "projetos"];

    const user = await prisma.user.upsert({
      where: { email: profile.email.toLowerCase().trim() },
      update: {
        name: profile.name,
        passwordHash,
        whatsapp: profile.whatsapp,
        phone: profile.whatsapp,
        specialty: profile.specialty,
        role: profile.role,
        permissions: initialPermissions,
        isActive: true,
      },
      create: {
        email: profile.email.toLowerCase().trim(),
        name: profile.name,
        passwordHash,
        whatsapp: profile.whatsapp,
        phone: profile.whatsapp,
        specialty: profile.specialty,
        role: profile.role,
        permissions: initialPermissions,
        isActive: true,
      },
    });

    console.log(`[Perfil Homologado] ${user.name} (${user.role}) - ${user.email} -> Permissões: ${initialPermissions.join(", ")}`);

    // Garante acesso a todos os projetos cadastrados
    for (const proj of allProjects) {
      await prisma.projectAccess.upsert({
        where: {
          projectId_userId: {
            projectId: proj.id,
            userId: user.id,
          },
        },
        update: {
          canEdit: true,
        },
        create: {
          userId: user.id,
          projectId: proj.id,
          canEdit: true,
        },
      });
    }
  }

  // 4. Verificação final
  const activeMembers = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      whatsapp: true,
      specialty: true,
    },
    orderBy: { name: "asc" },
  });

  console.log("\n=== PROFISSIONAIS ATIVOS NO NEON POSTGRES ===");
  console.table(activeMembers);
  console.log("Sincronização concluída com sucesso!");
}

main()
  .catch((err) => {
    console.error("Erro crítico na sincronização:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
