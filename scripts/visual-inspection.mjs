import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function runInspection() {
  console.log("=== STARTING FINAL PLAYWRIGHT VISUAL INSPECTION ===");
  const browser = await chromium.launch({ headless: true });
  const baseUrl = "https://arqvertice-flow.vercel.app";

  const screenshotsDir = path.join(process.cwd(), "screenshots-final");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const results = {
    wagner: {},
    eduardo: {},
    errors: [],
  };

  try {
    // -------------------------------------------------------------
    // 1. WAGNER SILVA INSPECTION (DESKTOP 1440x900)
    // -------------------------------------------------------------
    console.log("\n--- [1] Testing Wagner Silva on Desktop (1440x900) ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    });
    const page = await desktopContext.newPage();

    let pageErrors = [];
    page.on("pageerror", (err) => {
      console.log(`PAGEERROR: ${err.message}`);
      pageErrors.push(err.message);
    });

    console.log("Navigating to / ...");
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    console.log("Logging in as wagner.silva@arqvertice.com.br ...");
    await page.fill('input[type="email"]', "wagner.silva@arqvertice.com.br");
    await page.fill('input[type="password"]', "ArqVertice@2026");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(2000);
    console.log(`URL after login: ${page.url()}`);

    // /equipe
    console.log("Validating /equipe ...");
    pageErrors = [];
    const equipeRes = await page.goto(`${baseUrl}/equipe`, { waitUntil: "networkidle" });
    const equipeText = await page.evaluate(() => document.body.innerText);
    const hasForbidden = equipeText.includes('"error":"Forbidden"') || equipeText.includes("Forbidden: Origem");
    const sidebarCount = await page.locator("aside nav a, header nav a").count();
    await page.screenshot({ path: path.join(screenshotsDir, "wagner-equipe-desktop.png") });

    results.wagner["/equipe"] = {
      status: equipeRes?.status(),
      hasForbidden,
      sidebarCount,
      pageErrors: [...pageErrors]
    };
    console.log(`/equipe: status=${equipeRes?.status()}, forbidden=${hasForbidden}, sidebarLinks=${sidebarCount}`);

    // /equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a
    console.log("Validating /equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a ...");
    pageErrors = [];
    const cronoRes = await page.goto(`${baseUrl}/equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const cronoText = await page.evaluate(() => document.body.innerText);
    const cronoCrash = cronoText.includes("Application error") || cronoText.includes("Internal Server Error") || pageErrors.length > 0;
    const kanbanColumns = await page.locator("section h2").allInnerTexts();
    await page.screenshot({ path: path.join(screenshotsDir, "wagner-kanban-desktop.png") });

    results.wagner["/equipe/cronograma/[id]"] = {
      status: cronoRes?.status(),
      crash: cronoCrash,
      kanbanColumns,
      pageErrors: [...pageErrors]
    };
    console.log(`/equipe/cronograma/[id]: status=${cronoRes?.status()}, crash=${cronoCrash}, columns=${kanbanColumns.join(", ")}`);

    // /equipe/projetos/2b2bdf4e-4e85-4762-b57d-ac0274c53bb5
    console.log("Validating /equipe/projetos/2b2bdf4e-4e85-4762-b57d-ac0274c53bb5 ...");
    pageErrors = [];
    const projRes = await page.goto(`${baseUrl}/equipe/projetos/2b2bdf4e-4e85-4762-b57d-ac0274c53bb5`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const projText = await page.evaluate(() => document.body.innerText);
    const projCrash = projText.includes("Application error") || projText.includes("Internal Server Error") || pageErrors.length > 0;
    const projectTitle = await page.locator("h1, h2, span.truncate").first().innerText().catch(() => "");
    await page.screenshot({ path: path.join(screenshotsDir, "wagner-ficha-tecnica-desktop.png") });

    results.wagner["/equipe/projetos/[id]"] = {
      status: projRes?.status(),
      crash: projCrash,
      projectTitle,
      pageErrors: [...pageErrors]
    };
    console.log(`/equipe/projetos/[id]: status=${projRes?.status()}, crash=${projCrash}, title=${projectTitle}`);

    // /equipe/acervo
    console.log("Validating /equipe/acervo ...");
    pageErrors = [];
    const acervoRes = await page.goto(`${baseUrl}/equipe/acervo`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const acervoText = await page.evaluate(() => document.body.innerText);
    const acervoHasHeading = acervoText.includes("Acervo") || acervoText.includes("Plantas") || acervoText.includes("Disciplinas");
    await page.screenshot({ path: path.join(screenshotsDir, "wagner-acervo-desktop.png") });

    results.wagner["/equipe/acervo"] = {
      status: acervoRes?.status(),
      hasHeading: acervoHasHeading,
      pageErrors: [...pageErrors]
    };
    console.log(`/equipe/acervo: status=${acervoRes?.status()}, hasHeading=${acervoHasHeading}`);

    // -------------------------------------------------------------
    // WAGNER SILVA MOBILE (375x812)
    // -------------------------------------------------------------
    console.log("\n--- [2] Testing Wagner Silva on Mobile (375x812) ---");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${baseUrl}/equipe`, { waitUntil: "networkidle" });
    const overflowEquipe = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await page.screenshot({ path: path.join(screenshotsDir, "wagner-equipe-mobile.png") });

    await page.goto(`${baseUrl}/equipe/cronograma/8ed368d6-e601-4c67-98f3-db6bed920e0a`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const overflowKanban = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await page.screenshot({ path: path.join(screenshotsDir, "wagner-kanban-mobile.png") });

    results.wagner["mobile"] = {
      overflowEquipe,
      overflowKanban
    };
    console.log(`Mobile: overflowEquipe=${overflowEquipe}, overflowKanban=${overflowKanban}`);

    await desktopContext.close();

    // -------------------------------------------------------------
    // 2. EDUARDO MARQUES (ADMIN) INSPECTION (1440x900)
    // -------------------------------------------------------------
    console.log("\n--- [3] Testing Eduardo Marques on Desktop (1440x900) ---");
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const adminPage = await adminContext.newPage();
    let adminErrors = [];
    adminPage.on("pageerror", (err) => {
      console.log(`ADMIN PAGEERROR: ${err.message}`);
      adminErrors.push(err.message);
    });

    await adminPage.goto(baseUrl, { waitUntil: "networkidle" });
    await adminPage.fill('input[type="email"]', "eduardo.marques.arq@gmail.com");
    await adminPage.fill('input[type="password"]', "ArqVertice@2026");
    await Promise.all([
      adminPage.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      adminPage.click('button[type="submit"]'),
    ]);
    await adminPage.waitForTimeout(2000);
    console.log(`Admin URL after login: ${adminPage.url()}`);

    // /admin
    console.log("Validating /admin ...");
    adminErrors = [];
    const adminRes = await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
    const adminText = await adminPage.evaluate(() => document.body.innerText);
    const isExecutive = adminText.includes("Visão Geral") || adminText.includes("Receita") || adminText.includes("Projetos") || adminText.includes("Painel");
    await adminPage.screenshot({ path: path.join(screenshotsDir, "eduardo-admin-desktop.png") });

    results.eduardo["/admin"] = {
      status: adminRes?.status(),
      isExecutive,
      adminErrors: [...adminErrors]
    };
    console.log(`/admin: status=${adminRes?.status()}, isExecutive=${isExecutive}`);

    // /admin/equipe
    console.log("Validating /admin/equipe & module toggles ...");
    adminErrors = [];
    const equipeAdminRes = await adminPage.goto(`${baseUrl}/admin/equipe`, { waitUntil: "networkidle" });
    await adminPage.waitForTimeout(1500);

    // Click "Editar" on first team member to open permission toggles
    const editButton = adminPage.locator('button:has-text("Editar"), button:has-text("Editar Colaborador")').first();
    const hasEditButton = await editButton.isVisible();
    let permissionCheckboxesCount = 0;
    if (hasEditButton) {
      await editButton.click();
      await adminPage.waitForTimeout(1000);
      permissionCheckboxesCount = await adminPage.locator('input[type="checkbox"]').count();
      console.log(`Permission checkboxes in modal: ${permissionCheckboxesCount}`);
    }
    await adminPage.screenshot({ path: path.join(screenshotsDir, "eduardo-admin-equipe-toggles.png") });

    results.eduardo["/admin/equipe"] = {
      status: equipeAdminRes?.status(),
      hasEditButton,
      permissionCheckboxesCount,
      adminErrors: [...adminErrors]
    };
    console.log(`/admin/equipe: status=${equipeAdminRes?.status()}, editBtn=${hasEditButton}, toggles=${permissionCheckboxesCount}`);

    await adminContext.close();

  } catch (err) {
    console.error("Inspection error:", err);
    results.errors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log("\n=== FINAL INSPECTION COMPLETED ===");
  console.log(JSON.stringify(results, null, 2));
}

runInspection();
