import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const keyHex = process.env.WORKSPACE_ENCRYPTION_KEY;
  if (keyHex) {
    return Buffer.from(keyHex, "hex");
  }
  // Fallback: derive from DATABASE_URL (dev only)
  const fallback = (process.env.DATABASE_URL || "leadpilot-dev-key-32bytes!!!!!!!").padEnd(32, "!").slice(0, 32);
  return Buffer.from(fallback, "utf8");
}

export function encryptApiKey(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptApiKey(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
