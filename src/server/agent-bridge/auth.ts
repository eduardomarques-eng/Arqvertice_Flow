import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { currentUser } from "@/server/auth";

export type AgentAuthUser = Awaited<ReturnType<typeof currentUser>>;

export function isValidAgentKey(providedKey: string | null): boolean {
  const expectedKey = process.env.OPENBOT_AGENT_KEY?.trim();
  if (!expectedKey || !providedKey) {
    return false;
  }
  const providedBuf = Buffer.from(providedKey.trim(), "utf8");
  const expectedBuf = Buffer.from(expectedKey, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export async function authorizeAgentRequest(
  request: NextRequest,
  options?: { allowStaffCookie?: boolean }
): Promise<{ authorized: boolean; mode: "agent_key" | "session" | null; user: AgentAuthUser }> {
  const agentKeyHeader = request.headers.get("x-agent-key");
  if (isValidAgentKey(agentKeyHeader)) {
    return { authorized: true, mode: "agent_key", user: null };
  }

  const user = await currentUser();
  if (!user) {
    return { authorized: false, mode: null, user: null };
  }

  if (
    user.role === "ADMIN" ||
    (options?.allowStaffCookie &&
      (user.role === "ARQUITETO" || user.role === "ENGENHEIRO" || user.role === "EQUIPE"))
  ) {
    return { authorized: true, mode: "session", user };
  }

  return { authorized: false, mode: null, user };
}
