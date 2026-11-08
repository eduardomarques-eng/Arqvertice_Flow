import { chromium, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://arqvertice-flow.vercel.app';
const OUTPUT_DIR = path.join(process.cwd(), 'audit-results');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface AuditMetric {
  route: string;
  viewport: string;
  status: number;
  domContentLoadedTimeMs: number;
  hasHorizontalOverflow: boolean;
  consoleErrors: string[];
  failedRequests: string[];
}

async function executeFullAudit() {
  console.log(`\n======================================================`);
  console.log(`INICIANDO AUDITORIA E2E EM PRODUÇÃO: ${BASE_URL}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const metricsReport: AuditMetric[] = [];

  const targets = [
    { name: 'Healthcheck', path: '/api/health' },
    { name: 'Admin Dashboard', path: '/admin' },
    { name: 'Projetos Hub', path: '/admin/projetos' },
    { name: 'Operação / Kanban', path: '/operacao' },
    { name: 'Portal do Cliente', path: '/portal' },
  ];

  // 1. AUDITORIA DESKTOP (1920x1080 - Pro Display)
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ArqVerticeAudit/1.0',
  });
  const desktopPage = await desktopContext.newPage();

  for (const target of targets) {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    const onConsole = (msg: any) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    };
    const onRequestFailed = (req: any) => {
      failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    };

    desktopPage.on('console', onConsole);
    desktopPage.on('requestfailed', onRequestFailed);

    const start = Date.now();
    const response = await desktopPage.goto(`${BASE_URL}${target.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => null);
    await desktopPage.waitForTimeout(600);
    const duration = Date.now() - start;

    let hasOverflow = false;
    if (!target.path.startsWith('/api')) {
      try {
        hasOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      } catch (err) {
        await desktopPage.waitForTimeout(500);
        hasOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth).catch(() => false);
      }
    }

    metricsReport.push({
      route: target.path,
      viewport: 'Desktop (1920x1080)',
      status: response ? response.status() : 0,
      domContentLoadedTimeMs: duration,
      hasHorizontalOverflow: hasOverflow,
      consoleErrors,
      failedRequests,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit_summary.json'), JSON.stringify(metricsReport, null, 2));

    if (!target.path.startsWith('/api')) {
      const screenshotPath = path.join(OUTPUT_DIR, `${target.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_desktop.png`);
      await desktopPage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    }
    console.log(`[DESKTOP] ${target.name} | Status: ${response?.status()} | Tempo: ${duration}ms | Overflow: ${hasOverflow}`);

    desktopPage.off('console', onConsole);
    desktopPage.off('requestfailed', onRequestFailed);
  }

  // 2. AUDITORIA MOBILE (iPhone 14 Pro Max)
  const mobileContext = await browser.newContext({
    ...devices['iPhone 14 Pro Max'],
  });
  const mobilePage = await mobileContext.newPage();

  for (const target of targets.filter(t => !t.path.startsWith('/api'))) {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    const onConsole = (msg: any) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    };
    const onRequestFailed = (req: any) => {
      failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    };

    mobilePage.on('console', onConsole);
    mobilePage.on('requestfailed', onRequestFailed);

    const start = Date.now();
    const response = await mobilePage.goto(`${BASE_URL}${target.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => null);
    await mobilePage.waitForTimeout(600);
    const duration = Date.now() - start;

    let hasOverflow = false;
    try {
      hasOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    } catch (err) {
      await mobilePage.waitForTimeout(500);
      hasOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth).catch(() => false);
    }

    metricsReport.push({
      route: target.path,
      viewport: 'Mobile (iPhone 14 Pro Max)',
      status: response ? response.status() : 0,
      domContentLoadedTimeMs: duration,
      hasHorizontalOverflow: hasOverflow,
      consoleErrors,
      failedRequests,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit_summary.json'), JSON.stringify(metricsReport, null, 2));

    const screenshotPath = path.join(OUTPUT_DIR, `${target.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_mobile.png`);
    await mobilePage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    console.log(`[MOBILE] ${target.name} | Status: ${response?.status()} | Tempo: ${duration}ms | Overflow: ${hasOverflow}`);

    mobilePage.off('console', onConsole);
    mobilePage.off('requestfailed', onRequestFailed);
  }

  // 3. AUDITORIA PROFUNDA DO PROJETO PEDRO E SUBMENUS
  console.log(`\n--- Testando Navegação Interna da Residência de Praia ---`);
  await desktopPage.goto(`${BASE_URL}/admin/projetos`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => {
    console.log(`Aviso ao navegar para /admin/projetos: ${e.message}`);
    return null;
  });
  await desktopPage.waitForTimeout(1000);
  const pedroCard = desktopPage.locator('a[href*="/admin/projetos/"]').first();

  if (await pedroCard.count() > 0) {
    await pedroCard.click();
    await desktopPage.waitForLoadState('domcontentloaded').catch(() => {});
    await desktopPage.waitForTimeout(1000);
    const projectUrl = desktopPage.url();
    console.log(`Conectado à página interna: ${projectUrl}`);

    // Capturar aba ativa
    await desktopPage.screenshot({ path: path.join(OUTPUT_DIR, 'projeto_pedro_inicial.png'), fullPage: true }).catch(() => {});

    // Alternar para Acervo / Plantas Cadastradas se existir
    const acervoTab = desktopPage.getByText(/Plantas Cadastradas|Acervo|Pranchas/i).first();
    if (await acervoTab.count() > 0) {
      await acervoTab.click().catch(() => {});
      await desktopPage.waitForTimeout(600);
      await desktopPage.screenshot({ path: path.join(OUTPUT_DIR, 'projeto_pedro_acervo.png'), fullPage: true }).catch(() => {});
      console.log('Validado clique na aba de Acervo/Plantas.');
    }

    // Alternar para Cronograma se existir
    const cronogramaTab = desktopPage.getByText(/Cronograma|Etapas/i).first();
    if (await cronogramaTab.count() > 0) {
      await cronogramaTab.click().catch(() => {});
      await desktopPage.waitForTimeout(600);
      await desktopPage.screenshot({ path: path.join(OUTPUT_DIR, 'projeto_pedro_cronograma.png'), fullPage: true }).catch(() => {});
      console.log('Validado clique na aba de Cronograma.');
    }
  } else {
    console.log('Card de projeto Pedro não localizado ou rota exige autenticação prévia.');
  }

  await browser.close();

  fs.writeFileSync(path.join(OUTPUT_DIR, 'audit_summary.json'), JSON.stringify(metricsReport, null, 2));
  console.log(`\nAuditoria concluída. Relatório consolidado em: audit-results/audit_summary.json`);
}

executeFullAudit().catch(err => {
  console.error('Falha na auditoria Playwright:', err);
  process.exit(1);
});
