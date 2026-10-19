/** The width and height written in a PNG's header, or undefined when the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The first chunk is IHDR: 4 bytes of length, 4 of type, then the width and the height.
  if (view.getUint32(12) !== 0x49484452) return undefined;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
