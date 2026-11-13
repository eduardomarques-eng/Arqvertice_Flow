const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/server/services/dashboard-service.ts', 'utf8');

// Fix 1: dashboardMetrics - replace requireRole("ADMIN") with module permission check
c = c.replace(
  'export async function dashboardMetrics(): Promise<DashboardMetrics> {\n  await requireRole("ADMIN");',
  'export async function dashboardMetrics(): Promise<DashboardMetrics> {\n  const user = await currentUser();\n  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");\n  const effectivePermissions = getEffectivePermissions({\n    role: user.role,\n    permissions: user.permissions,\n  });\n  if (!effectivePermissions.includes("dashboard")) {\n    throw new DomainError("Você não tem permissão para acessar o dashboard.", "NOT_FOUND");\n  }'
);

// Fix 2: projectSnapshots - replace requireRole("ADMIN") with module permission check
c = c.replace(
  'export async function projectSnapshots(limit = 6): Promise<ProjectSnapshot[]> {\n  await requireRole("ADMIN");',
  'export async function projectSnapshots(limit = 6): Promise<ProjectSnapshot[]> {\n  const user = await currentUser();\n  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");\n  const effectivePermissions = getEffectivePermissions({\n    role: user.role,\n    permissions: user.permissions,\n  });\n  if (!effectivePermissions.includes("dashboard") && !effectivePermissions.includes("projetos")) {\n    throw new DomainError("Você não tem permissão para acessar os projetos.", "NOT_FOUND");\n  }'
);

fs.writeFileSync(root + '/src/server/services/dashboard-service.ts', c);
console.log('Done dashboard-service');