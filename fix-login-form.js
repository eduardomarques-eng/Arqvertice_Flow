const fs = require('fs');
const root = 'C:\\Users\\eduar\\OneDrive\\Documentos\\ArqVertice_Flow\\Arqvertice_Flow';
let c = fs.readFileSync(root + '/src/components/auth/login-form.tsx', 'utf8');

// Add sessionStorage setItem after successful login
c = c.replace(
  '      const role = data?.user?.role;\n      if (role === "CLIENTE" || role === "CLIENT") {\n        router.push("/portal");\n      } else {\n        router.push("/admin");\n      }',
  '      sessionStorage.setItem("arqvertice_active_tab_session", "1");\n      const role = data?.user?.role;\n      if (role === "CLIENTE" || role === "CLIENT") {\n        router.push("/portal");\n      } else if (role === "ADMIN") {\n        router.push("/admin");\n      } else {\n        router.push("/equipe");\n      }'
);

fs.writeFileSync(root + '/src/components/auth/login-form.tsx', c);
console.log('Done login-form');