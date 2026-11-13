const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/server/auth.ts', 'utf8');
const oldStr = 'const COOKIE = "arqvertice_session";\nconst LIFETIME = 1000 * 60 * 60 * 24 * 7;';
const newStr = 'const COOKIE = "arqvertice_session";\n// Session cookie: expira ao fechar o navegador (sem maxAge/expires no cookie).\nconst SESSION_EXPIRES_MS = 1000 * 60 * 60 * 2; // 2 horas';
c = c.replace(oldStr, newStr);
fs.writeFileSync(root + '/src/server/auth.ts', c);
console.log('Done');
