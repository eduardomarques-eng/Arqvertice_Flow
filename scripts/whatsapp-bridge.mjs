#!/usr/bin/env node

/**
 * ArqVértice Flow — WhatsApp Bridge Local
 * Executa Baileys fora do Next.js bundle para não conflitar com Server Components.
 * 
 * Suporta:
 * 1. Modo CLI direto:
 *    node scripts/whatsapp-bridge.mjs --to 5585985902642 --msg "Texto de teste"
 * 2. Modo Servidor HTTP Local (porta 3001 por padrão):
 *    node scripts/whatsapp-bridge.mjs
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.WHATSAPP_BRIDGE_PORT || "3001", 10);
const BRIDGE_SECRET = process.env.WHATSAPP_BRIDGE_SECRET || "arqvertice-bridge-secret";
const SESSION_DIR = path.resolve(process.cwd(), ".whatsapp-session");

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

let sock = null;
let isConnected = false;
let userPhone = null;
let userName = null;

function sanitizePhone(rawPhone) {
  if (!rawPhone) return "";
  let digits = String(rawPhone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11 && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits;
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n=======================================================");
      console.log("📲 ESCANEIE O QR CODE DO WHATSAPP COM SEU SMARTPHONE:");
      console.log("=======================================================\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      isConnected = false;
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        `[WhatsApp Bridge] Conexão encerrada. Reconectando: ${shouldReconnect}...`
      );
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 3000);
      }
    } else if (connection === "open") {
      isConnected = true;
      userPhone = sock.user?.id ? sock.user.id.split(":")[0] : null;
      userName = sock.user?.name || null;
      console.log(
        `\n✅ [WhatsApp Bridge] Conectado com sucesso! Telefone: ${userPhone} (${userName || "ArqVértice"})\n`
      );
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

// ----------------------------------------------------
// MODO CLI DIRETO
// ----------------------------------------------------
const args = process.argv.slice(2);
const toIndex = args.indexOf("--to");
const msgIndex = args.indexOf("--msg");

if (toIndex !== -1 && msgIndex !== -1) {
  const rawTo = args[toIndex + 1];
  const msg = args[msgIndex + 1];

  console.log(`[WhatsApp CLI] Iniciando disparo direto para: ${rawTo}...`);

  (async () => {
    await connectToWhatsApp();

    // Aguarda até 15s pela conexão
    let attempts = 0;
    while (!isConnected && attempts < 30) {
      await new Promise((r) => setTimeout(r, 500));
      attempts++;
    }

    if (!isConnected) {
      console.error("[WhatsApp CLI] Erro: Bridge não conseguiu conectar ao WhatsApp a tempo.");
      process.exit(1);
    }

    const clean = sanitizePhone(rawTo);
    const jid = `${clean}@s.whatsapp.net`;

    try {
      const [result] = await sock.onWhatsApp(jid);
      if (!result?.exists) {
        console.error(`[WhatsApp CLI] Número não existe no WhatsApp: ${clean}`);
        process.exit(1);
      }

      const res = await sock.sendMessage(result.jid, { text: msg });
      console.log(`✅ [WhatsApp CLI] Mensagem enviada com sucesso! MessageId: ${res.key.id}`);
      process.exit(0);
    } catch (err) {
      console.error("[WhatsApp CLI] Erro ao enviar:", err);
      process.exit(1);
    }
  })();
} else {
  // ----------------------------------------------------
  // MODO SERVIDOR HTTP LOCAL
  // ----------------------------------------------------
  connectToWhatsApp();

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    // GET /health
    if (req.method === "GET" && parsedUrl.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          connected: isConnected,
          user: userName,
          phone: userPhone,
        })
      );
      return;
    }

    // POST /send
    if (req.method === "POST" && parsedUrl.pathname === "/send") {
      const authHeader = req.headers["x-bridge-secret"];
      if (authHeader !== BRIDGE_SECRET) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Não autorizado" }));
        return;
      }

      if (!isConnected || !sock) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "WhatsApp Bridge não está conectado no momento.",
          })
        );
        return;
      }

      let bodyStr = "";
      req.on("data", (chunk) => {
        bodyStr += chunk;
      });

      req.on("end", async () => {
        try {
          const { phone, message } = JSON.parse(bodyStr || "{}");
          if (!phone || !message) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ success: false, error: "phone e message são obrigatórios" })
            );
            return;
          }

          const clean = sanitizePhone(phone);
          const jid = `${clean}@s.whatsapp.net`;

          const existsCheck = await sock.onWhatsApp(jid);
          const target = existsCheck?.[0];

          if (!target?.exists) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: false,
                error: "Número não cadastrado no WhatsApp",
              })
            );
            return;
          }

          const sent = await sock.sendMessage(target.jid, { text: message });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              messageId: sent?.key?.id,
              phone: clean,
            })
          );
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: String(err) }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Rota não encontrada" }));
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`🚀 [WhatsApp Bridge Server] Rodando em http://127.0.0.1:${PORT}`);
    console.log(`🔐 Secret configurado: ${BRIDGE_SECRET ? "OK" : "DEFAULT"}`);
  });
}

