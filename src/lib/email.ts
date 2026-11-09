import { Resend } from "resend";
import nodemailer from "nodemailer";

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type TransactionalEmailResult = {
  ok: boolean;
  configured: boolean;
  provider: "resend" | "smtp" | "none";
  error?: string;
};

function configuredFrom() {
  return process.env.EMAIL_FROM?.trim() || "ArqVértice Studio <contato@arqvertice.com.br>";
}

/**
 * Transporte único de e-mail. Resend tem prioridade; SMTP/Nodemailer é usado
 * quando não há chave do Resend. Sem provider, o evento continua auditável e
 * o fluxo de negócio não falha silenciosamente.
 */
export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<TransactionalEmailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS;

  if (resendKey) {
    try {
      const { error } = await new Resend(resendKey).emails.send({
        from: configuredFrom(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return error
        ? { ok: false, configured: true, provider: "resend", error: error.message }
        : { ok: true, configured: true, provider: "resend" };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        provider: "resend",
        error: error instanceof Error ? error.message : "Falha no Resend.",
      };
    }
  }

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: configuredFrom(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { ok: true, configured: true, provider: "smtp" };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        provider: "smtp",
        error: error instanceof Error ? error.message : "Falha no SMTP.",
      };
    }
  }

  return { ok: false, configured: false, provider: "none", error: "Nenhum provider de e-mail configurado." };
}

export function appUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    return "https://arqvertice-flow.vercel.app";
  }
  return "http://localhost:3000";
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function brandedEmail(text: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><tr><td><p style="margin:0 0 4px;font-size:18px;font-weight:700">ARQVÉRTICE<span style="color:#4f46e5">.</span></p><p style="margin:0 0 24px;font-size:13px;color:#64748b">Arquitetura, Estrutura & Engenharia</p><pre style="margin:0;font:14px/1.7 inherit;white-space:pre-wrap">${escapeHtml(text)}</pre></td></tr></table></td></tr></table></body></html>`;
}

export function briefingLinkEmail(input: { clientName: string; projectName: string; url: string }) {
  const text = `Olá ${input.clientName},\n\nPreparamos o briefing do projeto ${input.projectName}. Acesse o link exclusivo para responder: ${input.url}\n\nEquipe ArqVértice`;
  return { subject: `Briefing do seu projeto | ${input.projectName}`, text, html: brandedEmail(text) };
}

export async function sendBriefingInviteEmail(input: {
  to: string;
  clientName: string;
  projectName: string;
  briefingUrl: string;
}) {
  const template = briefingLinkEmail({
    clientName: input.clientName,
    projectName: input.projectName,
    url: input.briefingUrl,
  });
  return sendTransactionalEmail({ ...template, to: input.to });
}

export function briefingSubmittedEmail(input: { clientName: string; projectName: string; summary: string }) {
  const text = `Briefing respondido\n\nCliente: ${input.clientName}\nProjeto: ${input.projectName}\n\nResumo:\n${input.summary}`;
  return { subject: `Briefing respondido | ${input.projectName}`, text, html: brandedEmail(text) };
}

export async function sendAdminBriefingCompletedAlert(input: {
  clientName: string;
  projectName: string;
  answersSummary: string;
}) {
  const template = briefingSubmittedEmail({
    clientName: input.clientName,
    projectName: input.projectName,
    summary: input.answersSummary,
  });
  return sendTransactionalEmail({
    ...template,
    to: process.env.ADMIN_ALERT_EMAIL?.trim() || "eduardo.marques.arq@gmail.com",
  });
}

export function stageCompletedEmail(input: { clientName: string; projectName: string; stageName: string; completion: number }) {
  const text = `Olá ${input.clientName},\n\nA etapa "${input.stageName}" do projeto ${input.projectName} foi concluída (${input.completion}%).\n\nEquipe ArqVértice`;
  return { subject: `Etapa concluída | ${input.projectName}`, text, html: brandedEmail(text) };
}

export async function sendStageCompletedEmail(input: {
  to: string;
  clientName: string;
  stageName: string;
  projectName: string;
}) {
  const template = stageCompletedEmail({
    clientName: input.clientName,
    projectName: input.projectName,
    stageName: input.stageName,
    completion: 100,
  });
  return sendTransactionalEmail({ ...template, to: input.to });
}
