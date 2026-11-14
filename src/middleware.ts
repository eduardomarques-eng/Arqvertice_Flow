import { NextResponse, type NextRequest } from "next/server";
import {
  buildSecurityHeaders,
  createSecurityNonce,
  isProtectedPath,
  isPublicTokenPath,
  SECURITY_HEADER_NAMES,
} from "@/lib/security-headers";
import { resolveRedirectForPath } from "@/lib/route-isolation";

const SESSION_COOKIE = "arqvertice_session";
const ROLE_COOKIE = "arqvertice_role";
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/health"] as const;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return true;
  }
  return isPublicTokenPath(pathname);
}
/**
 * Tópico 35 — primeira camada de segurança, executada no edge antes de qualquer
 * renderização ou consulta ao banco.

 * Responsabilidades:
 *  1. anexar os cabeçalhos de segurança a todas as respostas;
 *  2. propagar o nonce para o CSP da resposta;
 *  3. validar origem (CSRF) via Origin/Host;
 *  4. injetar X-Request-Id para rastreamento distribuído;
 *  5. aplicar Cache-Control: no-store nas rotas autenticadas e session-status;
 *  6. redirecionar rotas protegidas sem cookie de sessão.

 * Regras de rota por papel (aplicadas também nas páginas via requirePage*):
 *  - /admin/*   -> apenas ADMIN
 *  - /equipe/*  -> EQUIPE e ADMIN
 *  - /portal/*  -> CLIENTE e ADMIN

 * Isto NÃO é a fronteira de autorização. A prova de acesso continua a ser feita
 * no servidor (requirePageAdminRole / requirePageTeamRole /
 * requirePageClientPortal / requireProjectAccess), porque o middleware roda
 * no edge e não pode consultar o banco — o token de sessão é um hash e o papel
 * só se resolve no banco. A presença do cookie aqui é um filtro antecipado que
 * evita trabalho inútil, nunca uma concessão de acesso.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createSecurityNonce();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const isSecureContext = request.nextUrl.protocol === "https:";

  const headers = buildSecurityHeaders({ nonce, isDevelopment, isSecureContext });

  // Constrói um novo Headers para a requisição. Mutar request.headers NÃO propaga
  // no Next.js 15 — os cabeçalhos de segurança só chegam à resposta.
  const requestHeaders = new Headers(request.headers);

  // 4. Injeção de X-Request-Id para rastreamento distribuído.
  const requestId = request.headers.get("x-request-id") || nonce;
  requestHeaders.set("x-request-id", requestId);

  // 3. Validação de origem (CSRF) para requisições mutantes (POST, PUT, PATCH, DELETE).
  // Requisições seguras (GET, HEAD, OPTIONS) nunca sofrem validação CSRF de origem.
  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (isMutatingMethod) {
    const origin = request.headers.get("origin");
    if (origin) {
      const isAllowedOrigin =
        origin === request.nextUrl.origin ||
        origin === "https://arqvertice.com" ||
        origin === "https://www.arqvertice.com" ||
        (origin.startsWith("https://") && origin.endsWith(".vercel.app")) ||
        (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) ||
        (process.env.NEXT_PUBLIC_APP_URL && origin === process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")) ||
        (process.env.NODE_ENV !== "production" ||
          request.nextUrl.hostname === "localhost" ||
          request.nextUrl.hostname === "127.0.0.1" ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:"));

      if (!isAllowedOrigin && !pathname.startsWith("/api/briefings")) {
        return new NextResponse(JSON.stringify({ error: "Forbidden: Origem não autorizada." }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      }
    }
  }

  // 5. Cache-Control: no-store nas rotas autenticadas e session-status.
  const isAuthRoute = isProtectedPath(pathname) || pathname === "/api/auth/session-status";
  if (isAuthRoute) {
    headers["Cache-Control"] = "no-store, max-age=0";
  }

  // 6. Isolamento de ambiente por papel na borda (defesa em profundidade).
  //    A prova definitiva de autorização continua nas páginas (requirePage*),
  //    porque o middleware não consulta o banco. O cookie de papel impede que um
  //    técnico pouse em /admin, um admin em /equipe ou um cliente em qualquer um
  //    dos dois, já no primeiro byte da resposta.
  if (!isPublicPath(pathname) && isProtectedPath(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    const currentBuildId = process.env.APP_BUILD_ID || process.env.NEXT_PUBLIC_BUILD_ID;
    const cookieBuildId = request.cookies.get("arqvertice_build_id")?.value;

    if (!sessionCookie) {
      const target = new URL("/", request.url);
      target.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(target);
    }

    if (currentBuildId && cookieBuildId !== currentBuildId) {
      const target = new URL("/", request.url);
      const res = NextResponse.redirect(target);
      for (const name of [SESSION_COOKIE, ROLE_COOKIE, "arqvertice_permissions", "arqvertice_build_id"]) {
        res.cookies.set(name, "", { maxAge: 0, path: "/" });
      }
      return res;
    }

    const role = request.cookies.get(ROLE_COOKIE)?.value ?? null;
    const redirectTo = resolveRedirectForPath(pathname, role);
    if (redirectTo) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    const moduleMatch = pathname.match(
      /^\/equipe\/(projetos|acervo|cronograma|financeiro|clientes|equipe|briefing|propostas|configuracoes)/
    );
    if (moduleMatch) {
      const seg = moduleMatch[1];
      const mod =
        seg === "acervo" || seg === "briefing" || seg === "propostas"
          ? "projetos"
          : seg === "configuracoes"
          ? "equipe"
          : seg;
      const permsCookie = request.cookies.get("arqvertice_permissions")?.value;
      let perms: string[] = [];
      try {
        perms = JSON.parse(permsCookie ?? "[]");
      } catch {}
      if (role !== "ADMIN" && !perms.includes(mod)) {
        return NextResponse.redirect(new URL("/equipe", request.url));
      }
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;

}

export const config = {
  /**
   * Arquivos estáticos não passam pelo middleware: não há HTML a proteger e
   * filtrá-los só adicionaria latência. Os caminhos de API permanecem
   * incluídos porque é neles que vivem os downloads de documentos.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export { SECURITY_HEADER_NAMES };
