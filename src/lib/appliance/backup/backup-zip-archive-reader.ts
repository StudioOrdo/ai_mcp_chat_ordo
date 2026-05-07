import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import type { BackupArchiveEntry } from "./backup-archive-paths";
import type { ArchiveReader } from "./backup-archive-validator";

type ZipEntryRecord = BackupArchiveEntry & {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const COMPRESSION_STORE = 0;
const COMPRESSION_DEFLATE = 8;
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_SYMLINK_TYPE = 0o120000;

export class ZipBackupArchiveReader implements ArchiveReader {
  private readonly archive: Buffer;
  private entries: ZipEntryRecord[] | null = null;

  constructor(filePathOrBuffer: string | Buffer) {
    this.archive = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : readFileSync(filePathOrBuffer);
  }

  async getEntries(): Promise<BackupArchiveEntry[]> {
    return this.readEntries().map(({ name, kind, sizeBytes }) => ({
      name,
      kind,
      sizeBytes,
    }));
  }

  async readManifest(): Promise<unknown | null> {
    const manifest = this.readEntries().find((entry) => entry.name === "manifest.json");
    if (!manifest) {
      return null;
    }

    const payload = this.readEntryPayload(manifest);
    try {
      return JSON.parse(payload.toString("utf8")) as unknown;
    } catch {
      throw new Error("Backup archive manifest is not valid JSON.");
    }
  }

  private readEntries(): ZipEntryRecord[] {
    if (this.entries) {
      return this.entries;
    }

    const eocdOffset = this.findEndOfCentralDirectory();
    const totalEntries = this.archive.readUInt16LE(eocdOffset + 10);
    let offset = this.archive.readUInt32LE(eocdOffset + 16);
    const entries: ZipEntryRecord[] = [];

    for (let index = 0; index < totalEntries; index += 1) {
      if (this.archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
        throw new Error("Invalid zip central directory entry.");
      }

      const compressionMethod = this.archive.readUInt16LE(offset + 10);
      const compressedSize = this.archive.readUInt32LE(offset + 20);
      const uncompressedSize = this.archive.readUInt32LE(offset + 24);
      const fileNameLength = this.archive.readUInt16LE(offset + 28);
      const extraLength = this.archive.readUInt16LE(offset + 30);
      const commentLength = this.archive.readUInt16LE(offset + 32);
      const externalAttributes = this.archive.readUInt32LE(offset + 38);
      const localHeaderOffset = this.archive.readUInt32LE(offset + 42);
      const nameStart = offset + 46;
      const name = this.archive.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
      const unixMode = externalAttributes >>> 16;
      const isSymlink = (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK_TYPE;
      const isDirectory = name.endsWith("/");

      entries.push({
        name,
        kind: isSymlink ? "symlink" : isDirectory ? "directory" : "file",
        sizeBytes: uncompressedSize,
        compressionMethod,
        compressedSize,
        localHeaderOffset,
      });

      offset = nameStart + fileNameLength + extraLength + commentLength;
    }

    this.entries = entries;
    return entries;
  }

  private readEntryPayload(entry: ZipEntryRecord): Buffer {
    const offset = entry.localHeaderOffset;
    if (this.archive.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error("Invalid zip local file header.");
    }

    const fileNameLength = this.archive.readUInt16LE(offset + 26);
    const extraLength = this.archive.readUInt16LE(offset + 28);
    const payloadStart = offset + 30 + fileNameLength + extraLength;
    const compressed = this.archive.subarray(payloadStart, payloadStart + entry.compressedSize);

    if (entry.compressionMethod === COMPRESSION_STORE) {
      return compressed;
    }
    if (entry.compressionMethod === COMPRESSION_DEFLATE) {
      return inflateRawSync(compressed);
    }

    throw new Error(`Unsupported zip compression method: ${entry.compressionMethod}`);
  }

  private findEndOfCentralDirectory(): number {
    for (let offset = this.archive.length - 22; offset >= 0; offset -= 1) {
      if (this.archive.readUInt32LE(offset) === EOCD_SIGNATURE) {
        return offset;
      }
    }

    throw new Error("Invalid zip archive: end of central directory not found.");
  }
}
