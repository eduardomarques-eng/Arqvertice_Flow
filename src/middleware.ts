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

  // 3. Validação de origem (CSRF) via Origin/Host.
  const trustedOrigins = [
    "https://arqvertice.com",
    "https://www.arqvertice.com"
  ];
  const trustedOrigin = request.headers.get("origin") || request.headers.get("host");
  const isUntrustedOrigin = !trustedOrigins.includes(trustedOrigin);

  // Bloqueia requisições com origem/sinkhost não autorizadas para rotas
  // protegidas (excluindo /api/health e /api/briefings públicos).
  if (isUntrustedOrigin && isProtectedPath(pathname) && !pathname.startsWith("/api/briefings")) {
    return new NextResponse(JSON.stringify({error:"Forbidden"}), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
    });
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
    if (!sessionCookie) {
      const target = new URL("/login", request.url);
      target.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(target);
    }

    const role = request.cookies.get(ROLE_COOKIE)?.value ?? null;
    const redirectTo = resolveRedirectForPath(pathname, role);
    if (redirectTo) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico))$.*)"],
};

export { SECURITY_HEADER_NAMES };
