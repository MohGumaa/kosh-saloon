import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Hashes a password as `scrypt$N$r$p$<salt b64>$<hash b64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/**
 * Verifies a password against a stored hash. Parameters come from the stored
 * string so they can be raised later. Malformed hashes return false.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [n, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (![n, r, p].every(Number.isInteger) || salt.length === 0 || expected.length === 0) return false;

  try {
    // maxmem must cover 128 * N * r bytes for the stored parameters.
    const key = await derive(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 256 * n * r,
    });
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Spends the same time as a real check so a missing account is not revealed by timing. */
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHash ??= hashPassword("kosh-dummy-password");
  await verifyPassword(password, await dummyHash);
}
