import { describe, expect, it } from "vitest";
import { buildWhatsAppLink, buildWhatsAppMessage, generateWhatsAppLink, normalizeWhatsAppPhone, sanitizePhoneNumber, WhatsAppTemplates } from "./whatsapp";
import {
  buildSessionName,
  buildWhatsAppTemplates,
  shouldIndexInboundMessage,
} from "./whatsapp/multi-session";

describe("whatsapp da proposta comercial", () => {
  it("substitui placeholders e preserva chaves desconhecidas", () => {
    const rendered = buildWhatsAppMessage("Oi {{cliente}}, valor {{valor}} {{naoExiste}}", {
      CLIENTE: "Ana",
      VALOR: "R$ 10,00",
    });
    expect(rendered.text).toBe("Oi Ana, valor R$ 10,00 {{naoExiste}}");
    expect(rendered.missing).toEqual(["NAOEXISTE"]);
  });

  it("normaliza o telefone e rejeita números curtos", () => {
    expect(normalizeWhatsAppPhone("(11) 98888-7777")).toBe("11988887777");
    expect(normalizeWhatsAppPhone("+55 11 98888-7777")).toBe("5511988887777");
    expect(normalizeWhatsAppPhone("123")).toBeNull();
    expect(normalizeWhatsAppPhone(null)).toBeNull();
  });

  it("monta o link wa.me com a mensagem escapada", () => {
    const link = buildWhatsAppLink("(11) 98888-7777", "Olá, tudo bem?");
    expect(link).toBe("https://wa.me/11988887777?text=Ol%C3%A1%2C%20tudo%20bem%3F");
  });

  it("lança erro ao montar link sem telefone válido", () => {
    expect(() => buildWhatsAppLink("", "oi")).toThrow("Telefone inválido");
  });

  it("adiciona o DDI do Brasil ao link automatizado", () => {
    expect(sanitizePhoneNumber("(85) 98590-2642")).toBe("5585985902642");
    expect(generateWhatsAppLink("(85) 98590-2642", " Olá ")).toBe("https://wa.me/5585985902642?text=Ol%C3%A1");
  });

  it("oferece templates estruturados para os eventos do estúdio", () => {
    expect(WhatsAppTemplates.stageCompleted({
      clientName: "Pedro",
      stageName: "Projeto Executivo",
      projectName: "Residência de Praia",
      portalUrl: "https://example.com/portal",
    })).toContain("Projeto Executivo");
  });

  it("sinaliza as variáveis obrigatórias ausentes para bloquear o envio", () => {
    const rendered = buildWhatsAppMessage("Olá {{cliente}}! {{link}}", { CLIENTE: "Ana" });
    expect(rendered.missingRequired).toEqual(["LINK"]);
  });

  it("considera o template completo quando as obrigatórias estão presentes", () => {
    const rendered = buildWhatsAppMessage("Olá {{cliente}}! {{link}}", {
      CLIENTE: "Ana",
      LINK: "https://app.exemplo/briefing-proposta/token-seguro",
    });
    expect(rendered.missingRequired).toEqual([]);
    expect(rendered.text).not.toContain("{{");
  });

  it("gera sessionName isolado e aplica filtro de privacidade onlyKnownContacts", () => {
    expect(buildSessionName("12345678-aaaa-bbbb-cccc-123456789012")).toBe("wa_user_12345678aaaa");
    expect(
      shouldIndexInboundMessage({
        onlyKnownContacts: true,
        remoteJid: "120363000000000000@g.us",
        matchedClientId: "client-1",
      })
    ).toBe(false);
    expect(
      shouldIndexInboundMessage({
        onlyKnownContacts: true,
        remoteJid: "5585999999999@s.whatsapp.net",
        matchedClientId: null,
      })
    ).toBe(false);
    expect(
      shouldIndexInboundMessage({
        onlyKnownContacts: true,
        remoteJid: "5585999999999@s.whatsapp.net",
        matchedClientId: "client-1",
      })
    ).toBe(true);
  });

  it("gera template Pix com Chave Pix Oficial CPF 021.502.003-09", () => {
    const tpls = buildWhatsAppTemplates();
    const pix = tpls.find((t) => t.id === "pix");
    expect(pix?.text).toContain("021.502.003-09");
  });
});
