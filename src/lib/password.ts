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
    const actual = scryptSync(password, `${salt}:${authSecret()}`, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}
