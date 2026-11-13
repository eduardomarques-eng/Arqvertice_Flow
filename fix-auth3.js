const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/server/auth.ts', 'utf8');

// 1. Replace expiresAt in session creation: 7 days -> 2 hours
c = c.replace('expiresAt: new Date(Date.now() + LIFETIME)', 'expiresAt: new Date(Date.now() + SESSION_EXPIRES_MS)');

// 2. Remove maxAge from cookie options (session cookie - expires when browser closes)
c = c.replace('    path: "/",\n    maxAge: LIFETIME / 1000,', '    path: "/",');

// 3. Change sameSite from "lax" to "strict"
c = c.replace('sameSite: "lax"', 'sameSite: "strict"');

fs.writeFileSync(root + '/src/server/auth.ts', c);
console.log('Done fix3');