import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Download a cross-origin image (e.g. Firebase Storage URL) as a file.
 * The <a download> attribute is ignored by browsers for cross-origin URLs,
 * so we fetch it as a blob and create a local object URL instead.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function generateId(prefix = ""): string {
  const cryptoApi = globalThis.crypto;
  const hasRandomUuid =
    typeof cryptoApi !== "undefined" &&
    typeof cryptoApi.randomUUID === "function";

  if (hasRandomUuid) {
    const uuid = cryptoApi.randomUUID();
    return prefix ? `${prefix}${uuid}` : uuid;
  }

  const hasRandomValues =
    typeof cryptoApi !== "undefined" &&
    typeof cryptoApi.getRandomValues === "function";

  if (hasRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    const uuid = `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
    return prefix ? `${prefix}${uuid}` : uuid;
  }

  const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}${fallback}` : fallback;
}
