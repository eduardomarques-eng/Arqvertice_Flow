const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/app/admin/page.tsx', 'utf8');

// Replace manual role check with requirePageAdminRole() which redirects non-ADMIN to /equipe or /portal
c = c.replace(
  'import { currentUser } from "@/server/auth";',
  'import { requirePageAdminRole } from "@/server/auth";'
);

// Replace the currentUser() + role check block with requirePageAdminRole()
c = c.replace(
  'export default async function AdminDashboardPage() {\n  const user = await currentUser();\n  if (!user) redirect("/");\n\n  // Se cliente, redirecionar para o portal\n  if (user.role === "CLIENTE" || (user.role as string) === "CLIENT") {\n    redirect("/portal");\n  }',
  'export default async function AdminDashboardPage() {\n  const user = await requirePageAdminRole();'
);

fs.writeFileSync(root + '/src/app/admin/page.tsx', c);
console.log('Done admin-page');