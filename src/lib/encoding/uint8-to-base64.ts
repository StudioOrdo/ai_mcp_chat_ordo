export const UINT8_TO_BASE64_CHUNK_SIZE = 0x8000;

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const bufferCtor = globalThis.Buffer;

  if (bufferCtor) {
    return bufferCtor.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }

  let binary = "";

  for (let index = 0; index < bytes.length; index += UINT8_TO_BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(index, Math.min(index + UINT8_TO_BASE64_CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  const fallbackBufferCtor = globalThis.Buffer;

  if (fallbackBufferCtor) {
    return fallbackBufferCtor.from(binary, "binary").toString("base64");
  }

  throw new Error("Base64 encoding is not supported in this runtime.");
}