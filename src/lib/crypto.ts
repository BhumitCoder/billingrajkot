/**
 * Encryption using AES-GCM 256-bit via Web Crypto API.
 *
 * Storage layout:
 *   sessionStorage["enc_k"] — raw key for the current tab session (cleared on tab close)
 *   localStorage["enc_v"]   — AES-GCM encrypted verification token; used to validate future key entries
 *
 * The raw key is never stored in localStorage. The verification token lets the app
 * confirm a re-entered key is correct without knowing the original key.
 */

const SS_KEY = "enc_k";      // sessionStorage — raw key (tab lifetime)
const LS_VERIFY = "enc_v";   // localStorage  — encrypted verification token
const LS_ACTIVE = "enc_on";  // localStorage  — "true" when user has explicitly started encryption
const VERIFY_PLAIN = "iball-verify-v1";

let _key: CryptoKey | null = null;

// ── Key derivation ──────────────────────────────────────────────────────────

const SALT = new TextEncoder().encode("iball-mobile-v1-salt");

async function deriveKey(password: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ── Low-level AES-GCM ───────────────────────────────────────────────────────

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function aesEncrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(12 + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), 12);
  // Use a loop instead of spread (...combined) to avoid call stack overflow on large payloads
  let binary = "";
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

async function aesDecrypt(b64str: string, key: CryptoKey): Promise<string> {
  const combined = unb64(b64str);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Set (or change) the encryption key.
 * Stores the raw key in sessionStorage and writes a fresh verification token to localStorage.
 */
export async function setEncryptionKey(password: string): Promise<void> {
  const derived = await deriveKey(password);
  const token = await aesEncrypt(VERIFY_PLAIN, derived);
  sessionStorage.setItem(SS_KEY, password);
  localStorage.setItem(LS_VERIFY, token);
  _key = derived;
}

/**
 * Verify that a password matches the stored verification token.
 * Returns true  → key is correct (or no token exists yet — first-time setup).
 * Returns false → wrong key.
 */
export async function verifyEncryptionKey(password: string): Promise<boolean> {
  const token = localStorage.getItem(LS_VERIFY);
  if (!token) return true; // no data encrypted yet, any key is valid
  try {
    const testKey = await deriveKey(password);
    const decrypted = await aesDecrypt(token, testKey);
    return decrypted === VERIFY_PLAIN;
  } catch {
    return false;
  }
}

/**
 * Try to restore the key from sessionStorage on page load.
 * Always verifies the loaded key against the stored verification token before trusting it.
 * Returns true only if the key is present AND passes verification.
 */
export async function initEncryptionKey(): Promise<boolean> {
  if (_key) return true;
  const stored = sessionStorage.getItem(SS_KEY);
  if (!stored) return false;

  const testKey = await deriveKey(stored);
  const token = localStorage.getItem(LS_VERIFY);

  if (token) {
    // Verify the key actually decrypts the token correctly
    try {
      const decrypted = await aesDecrypt(token, testKey);
      if (decrypted !== VERIFY_PLAIN) {
        // Key in sessionStorage doesn't match stored data — clear it
        sessionStorage.removeItem(SS_KEY);
        return false;
      }
    } catch {
      // Decryption failed — key is wrong or tampered
      sessionStorage.removeItem(SS_KEY);
      return false;
    }
  }

  _key = testKey;
  return true;
}

/**
 * Clear key material from memory and session — called on logout.
 * LS_VERIFY and LS_ACTIVE are intentionally kept so the app knows to ask
 * for the key again on next login instead of treating it as a fresh setup.
 */
export function clearEncryptionKey(): void {
  sessionStorage.removeItem(SS_KEY);
  _key = null;
}

/** Returns the current verify token stored in localStorage (safe to persist in Firestore). */
export function getVerifyToken(): string {
  return localStorage.getItem(LS_VERIFY) ?? "";
}

/**
 * Restore encryption state from a remote source (Firestore) into localStorage.
 * Only writes if the local values are missing — never overwrites user-set values.
 */
export function restoreEncryptionFromRemote(verifyToken: string, active: boolean): void {
  if (verifyToken && !localStorage.getItem(LS_VERIFY)) {
    localStorage.setItem(LS_VERIFY, verifyToken);
  }
  if (active && !localStorage.getItem(LS_ACTIVE)) {
    localStorage.setItem(LS_ACTIVE, "true");
  }
}

/** Fully wipe all encryption state — called only when resetting/disabling encryption. */
export function resetEncryptionState(): void {
  sessionStorage.removeItem(SS_KEY);
  localStorage.removeItem(LS_VERIFY);
  localStorage.removeItem(LS_ACTIVE);
  _key = null;
}

/** True if there is a verification token — i.e. a key has been configured. */
export function isEncryptionConfigured(): boolean {
  return !!localStorage.getItem(LS_VERIFY);
}

/** True if the user has explicitly started encryption (key configured + activated). */
export function isEncryptionActive(): boolean {
  return localStorage.getItem(LS_ACTIVE) === "true";
}

/** Call this after verifying the key to activate encryption for all future writes. */
export function startEncryption(): void {
  localStorage.setItem(LS_ACTIVE, "true");
}

/** Stop encrypting new writes (key stays configured for reading existing encrypted docs). */
export function stopEncryption(): void {
  localStorage.removeItem(LS_ACTIVE);
}

/** True if the derived key is loaded in memory and ready to use. */
export function isEncryptionKeyLoaded(): boolean {
  return _key !== null || !!sessionStorage.getItem(SS_KEY);
}

/**
 * True when encryption is active but the key is not in the current session.
 * In this state the app should show dummy data instead of encrypted gibberish.
 */
export function isEncryptionLocked(): boolean {
  return isEncryptionActive() && _key === null && !sessionStorage.getItem(SS_KEY);
}

// ── Admin Master Key — Recovery ─────────────────────────────────────────────
// Uses a completely separate salt so admin key derivation is isolated from user key derivation.

const ADMIN_SALT = new TextEncoder().encode("iball-admin-recovery-v1-salt");

async function deriveAdminKey(adminPassword: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(adminPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ADMIN_SALT, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt the user's raw key with the admin master key.
 * The result (recovery blob) is stored in Firestore and is useless without the admin key.
 */
export async function createRecoveryBlob(userRawKey: string, adminPassword: string): Promise<string> {
  const adminKey = await deriveAdminKey(adminPassword);
  return aesEncrypt(userRawKey, adminKey);
}

/**
 * Decrypt a recovery blob using the admin master key to reveal the original user key.
 * Throws if the admin password is wrong.
 */
export async function decryptRecoveryBlob(blob: string, adminPassword: string): Promise<string> {
  const adminKey = await deriveAdminKey(adminPassword);
  return aesDecrypt(blob, adminKey); // throws on wrong key — AES-GCM auth tag fails
}

// ── Document-level helpers ───────────────────────────────────────────────────

/** Encrypt a plain object for Firestore. Only encrypts when the user has explicitly started encryption. */
// Fields preserved at root so Firestore indexed queries still work on encrypted docs.
// These are foreign-key / filter fields — not sensitive business data.
const QUERY_FIELDS = ["userId", "purchaseBillId", "billId", "purchaseReturnId", "partyId", "date", "snCounter"] as const;

export async function encryptDoc(data: Record<string, any>): Promise<Record<string, any>> {
  if (!isEncryptionActive()) return data; // not started → pass through unchanged
  const loaded = await initEncryptionKey();
  // Encryption is active but the key isn't available — never write plaintext over encrypted
  // data. Throw so callers surface an error instead of silently corrupting Firestore docs.
  if (!loaded || !_key) throw new Error("Data is locked — enter your DEK before saving.");
  const enc = await aesEncrypt(JSON.stringify(data), _key);
  const result: Record<string, any> = { _e: enc };
  for (const field of QUERY_FIELDS) {
    if (data[field] !== undefined) result[field] = data[field];
  }
  return result;
}

/** Decrypt a Firestore document. Passes through plain (unencrypted) documents unchanged. */
export async function decryptDoc(
  raw: Record<string, any> | undefined | null,
): Promise<Record<string, any>> {
  if (!raw) return {};
  if (!raw._e) return raw; // not encrypted — backward compatible
  const loaded = await initEncryptionKey();
  if (!loaded || !_key) return {}; // key not available
  try {
    return JSON.parse(await aesDecrypt(raw._e as string, _key));
  } catch {
    return {}; // wrong key or corrupted
  }
}
