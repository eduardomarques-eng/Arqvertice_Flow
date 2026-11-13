/**
 * ArqVértice Flow — WhatsApp CLI / HTTP Local Bridge (Gratuito - Self-Hosted com Baileys)
 * ======================================================================================
 * Roda como um micro-serviço HTTP local independente (porta 3001) para envio automatizado
 * de mensagens WhatsApp pelo estúdio sem mensalidade.
 *
 * Uso:
 *   npx tsx scripts/whatsapp-bridge.ts
 */

import "dotenv/config";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";

const PORT = Number(process.env.WHATSAPP_BRIDGE_PORT || 3001);
const SECRET = process.env.WHATSAPP_BRIDGE_SECRET || "arqvertice-local-bridge-2026";
const SESSION_DIR = path.resolve(process.cwd(), ".whatsapp-session");

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

let sock: any = null;
let isConnected = false;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`[WhatsApp Bridge] Versão Baileys: ${version.join(".")}, mais recente: ${isLatest}`);

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n[WhatsApp Bridge] Escaneie o QR Code abaixo com seu WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        `[WhatsApp Bridge] Conexão fechada. Reconectar: ${shouldReconnect}`,
        lastDisconnect?.error
      );
      isConnected = false;
      if (shouldReconnect) {
        setTimeout(startWhatsApp, 5000);
      }
    } else if (connection === "open") {
      console.log("[WhatsApp Bridge] Conexão WhatsApp autenticada e pronta para envios!");
      isConnected = true;
    }
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bridge-secret");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Status Check
  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: isConnected ? "connected" : "disconnected",
        sessionDir: SESSION_DIR,
      })
    );
    return;
  }

  // Envio de Mensagem
  if (req.method === "POST" && url.pathname === "/send") {
    const authHeader = req.headers["x-bridge-secret"];
    if (authHeader !== SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Segredo de autenticação inválido." }));
      return;
    }

    if (!isConnected || !sock) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "WhatsApp Bridge não está conectado no momento.",
          fallbackUrl: true,
        })
      );
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const { phone, message } = JSON.parse(body);
        if (!phone || !message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Campos 'phone' e 'message' são obrigatórios." }));
          return;
        }

        const digits = String(phone).replace(/\D/g, "");
        const formattedJid = `${digits}@s.whatsapp.net`;

        const result = await sock.sendMessage(formattedJid, { text: String(message).trim() });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            id: result?.key?.id,
            timestamp: result?.messageTimestamp,
          })
        );
      } catch (err: any) {
        console.error("[WhatsApp Bridge] Erro ao enviar mensagem:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Falha interna no bridge." }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Rota não encontrada." }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[WhatsApp Bridge] Servidor HTTP local rodando em http://127.0.0.1:${PORT}`);
  startWhatsApp().catch((err) => console.error("[WhatsApp Bridge] Erro na inicialização:", err));
});

