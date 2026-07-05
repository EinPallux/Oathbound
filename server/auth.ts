// Password hashing + session tokens (Node crypto). Passwords are scrypt-hashed with a per-
// account random salt; session tokens are random and stored only as a SHA-256 hash (so a DB
// leak can't be replayed). Synchronous scrypt is fine for a friends server — logins are rare.

import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const KEYLEN = 32;

export interface PasswordHash {
  hash: Buffer;
  salt: Buffer;
}

/** Hash a fresh password with a new random salt. */
export function hashPassword(password: string): PasswordHash {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return { hash, salt };
}

/** Constant-time verify a password against a stored hash+salt. */
export function verifyPassword(password: string, hash: Buffer, salt: Buffer): boolean {
  const test = scryptSync(password, salt, KEYLEN);
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
