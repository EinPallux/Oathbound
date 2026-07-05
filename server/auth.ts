// Password hashing + session tokens (Node crypto). Passwords are scrypt-hashed with a per-
// account random salt; session tokens are random and stored only as a SHA-256 hash (so a DB
// leak can't be replayed). Hashing is ASYNC (libuv threadpool) so a burst of logins never
// blocks the single-threaded sim tick — the difference between a friends server and one an
// unauthenticated client can stall by spamming `register`.

import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEYLEN = 32;

export interface PasswordHash {
  hash: Buffer;
  salt: Buffer;
}

/** Hash a fresh password with a new random salt (off the main thread). */
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN);
  return { hash, salt };
}

/** Constant-time verify a password against a stored hash+salt (off the main thread). */
export async function verifyPassword(password: string, hash: Buffer, salt: Buffer): Promise<boolean> {
  const test = await scryptAsync(password, salt, KEYLEN);
  return test.length === hash.length && timingSafeEqual(test, hash);
}

/** SHA-256 of an opaque token — what we store, never the token itself. */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

/** Mint a new opaque session token (returned to the client) + its at-rest hash. */
export function newSessionToken(): { token: string; tokenHash: Buffer } {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}
