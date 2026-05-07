import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export interface BackupArchiveIntegrity {
  hash: string;
  sizeBytes: number;
}

export interface ArchiveIntegrityService {
  fromBuffer(buffer: Buffer): BackupArchiveIntegrity;
  fromFile(filePath: string): Promise<BackupArchiveIntegrity>;
  assertMatches(actual: BackupArchiveIntegrity, expected: BackupArchiveIntegrity): void;
}

export class Sha256ArchiveIntegrityService implements ArchiveIntegrityService {
  fromBuffer(buffer: Buffer): BackupArchiveIntegrity {
    return {
      hash: formatSha256(createHash("sha256").update(buffer).digest("hex")),
      sizeBytes: buffer.byteLength,
    };
  }

  async fromFile(filePath: string): Promise<BackupArchiveIntegrity> {
    const hash = createHash("sha256");
    let sizeBytes = 0;

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on("data", (chunk: string | Buffer) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        sizeBytes += buffer.byteLength;
        hash.update(buffer);
      });
      stream.on("error", reject);
      stream.on("end", resolve);
    });

    return {
      hash: formatSha256(hash.digest("hex")),
      sizeBytes,
    };
  }

  assertMatches(actual: BackupArchiveIntegrity, expected: BackupArchiveIntegrity): void {
    assertArchiveIntegrity(expected);
    assertArchiveIntegrity(actual);
    if (actual.hash.toLowerCase() !== expected.hash.toLowerCase()) {
      throw new Error("Backup archive hash mismatch.");
    }
    if (actual.sizeBytes !== expected.sizeBytes) {
      throw new Error("Backup archive byte size mismatch.");
    }
  }
}

export function assertArchiveIntegrity(value: BackupArchiveIntegrity): void {
  if (!/^sha256:[a-f0-9]{64}$/i.test(value.hash)) {
    throw new Error("Backup archive hash must be a sha256 digest.");
  }
  if (!Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0) {
    throw new Error("Backup archive byte size must be a positive integer.");
  }
}

function formatSha256(hexDigest: string): string {
  return `sha256:${hexDigest}`;
}
