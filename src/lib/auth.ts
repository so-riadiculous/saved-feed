import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export type Person = "ria" | "dad";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function personForPassword(password: string): Person | null {
  if (password.length > 0 && password === process.env.AUTH_PASSWORD_RIA) return "ria";
  if (password.length > 0 && password === process.env.AUTH_PASSWORD_DAD) return "dad";
  return null;
}

export async function createSessionToken(person: Person): Promise<string> {
  return new SignJWT({ person })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<Person | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const person = payload.person;
    if (person === "ria" || person === "dad") return person;
    return null;
  } catch {
    return null;
  }
}

export async function getCurrentPerson(): Promise<Person | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export { SESSION_MAX_AGE_SECONDS };
