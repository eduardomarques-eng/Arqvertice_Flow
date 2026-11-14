import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { DomainError } from "./errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { canOperateSchedule } from "@/lib/schedule-roles";
import { logUserTrafficEvent } from "./traffic-log";

export type AuthRole = "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR" | "OPERATOR" | "CLIENT";
const COOKIE = "arqvertice_session";
// Cookie de papel (somente leitura na borda/middleware): isolamento de rota
// antecipado (/admin vs /equipe vs /portal) sem consulta ao banco.
const ROLE_COOKIE = "arqvertice_role";
// Session cookie: expira ao fechar o navegador (sem maxAge/expires no cookie).
const SESSION_EXPIRES_MS = 1000 * 60 * 60 * 2; // 2 horas

export { hashPassword, verifyPassword };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function signIn(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new DomainError("E-mail ou senha inválidos.", "VALIDATION");
  }

  if (!user.isActive) {
    await logUserTrafficEvent({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      eventType: "FORCED_LOGOUT",
      deviceInfo: "Tentativa de login com conta inativa",
    });
    throw new DomainError("Esta conta foi desativada pelo Administrador.", "INTEGRITY");
  }

  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId: user.id,
      sessionVersion: user.sessionVersion,
      expiresAt: new Date(Date.now() + SESSION_EXPIRES_MS),
    },
  });

  // Registra Log de Entrada (LOGIN)
  await logUserTrafficEvent({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    eventType: "LOGIN",
  });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  // Cookie de papel para isolamento antecipado de rotas na borda (middleware).
  (await cookies()).set(ROLE_COOKIE, user.role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  const effectivePerms = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : (user.role === "ADMIN" ? ["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"] : ["dashboard", "cronograma", "projetos"]);
  (await cookies()).set("arqvertice_permissions", JSON.stringify(effectivePerms), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return { id: user.id, name: user.name, role: user.role };
}

export async function signOut(reason?: string) {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });
    if (session) {
      const eventType = reason === "FORCED_LOGOUT" ? "FORCED_LOGOUT" : "LOGOUT";
      await logUserTrafficEvent({
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        userRole: session.user.role,
        eventType,
      });
      await prisma.session.delete({ where: { id: session.id } });
    }
  }
  store.delete(COOKIE);
  store.delete(ROLE_COOKIE);
  store.delete("arqvertice_permissions");
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });

  if (!session) return null;

  // 1. Sessão expirada
  if (session.expiresAt <= new Date()) {
    await logUserTrafficEvent({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      userRole: session.user.role,
      eventType: "SESSION_EXPIRED",
    });
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // 2. Conta desativada pelo Admin -> FORCED_LOGOUT imediato
  if (!session.user.isActive) {
    await logUserTrafficEvent({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      userRole: session.user.role,
      eventType: "FORCED_LOGOUT",
      deviceInfo: "Conta desativada pelo Administrador",
    });
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // 3. Permissões, senha ou cargo alterados pelo Admin -> FORCED_LOGOUT imediato
  if (session.sessionVersion !== session.user.sessionVersion) {
    await logUserTrafficEvent({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      userRole: session.user.role,
      eventType: "FORCED_LOGOUT",
      deviceInfo: "Permissões ou credenciais atualizadas pelo Administrador",
    });
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Heartbeat de Presença (atualiza a cada 30 segundos)
  const now = new Date();
  if (!session.user.lastSeenAt || now.getTime() - session.user.lastSeenAt.getTime() > 30000) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: now },
    }).catch(() => null);
  }

  return session.user;
}

export async function requireRole(role: AuthRole) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role !== role) throw new DomainError("Você não tem permissão para esta ação.", "INTEGRITY");
  return user;
}

export function isTeamRole(role: string): role is "EQUIPE" | "OPERADOR" | "ARQUITETO" | "ENGENHEIRO" {
  return role === "EQUIPE" || role === "OPERADOR" || role === "ARQUITETO" || role === "ENGENHEIRO";
}

export function isTechnicalRole(role: string): role is "ADMIN" | "ARQUITETO" | "ENGENHEIRO" {
  return role === "ADMIN" || role === "ARQUITETO" || role === "ENGENHEIRO";
}

export function isClientRole(role: string): role is "CLIENTE" | "CLIENT" {
  return role === "CLIENTE" || role === "CLIENT";
}

export async function requirePageRole(role: AuthRole) {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== role) redirect("/");
  return user;
}

/**
 * Página do funcionário da equipa: aceita ADMIN (dono) ou OPERADOR. Usada nas
 * telas de operação do cronograma. O OPERADOR continua limitado aos projetos
 * atribuídos — essa parte é provada em `requireProjectAccess`, não aqui.
 */
export async function requirePageScheduleRole() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!canOperateSchedule(user.role)) redirect("/");
  return user;
}

/**
 * Escrita de cronograma (mover/editar etapa). Substitui o `requireRole("ADMIN")`
 * nas ações de etapa: o funcionário da equipa também pode operar, mas nunca
 * alguém sem sessão ou com papel de cliente.
 */
export async function requireScheduleRole() {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (!canOperateSchedule(user.role)) throw new DomainError("Você não tem permissão para esta ação.", "INTEGRITY");
  return user;
}

export async function requireProjectAccess(projectId: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role === "ADMIN") return user;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { clientId: user.clientId ?? "__none__" },
        { access: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });
  if (!project) throw new DomainError("Projeto não encontrado.", "NOT_FOUND");
  return user;
}

export async function requirePageClientPortal() {
  const user = await currentUser();
  if (!user) redirect("/?next=%2Fportal");
  if (!isClientRole(user.role) && user.role !== "ADMIN") redirect("/");
  return user;
}

export async function requirePageTeamRole() {
  const user = await currentUser();
  if (!user) redirect("/?next=%2Fequipe");
  if (!isTeamRole(user.role)) redirect("/");
  return user;
}

/**
 * Área administrativa: apenas o papel ADMIN entra. Usada em todas as rotas
 * de /admin (financeiro, propostas, contratos, configurações, gestão de
 * usuários). EQUIPE e CLIENTE são redirecionados para os seus portais.
 */
export async function requirePageAdminRole() {
  const user = await currentUser();
  if (!user) redirect("/?next=/admin");
  if (user.role !== "ADMIN") {
    const target = isTeamRole(user.role) ? "/equipe" : "/portal";
    redirect(target);
  }
  return user;
}

export async function requirePageProjectAccess(projectId: string) {
  const user = await currentUser();
  if (!user) redirect(`/?next=/portal/${encodeURIComponent(projectId)}`);
  try {
    return await requireProjectAccess(projectId);
  } catch (error) {
    // Um cliente que peça o projeto de outro tem de receber uma resposta
    // INDISTINGUÍVEL da de um projeto que não existe. Deixar o DomainError
    // escapar produzia uma página de erro 500 — que confirma ao atacante que
    // o recurso existe e difere do 404 real.
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

/**
 * Tópico 35 — autorização de proposta derivada do BANCO, nunca do identificador
 * enviado pelo frontend.
 *
 * O `proposalId` chega da requisição e por si só não prova nada: a função
 * percorre `Proposal → Project → Client` e só então compara com o usuário
 * autenticado. Se o ID não pertence ao cliente, a resposta é idêntica à de um
 * recurso inexistente, para não revelar a existência de dados de terceiros.
 */
export async function requireProposalAccess(proposalId: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role === "ADMIN") return user;
  // OPERADOR não acede a propostas: o seu papel é operar o cronograma, não o
  // fluxo comercial. Um operador com ProjectAccess nunca herda acesso comercial
  // por essa via — o menor privilégio é prova no servidor, não por omissão.
  if (user.role === "OPERADOR") throw new DomainError("Proposta não encontrada.", "NOT_FOUND");
  const proposal = await prisma.proposal.findFirst({
    where: {
      id: proposalId,
      project: {
        OR: [
          { clientId: user.clientId ?? "__none__" },
          { access: { some: { userId: user.id } } },
        ],
      },
    },
    select: { id: true },
  });
  if (!proposal) throw new DomainError("Proposta não encontrada.", "NOT_FOUND");
  return user;
}

/**
 * Tópico 35 — mesma garantia para o contrato. O contrato nunca é diretamente
 * acessível ao cliente pelo ID: ele é alcançado pela proposta aprovada que o
 * originou, o que mantém a cadeia cliente → projeto → proposta → contrato.
 */
export async function requireContractAccess(contractId: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role === "ADMIN") return user;
  // OPERADOR não acede a contratos — mesmo motivo das propostas: só cronograma.
  if (user.role === "OPERADOR") throw new DomainError("Contrato não encontrado.", "NOT_FOUND");
  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      proposal: {
        project: {
          OR: [
            { clientId: user.clientId ?? "__none__" },
            { access: { some: { userId: user.id } } },
          ],
        },
      },
    },
    select: { id: true },
  });
  if (!contract) throw new DomainError("Contrato não encontrado.", "NOT_FOUND");
  return user;
}




