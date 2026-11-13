const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/server/auth.ts', 'utf8');

// Remove maxAge from cookie options (session cookie - expires when browser closes)
// Try both CRLF and LF line endings
c = c.replace('    path: "/",\r\n    maxAge: LIFETIME / 1000,', '    path: "/",');
c = c.replace('    path: "/",\n    maxAge: LIFETIME / 1000,', '    path: "/",');

// Remove any remaining LIFETIME references
c = c.replace('maxAge: LIFETIME / 1000,', '');

fs.writeFileSync(root + '/src/server/auth.ts', c);
console.log('Done fix4');