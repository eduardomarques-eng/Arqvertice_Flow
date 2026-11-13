import { Resend } from "resend";

export interface ArqVerticeEmailParams {
  to: string | string[];
  subject: string;
  recipientName?: string;
  category?: string; // ex: "Cronograma", "Financeiro", "Acervo Técnico", "Governança"
  messageBody: string;
  projectName?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  fallbackMailto?: boolean;
  error?: string;
}

/**
 * Template HTML Responsivo Institucional do ArqVértice Studio
 */
export function buildArqVerticeEmailTemplate({
  recipientName,
  category = "Aviso do Sistema",
  messageBody,
  projectName,
}: {
  recipientName?: string;
  category?: string;
  messageBody: string;
  projectName?: string;
}): string {
  const formattedBody = messageBody
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((p) => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #3f3f46;">${p}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArqVértice Studio</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);">
          
          <!-- CABEÇALHO INSTITUCIONAL -->
          <tr>
            <td style="background-color: #09090b; padding: 32px 36px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; text-transform: uppercase;">ArqVértice</span>
                    <span style="font-size: 13px; font-weight: 500; letter-spacing: 1px; color: #a1a1aa; margin-left: 6px; text-transform: uppercase;">Studio</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 600; color: #d4d4d8; background-color: #27272a; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${category}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTEÚDO PRINCIPAL -->
          <tr>
            <td style="padding: 36px;">
              ${
                recipientName
                  ? `<h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #18181b;">Olá, ${recipientName}!</h2>`
                  : ""
              }

              ${
                projectName
                  ? `
                <div style="margin-bottom: 24px; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 8px;">
                  <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Empreendimento:</span>
                  <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px;">${projectName}</div>
                </div>
              `
                  : ""
              }

              <div style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
                ${formattedBody}
              </div>

              <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #f4f4f5;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://arqvertice-flow.vercel.app"}" style="display: inline-block; background-color: #09090b; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 12px 24px; border-radius: 10px;">
                  Acessar ArqVértice Flow →
                </a>
              </div>
            </td>
          </tr>

          <!-- RODAPÉ TÉCNICO -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 36px; border-top: 1px solid #f4f4f5; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #a1a1aa; line-height: 1.5;">
                ArqVértice Studio & Consultoria Técnica · Gestão Integrada de Arquitetura e Engenharia<br />
                Este é um e-mail automatizado pelo sistema de governança do ArqVértice Flow.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Função de envio institucional de e-mail via Resend
 */
export async function sendArqVerticeEmail({
  to,
  subject,
  recipientName,
  category = "Aviso do Sistema",
  messageBody,
  projectName,
}: ArqVerticeEmailParams): Promise<EmailDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[ResendService] RESEND_API_KEY não configurada no ambiente.");
    return {
      success: false,
      fallbackMailto: true,
      error: "RESEND_API_KEY não configurada",
    };
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "ArqVértice Flow <notificacoes@arqvertice.com.br>";

  try {
    const resend = new Resend(apiKey);
    const html = buildArqVerticeEmailTemplate({
      recipientName,
      category,
      messageBody,
      projectName,
    });

    const response = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });

    if (response.error) {
      console.error("[ResendService] Erro retornado pela API:", response.error);
      return {
        success: false,
        error: response.error.message,
      };
    }

    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (err: any) {
    console.error("[ResendService] Exceção no envio:", err);
    return {
      success: false,
      fallbackMailto: true,
      error: err?.message || "Erro desconhecido ao enviar e-mail via Resend",
    };
  }
}

