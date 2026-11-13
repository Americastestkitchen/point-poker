// Keeps secrets (dealers' Jira refresh tokens) between restarts, encrypted with AES-256-GCM,
// so the file alone gives nothing away. The memory vault is for local dev, previews and tests.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Log } from "../table/table.ts";

export interface Vault {
  /** What was saved last, or null when there's nothing (or it can't be read with this key). */
  load(): unknown;
  save(value: unknown): void;
}

const Sealed = z.object({ v: z.literal(1), iv: z.string(), tag: z.string(), data: z.string() });

/** Any passphrase becomes a 32-byte key. */
const keyFrom = (secret: string) => createHash("sha256").update(secret).digest();

export function seal(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}

/** The sealed value, or null when it's not ours, was changed, or the key is different. */
export function unseal(text: string, secret: string): unknown {
  try {
    const sealed = Sealed.parse(JSON.parse(text));
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(sealed.iv, "base64"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    return null;
  }
}

/** DATA_DIR/<name>, sealed with `secret`. */
export function fileVault(dir: string, name: string, secret: string, log: Log): Vault {
  const file = join(dir, name);
  return {
    load() {
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch (e) {
        if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) log.error(`could not read ${name}`, e);
        return null;
      }
      const value = unseal(text, secret);
      if (value === null) log.error(`${name} can't be opened with this TOKEN_KEY, starting fresh`);
      return value;
    },
    save(value) {
      try {
        mkdirSync(dir, { recursive: true });
        // write then rename, so a crash mid-write never leaves a half-written file
        writeFileSync(file + ".tmp", seal(value, secret), { mode: 0o600 });
        renameSync(file + ".tmp", file);
      } catch (e) {
        log.error(`could not save ${name}`, e);
      }
    },
  };
}

/** Kept in memory only, as JSON text, so it behaves like the file vault. */
export function memoryVault(): Vault {
  let saved: string | null = null;
  return {
    load(): unknown {
      return saved === null ? null : (JSON.parse(saved) as unknown);
    },
    save: (value) => {
      saved = JSON.stringify(value);
    },
  };
}
