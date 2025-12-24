import crypto from "crypto";
import { env } from "./env";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended

const getKey = (): Buffer => {
  const key = env.appEncryptionKey;
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is required for encryption");
  }
  // Derive a 32-byte key from the provided secret (hex or utf-8)
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  const hash = crypto.createHash("sha256");
  hash.update(key);
  return hash.digest();
};

export const encryptField = (plain?: string | null): string | null => {
  if (!plain) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${Buffer.concat([iv, tag, enc]).toString("base64")}`;
};

export const decryptField = (value?: string | null): string | null => {
  if (!value) return null;
  if (!value.startsWith("enc:")) {
    return value;
  }
  const key = getKey();
  const raw = Buffer.from(value.slice(4), "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const data = raw.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
};


