const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/app/equipe/page.tsx', 'utf8');

// Block ADMIN from accessing /equipe - requirePageTeamRole currently allows ADMIN
c = c.replace(
  'if (!isTeamRole(user.role) && user.role !== "ADMIN") redirect("/");',
  'if (!isTeamRole(user.role)) redirect("/");'
);

fs.writeFileSync(root + '/src/app/equipe/page.tsx', c);
console.log('Done equipe-page');