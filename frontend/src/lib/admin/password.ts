/**
 * Password hashing for the admin portal (admin.kopanalys.se).
 *
 * Only a scrypt hash of the admin password is ever stored - never the
 * password itself. Encoded form (":"-separated on purpose: "$" in a value is
 * mangled by dotenv variable expansion in .env files):
 *
 *   scrypt:<N>:<r>:<p>:<salt base64url>:<derived key base64url>
 *
 * The cost parameters travel with the hash, so they can be raised later
 * without invalidating hashes that already exist.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const ALGORITHM = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// OWASP-recommended scrypt cost (N=2^16, r=8, p=2 -> 64 MiB, ~300 ms here).
const DEFAULT_COST = { N: 2 ** 16, r: 8, p: 2 } as const;
// Node refuses a hash whose memory need exceeds maxmem; leave generous headroom.
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;
// Each verification is deliberately heavy and the login route is public, so
// cap concurrent ones per server instance rather than let a flood exhaust memory.
const MAX_CONCURRENT_VERIFICATIONS = 2;

export class InvalidPasswordHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPasswordHashError";
  }
}

export class VerifierBusyError extends Error {
  constructor() {
    super("Too many concurrent password verifications");
    this.name = "VerifierBusyError";
  }
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function deriveKey(password: string, salt: Buffer, keyLength: number, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // NFKC so the same password typed via different input methods hashes identically.
    scrypt(password.normalize("NFKC"), salt, keyLength, { N, r, p, maxmem: MAX_MEMORY_BYTES }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function parseHash(encoded: string): ParsedHash {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    throw new InvalidPasswordHashError("Not a recognised scrypt password hash");
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!isPowerOfTwo(N) || N < 2 ** 14 || N > 2 ** 20 || !Number.isInteger(r) || r < 1 || r > 32 || !Number.isInteger(p) || p < 1 || p > 16) {
    throw new InvalidPasswordHashError("scrypt cost parameters are outside the accepted range");
  }
  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");
  if (salt.length < 16 || key.length < 32) {
    throw new InvalidPasswordHashError("scrypt salt or key is too short");
  }
  return { N, r, p, salt, key };
}

/** Throws InvalidPasswordHashError if the string is not a usable hash. */
export function assertValidPasswordHash(encoded: string): void {
  parseHash(encoded);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const { N, r, p } = DEFAULT_COST;
  const key = await deriveKey(password, salt, KEY_LENGTH, N, r, p);
  return [ALGORITHM, N, r, p, salt.toString("base64url"), key.toString("base64url")].join(":");
}

let inFlight = 0;

/**
 * Constant-time check of `password` against an encoded hash. Throws
 * InvalidPasswordHashError for a malformed hash (a configuration bug, not a
 * wrong password) and VerifierBusyError when too many verifications are
 * already running; a wrong password just returns false.
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const { N, r, p, salt, key } = parseHash(encoded);
  if (inFlight >= MAX_CONCURRENT_VERIFICATIONS) throw new VerifierBusyError();
  inFlight += 1;
  try {
    const candidate = await deriveKey(password, salt, key.length, N, r, p);
    return candidate.length === key.length && timingSafeEqual(candidate, key);
  } finally {
    inFlight -= 1;
  }
}
