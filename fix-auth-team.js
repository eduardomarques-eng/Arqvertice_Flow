const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/server/auth.ts', 'utf8');

// Block ADMIN from /equipe - requirePageTeamRole should only allow team roles
c = c.replace(
  'if (!isTeamRole(user.role) && user.role !== "ADMIN") redirect("/");',
  'if (!isTeamRole(user.role)) redirect("/");'
);

fs.writeFileSync(root + '/src/server/auth.ts', c);
console.log('Done auth-team');