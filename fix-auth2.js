const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/server/auth.ts', 'utf8');
// Replace literal \\n (backslash-n) with actual newlines in the COOKIE/SESSION_EXPIRES block
c = c.replace('const COOKIE = "arqvertice_session";\\n// Session cookie: expira ao fechar o navegador (sem maxAge/expires no cookie).\\nconst SESSION_EXPIRES_MS = 1000 * 60 * 60 *\n 2; // 2 horas', 'const COOKIE = "arqvertice_session";\n// Session cookie: expira ao fechar o navegador (sem maxAge/expires no cookie).\nconst SESSION_EXPIRES_MS = 1000 * 60 * 60 * 2; // 2 horas');
fs.writeFileSync(root + '/src/server/auth.ts', c);
console.log('Done fix2');