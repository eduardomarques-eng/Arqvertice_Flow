async function main() {
  const base = "http://localhost:3005";
  console.log("Logging in as Wagner...");
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "wagner.silva@arqvertice.com.br",
      password: "ArqVertice@2026",
    }),
  });

  console.log("Login status:", loginRes.status);
  const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")];
  const cookieHeader = setCookies.map(c => c.split(";")[0]).join("; ");
  console.log("Cookie header:", cookieHeader);

  async function test(path) {
    console.log(`\nTesting GET ${path}...`);
    const res = await fetch(`${base}${path}`, {
      headers: {
        Cookie: cookieHeader,
      },
    });
    console.log(`Status for ${path}:`, res.status);
    const html = await res.text();
    console.log(`Body length: ${html.length}`);
    if (res.status >= 400 || html.includes("error") || html.includes("Error")) {
      console.log("Sample body:", html.slice(0, 1000));
    }
  }

  await test("/equipe");
  await test("/equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a");
  await test("/equipe/projetos/2b2bdf4e-4e85-4762-b57d-ac0274c53bb5");
}

main().catch(console.error);
