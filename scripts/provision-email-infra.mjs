#!/usr/bin/env node
/**
 * Idempotent provisioning script for ArqVértice Flow Email Infrastructure:
 * - Cloudflare Zones API (locate zone_id)
 * - Resend Domains API (register domain & obtain DKIM / SPF / MX records)
 * - Cloudflare DNS Records API (upsert MX, SPF, DKIM, DMARC without duplicates)
 * - Cloudflare Email Routing API (enable routing & configure mailbox rules)
 *
 * Reads credentials exclusively from process.env / .env.local / .env.
 * Never writes secrets to Git-tracked files.
 */

import fs from "node:fs";
import path from "node:path";

function loadLocalEnvFiles() {
  const rootDir = process.cwd();
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(rootDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key] && val) {
        process.env[key] = val;
      }
    }
  }
}

loadLocalEnvFiles();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const CLOUDFLARE_API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CF_TOKEN?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const PRIMARY_DOMAIN = (process.env.EMAIL_PRIMARY_DOMAIN || "arqvertice.com.br")
  .trim()
  .toLowerCase();
const GMAIL_MIRROR = (
  process.env.EMAIL_GMAIL_MIRROR || "eduardo.marques.arq@gmail.com"
)
  .trim()
  .toLowerCase();

const MAILBOX_PREFIXES = ["eduardo", "contato", "projetos", "financeiro"];

async function cfFetch(endpoint, options = {}) {
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg =
      data?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ||
      `HTTP ${res.status}`;
    throw new Error(`Cloudflare API error (${endpoint}): ${msg}`);
  }
  return data;
}

async function resendFetch(endpoint, options = {}) {
  const url = `https://api.resend.com${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Resend API error (${endpoint}): ${data?.message || data?.name || `HTTP ${res.status}`}`
    );
  }
  return data;
}

function normalizeDnsName(name, domain) {
  if (!name || name === "@") return domain;
  const clean = name.replace(/\.$/, "").toLowerCase();
  if (clean === domain || clean.endsWith(`.${domain}`)) return clean;
  return `${clean}.${domain}`;
}

async function upsertDnsRecord(zoneId, existingRecords, desired) {
  const targetName = normalizeDnsName(desired.name, PRIMARY_DOMAIN);
  const type = desired.type.toUpperCase();
  const content = String(desired.content).replace(/\.$/, "");

  const match = existingRecords.find((r) => {
    if (r.type !== type || r.name.toLowerCase() !== targetName) return false;
    if (type === "TXT" && desired.matchPrefix) {
      return r.content.startsWith(desired.matchPrefix);
    }
    if (type === "MX") {
      return (
        r.content.replace(/\.$/, "").toLowerCase() === content.toLowerCase()
      );
    }
    return true;
  });

  const payload = {
    type,
    name: targetName,
    content,
    ttl: desired.ttl || 3600,
    proxied: false,
    ...(desired.priority !== undefined ? { priority: Number(desired.priority) } : {}),
  };

  if (match) {
    const sameContent =
      match.content.replace(/\.$/, "") === content &&
      (desired.priority === undefined ||
        Number(match.priority) === Number(desired.priority));
    if (sameContent) {
      return { action: "unchanged", type, name: targetName, id: match.id };
    }
    const updated = await cfFetch(`/zones/${zoneId}/dns_records/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return { action: "updated", type, name: targetName, id: updated.result?.id };
  }

  const created = await cfFetch(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { action: "created", type, name: targetName, id: created.result?.id };
}

async function main() {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !RESEND_API_KEY) {
    console.error(
      "Missing required environment variables: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, RESEND_API_KEY."
    );
    process.exit(1);
  }

  const summary = {
    domain: PRIMARY_DOMAIN,
    zoneId: null,
    resendDomainId: null,
    resendStatus: null,
    dnsActions: [],
    emailRouting: { enabled: false, rules: [], warnings: [] },
  };

  // 1. Locate Cloudflare Zone
  const zonesRes = await cfFetch(
    `/zones?name=${encodeURIComponent(PRIMARY_DOMAIN)}&account.id=${encodeURIComponent(CLOUDFLARE_ACCOUNT_ID)}`
  );
  const zone = zonesRes.result?.[0];
  if (!zone) {
    throw new Error(
      `Zone '${PRIMARY_DOMAIN}' not found in Cloudflare account.`
    );
  }
  summary.zoneId = zone.id;

  // 2. Register or fetch domain in Resend
  const listDomains = await resendFetch("/domains");
  let resendDomain = (listDomains.data || []).find(
    (d) => d.name?.toLowerCase() === PRIMARY_DOMAIN
  );
  if (!resendDomain) {
    resendDomain = await resendFetch("/domains", {
      method: "POST",
      body: JSON.stringify({ name: PRIMARY_DOMAIN, region: "sa-east-1" }),
    });
  } else {
    resendDomain = await resendFetch(`/domains/${resendDomain.id}`);
  }
  summary.resendDomainId = resendDomain.id;
  summary.resendStatus = resendDomain.status;

  // 3. Upsert DNS records in Cloudflare
  const existingDnsRes = await cfFetch(
    `/zones/${zone.id}/dns_records?per_page=200`
  );
  const existingRecords = existingDnsRes.result || [];

  for (const rec of resendDomain.records || []) {
    const isSpf =
      rec.type?.toUpperCase() === "TXT" &&
      String(rec.value || "").includes("v=spf1");
    const action = await upsertDnsRecord(zone.id, existingRecords, {
      type: rec.type,
      name: rec.name,
      content: rec.value,
      priority: rec.priority,
      matchPrefix: isSpf ? "v=spf1" : undefined,
    });
    summary.dnsActions.push(action);
  }

  // Ensure DMARC TXT record
  const dmarcAction = await upsertDnsRecord(zone.id, existingRecords, {
    type: "TXT",
    name: `_dmarc.${PRIMARY_DOMAIN}`,
    content: `v=DMARC1; p=quarantine; rua=mailto:contato@${PRIMARY_DOMAIN}; fo=1`,
    matchPrefix: "v=DMARC1",
  });
  summary.dnsActions.push(dmarcAction);

  // Trigger Resend verification
  try {
    await resendFetch(`/domains/${resendDomain.id}/verify`, { method: "POST" });
  } catch (err) {
    summary.emailRouting.warnings.push(
      `Resend verify trigger note: ${err.message}`
    );
  }

  // 4. Enable Cloudflare Email Routing & configure mailbox rules
  try {
    await cfFetch(`/zones/${zone.id}/email/routing/enable`, { method: "POST" });
    summary.emailRouting.enabled = true;
  } catch (err) {
    summary.emailRouting.warnings.push(`Enable routing: ${err.message}`);
  }

  // Register destination address if missing
  try {
    const addrRes = await cfFetch(
      `/accounts/${CLOUDFLARE_ACCOUNT_ID}/email/routing/addresses?per_page=100`
    );
    const hasMirror = (addrRes.result || []).some(
      (a) => a.email?.toLowerCase() === GMAIL_MIRROR
    );
    if (!hasMirror) {
      await cfFetch(
        `/accounts/${CLOUDFLARE_ACCOUNT_ID}/email/routing/addresses`,
        {
          method: "POST",
          body: JSON.stringify({ email: GMAIL_MIRROR }),
        }
      );
      summary.emailRouting.warnings.push(
        `Verification email sent by Cloudflare to ${GMAIL_MIRROR}.`
      );
    }
  } catch (err) {
    summary.emailRouting.warnings.push(`Destination address: ${err.message}`);
  }

  // Upsert routing rules for eduardo@, contato@, projetos@, financeiro@
  try {
    const rulesRes = await cfFetch(
      `/zones/${zone.id}/email/routing/rules?per_page=100`
    );
    const existingRules = rulesRes.result || [];

    for (const prefix of MAILBOX_PREFIXES) {
      const address = `${prefix}@${PRIMARY_DOMAIN}`;
      const existing = existingRules.find((r) =>
        (r.matchers || []).some(
          (m) => m.field === "to" && m.value?.toLowerCase() === address
        )
      );
      const rulePayload = {
        name: `ArqVertice ${prefix}@`,
        enabled: true,
        matchers: [{ type: "literal", field: "to", value: address }],
        actions: [{ type: "forward", value: [GMAIL_MIRROR] }],
      };

      if (existing) {
        summary.emailRouting.rules.push({
          address,
          action: "exists",
          id: existing.id,
        });
      } else {
        const createdRule = await cfFetch(
          `/zones/${zone.id}/email/routing/rules`,
          {
            method: "POST",
            body: JSON.stringify(rulePayload),
          }
        );
        summary.emailRouting.rules.push({
          address,
          action: "created",
          id: createdRule.result?.id,
        });
      }
    }
  } catch (err) {
    summary.emailRouting.warnings.push(`Routing rules: ${err.message}`);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Provisioning failed:", err.message);
  process.exit(1);
});
