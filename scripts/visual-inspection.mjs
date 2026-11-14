import { chromium } from "playwright";

async function runInspection() {
  console.log("=== STARTING PLAYWRIGHT VISUAL INSPECTION ===");
  const browser = await chromium.launch({ headless: true });
  const baseUrl = "https://arqvertice-flow.vercel.app";
  const results = {
    wagner: {},
    eduardo: {},
    errors: [],
  };

  try {
    // -------------------------------------------------------------
    // 1. WAGNER SILVA INSPECTION
    // -------------------------------------------------------------
    console.log("\n--- [1] Testing Wagner Silva on Desktop (1440x900) ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await desktopContext.newPage();

    const consoleMessages = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleMessages.push(`PAGEERROR: ${err.message}`);
    });

    // Go to /
    console.log("Navigating to / ...");
    const homeRes = await page.goto(baseUrl, { waitUntil: "networkidle" });
    console.log(`Root status: ${homeRes?.status()}`);

    // Fill login
    console.log("Logging in as wagner.silva@arqvertice.com.br ...");
    await page.fill('input[type="email"]', "wagner.silva@arqvertice.com.br");
    await page.fill('input[type="password"]', "ArqVertice@2026");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForTimeout(2000);
    const afterLoginUrl = page.url();
    console.log(`URL after login: ${afterLoginUrl}`);

    // Check /equipe
    console.log("Testing /equipe ...");
    const equipeRes = await page.goto(`${baseUrl}/equipe`, { waitUntil: "networkidle" });
    const equipeStatus = equipeRes?.status();
    const equipeText = await page.evaluate(() => document.body.innerText);
    const hasForbidden = equipeText.includes('"error":"Forbidden"') || equipeText.includes("Forbidden");
    const isDarkBroken = await page.evaluate(() => {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      return bg === "rgb(0, 0, 0)" && !document.querySelector(".bg-slate-50, #f5f5f7, .bg-\\[\\#f5f5f7\\]");
    });
    const sidebarCount = await page.locator("nav a").count();

    console.log(`/equipe status: ${equipeStatus}, hasForbidden: ${hasForbidden}, nav links count: ${sidebarCount}`);
    results.wagner["/equipe"] = {
      status: equipeStatus,
      hasForbidden,
      sidebarCount,
      url: page.url(),
      consoleErrors: [...consoleMessages]
    };

    // Check /equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a
    console.log("Testing /equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a ...");
    consoleMessages.length = 0;
    const cronoRes = await page.goto(`${baseUrl}/equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a`, { waitUntil: "networkidle" });
    const cronoStatus = cronoRes?.status();
    const cronoText = await page.evaluate(() => document.body.innerText);
    const cronoHasCrash = cronoText.includes("Application error") || cronoText.includes("Internal Server Error") || cronoStatus === 500;
    console.log(`Cronograma status: ${cronoStatus}, crash: ${cronoHasCrash}, title: ${await page.title()}`);
    results.wagner["/equipe/cronograma/[id]"] = {
      status: cronoStatus,
      crash: cronoHasCrash,
      consoleErrors: [...consoleMessages]
    };

    // Check /equipe/projetos/2b2bdf4e-4e85-4762-b57d-ac0274c53bb5
    console.log("Testing /equipe/projetos/2b2bdf4e-4e85-4762-b57d-ac0274c53bb5 ...");
    consoleMessages.length = 0;
    const projRes = await page.goto(`${baseUrl}/equipe/projetos/2b2bdf4e-4e85-4762-b57d-ac0274c53bb5`, { waitUntil: "networkidle" });
    const projStatus = projRes?.status();
    const projText = await page.evaluate(() => document.body.innerText);
    const projHasCrash = projText.includes("Application error") || projText.includes("Internal Server Error") || projStatus === 500;
    console.log(`Projetos [id] status: ${projStatus}, crash: ${projHasCrash}`);
    results.wagner["/equipe/projetos/[id]"] = {
      status: projStatus,
      crash: projHasCrash,
      consoleErrors: [...consoleMessages]
    };

    // Check /equipe/acervo
    console.log("Testing /equipe/acervo ...");
    consoleMessages.length = 0;
    const acervoRes = await page.goto(`${baseUrl}/equipe/acervo`, { waitUntil: "networkidle" });
    const acervoStatus = acervoRes?.status();
    const acervoText = await page.evaluate(() => document.body.innerText);
    console.log(`/equipe/acervo status: ${acervoStatus}`);
    results.wagner["/equipe/acervo"] = {
      status: acervoStatus,
      contentSample: acervoText.slice(0, 200),
      consoleErrors: [...consoleMessages]
    };

    // -------------------------------------------------------------
    // Mobile Viewport (375x812) for Wagner Silva
    // -------------------------------------------------------------
    console.log("\n--- [2] Testing Wagner Silva on Mobile (375x812) ---");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${baseUrl}/equipe`, { waitUntil: "networkidle" });
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`Mobile /equipe overflowX: ${overflowX}`);
    results.wagner["mobile_overflow"] = overflowX;

    await desktopContext.close();

    // -------------------------------------------------------------
    // 2. EDUARDO MARQUES INSPECTION
    // -------------------------------------------------------------
    console.log("\n--- [3] Testing Eduardo Marques on Desktop (1440x900) ---");
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const adminPage = await adminContext.newPage();
    const adminConsoleErrors = [];
    adminPage.on("console", (msg) => {
      if (msg.type() === "error") adminConsoleErrors.push(msg.text());
    });
    adminPage.on("pageerror", (err) => {
      adminConsoleErrors.push(`PAGEERROR: ${err.message}`);
    });

    console.log("Navigating to / for Eduardo Marques ...");
    await adminPage.goto(baseUrl, { waitUntil: "networkidle" });
    await adminPage.fill('input[type="email"]', "eduardo.marques.arq@gmail.com");
    await adminPage.fill('input[type="password"]', "ArqVertice@2026");
    await Promise.all([
      adminPage.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      adminPage.click('button[type="submit"]'),
    ]);
    await adminPage.waitForTimeout(2000);
    console.log(`Admin URL after login: ${adminPage.url()}`);

    // Check /admin
    console.log("Testing /admin ...");
    const adminRes = await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
    const adminStatus = adminRes?.status();
    const adminText = await adminPage.evaluate(() => document.body.innerText);
    const isExecutiveDashboard = adminText.includes("Visão Executiva") || adminText.includes("Receita") || adminText.includes("Projetos Ativos") || adminText.includes("Operação");
    console.log(`/admin status: ${adminStatus}, isExecutive: ${isExecutiveDashboard}`);
    results.eduardo["/admin"] = {
      status: adminStatus,
      isExecutiveDashboard,
      url: adminPage.url()
    };

    // Check /admin/equipe
    console.log("Testing /admin/equipe ...");
    const equipeAdminRes = await adminPage.goto(`${baseUrl}/admin/equipe`, { waitUntil: "networkidle" });
    const equipeAdminStatus = equipeAdminRes?.status();
    const togglesCount = await adminPage.locator('button[role="switch"], input[type="checkbox"], button:has-text("Ativar"), button:has-text("Desativar"), [data-state]').count();
    console.log(`/admin/equipe status: ${equipeAdminStatus}, toggles count: ${togglesCount}`);
    results.eduardo["/admin/equipe"] = {
      status: equipeAdminStatus,
      togglesCount,
      url: adminPage.url()
    };

    await adminContext.close();

  } catch (err) {
    console.error("Inspection error:", err);
    results.errors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log("\n=== INSPECTION COMPLETED ===");
  console.log(JSON.stringify(results, null, 2));
}

runInspection();
