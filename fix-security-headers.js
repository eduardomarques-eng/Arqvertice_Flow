const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/lib/security-headers.ts', 'utf8');

// Add /equipe to PROTECTED_ROUTE_PREFIXES
c = c.replace(
  'export const PROTECTED_ROUTE_PREFIXES = [\n  "/admin",',
  'export const PROTECTED_ROUTE_PREFIXES = [\n  "/admin",\n  "/equipe",'
);

fs.writeFileSync(root + '/src/lib/security-headers.ts', c);
console.log('Done security-headers');