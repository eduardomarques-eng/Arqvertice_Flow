import { scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { DomainError } from "../server/errors";

function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres.");
  return value;
}

export function hashPassword(password: string) {
  if (password.length < 8) throw new DomainError("A senha deve ter pelo menos 8 caracteres.", "VALIDATION");
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, stored: string) {
  if (!stored) return false;
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    try {
      return bcrypt.compareSync(password, stored);
    } catch {
      return false;
    }
  }
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  try {
    const expectedBuffer = Buffer.from(expected, "hex");
    // Tentativa 1: scrypt com AUTH_SECRET
    try {
      const secret = authSecret();
      const actual = scryptSync(password, `${salt}:${secret}`, 64);
      if (actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)) {
        return true;
      }
    } catch {}

    // Tentativa 2: scrypt com salt simples
    try {
      const actualDirect = scryptSync(password, salt, 64);
      if (actualDirect.length === expectedBuffer.length && timingSafeEqual(actualDirect, expectedBuffer)) {
        return true;
      }
    } catch {}

    return false;
  } catch {
    return false;
  }
}
