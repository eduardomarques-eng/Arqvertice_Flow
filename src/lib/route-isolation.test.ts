import { describe, expect, it } from "vitest";
import {
  isAdminRole,
  isClientRole,
  isPathAllowed,
  isTeamRole,
  resolveRedirectForPath,
} from "./route-isolation";

/**
 * FASE 4 — Exploit & Regression Verification via Vulnerability Harness.
 *
 * Estes testes provam o isolamento de ambiente entre /admin (ADMIN),
 * /equipe (Equipe Tecnica) e /portal (CLIENTE). Sao funcoes puras, sem
 * dependencia de banco de dados, rodando em qualquer ambiente.
 */
describe("isolamento de ambiente por rota", () => {
  describe("/admin e /admin/* — exclusivo ADMIN", () => {
    it("administrador acessa /admin", () => {
      expect(isPathAllowed("/admin", "ADMIN")).toBe(true);
    });

    it("administrador acessa /admin/projetos", () => {
      expect(isPathAllowed("/admin/projetos", "ADMIN")).toBe(true);
    });

    it("administrador acessa /admin/financeiro", () => {
      expect(isPathAllowed("/admin/financeiro", "ADMIN")).toBe(true);
    });

    it("engenheiro NAO acessa /admin -> redireciona para /equipe", () => {
      expect(resolveRedirectForPath("/admin", "ENGENHEIRO")).toBe("/equipe");
      expect(isPathAllowed("/admin", "ENGENHEIRO")).toBe(false);
    });

    it("arquiteto NAO acessa /admin -> redireciona para /equipe", () => {
      expect(resolveRedirectForPath("/admin", "ARQUITETO")).toBe("/equipe");
    });

    it("equipe NAO acessa /admin -> redireciona para /equipe", () => {
      expect(resolveRedirectForPath("/admin", "EQUIPE")).toBe("/equipe");
    });

    it("operador NAO acessa /admin -> redireciona para /equipe", () => {
      expect(resolveRedirectForPath("/admin", "OPERADOR")).toBe("/equipe");
    });

    it("cliente NAO acessa /admin -> redireciona para /portal", () => {
      expect(resolveRedirectForPath("/admin", "CLIENTE")).toBe("/portal");
    });

    it("sem papel NAO acessa /admin -> redireciona para /login", () => {
      expect(resolveRedirectForPath("/admin", null)).toBe("/login");
    });

    it("CASO WAGNER: ENGENHEIRO tenta /admin e vai para /equipe", () => {
      expect(resolveRedirectForPath("/admin", "ENGENHEIRO")).toBe("/equipe");
      expect(resolveRedirectForPath("/admin/dashboard", "ENGENHEIRO")).toBe(
        "/equipe",
      );
      expect(resolveRedirectForPath("/admin/gestao", "ENGENHEIRO")).toBe(
        "/equipe",
      );
      expect(resolveRedirectForPath("/admin/financeiro", "ENGENHEIRO")).toBe(
        "/equipe",
      );
    });
  describe("/equipe e /equipe/* — exclusivo Equipe Tecnica", () => {
    it("engenheiro acessa /equipe", () => {
      expect(isPathAllowed("/equipe", "ENGENHEIRO")).toBe(true);
    });

    it("engenheiro acessa /equipe/projetos", () => {
      expect(isPathAllowed("/equipe/projetos", "ENGENHEIRO")).toBe(true);
    });

    it("engenheiro acessa /equipe/cronograma", () => {
      expect(isPathAllowed("/equipe/cronograma", "ENGENHEIRO")).toBe(true);
    });

    it("arquiteto acessa /equipe", () => {
      expect(isPathAllowed("/equipe", "ARQUITETO")).toBe(true);
    });

    it("equipe acessa /equipe", () => {
      expect(isPathAllowed("/equipe", "EQUIPE")).toBe(true);
    });

    it("operador acessa /equipe", () => {
      expect(isPathAllowed("/equipe", "OPERADOR")).toBe(true);
    });

    it("administrador NAO acessa /equipe -> redireciona para /admin", () => {
      expect(resolveRedirectForPath("/equipe", "ADMIN")).toBe("/admin");
      expect(isPathAllowed("/equipe", "ADMIN")).toBe(false);
    });

    it("cliente NAO acessa /equipe -> redireciona para /portal", () => {
      expect(resolveRedirectForPath("/equipe", "CLIENTE")).toBe("/portal");
    });

    it("sem papel NAO acessa /equipe -> redireciona para /login", () => {
      expect(resolveRedirectForPath("/equipe", null)).toBe("/login");
    });
  });

  describe("/portal e /portal/* — exclusivo CLIENTE", () => {
    it("cliente acessa /portal", () => {
      expect(isPathAllowed("/portal", "CLIENTE")).toBe(true);
    });

    it("cliente acessa /portal/123", () => {
      expect(isPathAllowed("/portal/123", "CLIENTE")).toBe(true);
    });

    it("administrador NAO acessa /portal -> redireciona para /admin", () => {
      expect(resolveRedirectForPath("/portal", "ADMIN")).toBe("/admin");
    });

    it("engenheiro NAO acessa /portal -> redireciona para /equipe", () => {
      expect(resolveRedirectForPath("/portal", "ENGENHEIRO")).toBe("/equipe");
    });

    it("sem papel NAO acessa /portal -> redireciona para /login", () => {
      expect(resolveRedirectForPath("/portal", null)).toBe("/login");
    });
  });
});

describe("funcoes auxiliares de papel", () => {
  it("isTeamRole reconhece papéis da equipe", () => {
    for (const role of ["ENGENHEIRO", "ARQUITETO", "EQUIPE", "OPERADOR"]) {
      expect(isTeamRole(role)).toBe(true);
    }
    expect(isTeamRole("ADMIN")).toBe(false);
    expect(isTeamRole("CLIENTE")).toBe(false);
    expect(isTeamRole(null)).toBe(false);
  });

  it("isClientRole reconhece clientes", () => {
    expect(isClientRole("CLIENTE")).toBe(true);
    expect(isClientRole("CLIENT")).toBe(true);
    expect(isClientRole("ADMIN")).toBe(false);
    expect(isClientRole("ENGENHEIRO")).toBe(false);
    expect(isClientRole(null)).toBe(false);
  });

  it("isAdminRole reconhece apenas ADMIN", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("ENGENHEIRO")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("presets de permissao (RBAC/ABAC)", () => {
  const ROLE_PERMISSION_PRESETS: Record<string, string[]> = {
    ADMIN: ["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"],
    ARQUITETO: ["dashboard", "cronograma", "projetos", "clientes"],
    ENGENHEIRO: ["dashboard", "cronograma", "projetos"],
    EQUIPE: ["dashboard", "cronograma", "projetos"],
    OPERADOR: ["dashboard", "cronograma", "projetos"],
    CLIENTE: ["portal"],
    CLIENT: ["portal"],
  };

  it("ENGENHEIRO (Wagner) nao tem permissao de financeiro/clientes/equipe", () => {
    const perms = ROLE_PERMISSION_PRESETS["ENGENHEIRO"];
    expect(perms).toContain("dashboard");
    expect(perms).toContain("cronograma");
    expect(perms).toContain("projetos");
    expect(perms).not.toContain("financeiro");
    expect(perms).not.toContain("clientes");
    expect(perms).not.toContain("equipe");
  });

  it("ADMIN tem todas as permissoes de modulo", () => {
    const perms = ROLE_PERMISSION_PRESETS["ADMIN"];
    expect(perms).toEqual(
      expect.arrayContaining([
        "dashboard",
        "cronograma",
        "projetos",
        "financeiro",
        "clientes",
        "equipe",
      ]),
    );
  });

  it("CLIENTE so tem permissao de portal", () => {
    const perms = ROLE_PERMISSION_PRESETS["CLIENTE"];
    expect(perms).toEqual(["portal"]);
  });
});
  });