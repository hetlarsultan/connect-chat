// Client-side lock for the private messages section.
// Password hash + salt is stored per-user in localStorage (device-local).
// Unlock state is per-tab/session (sessionStorage).

const LS_KEY = (uid: string) => `pm_lock_v1_${uid}`;
const SS_KEY = (uid: string) => `pm_unlocked_v1_${uid}`;

type LockConfig = { salt: string; hash: string };

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getLockConfig(userId: string): LockConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY(userId));
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}

export function isLockEnabled(userId: string): boolean {
  return !!getLockConfig(userId);
}

export async function setLockPassword(userId: string, password: string): Promise<void> {
  const salt = randomSalt();
  const hash = await sha256(salt + ":" + password);
  localStorage.setItem(LS_KEY(userId), JSON.stringify({ salt, hash }));
  sessionStorage.setItem(SS_KEY(userId), "1");
}

export async function verifyLockPassword(userId: string, password: string): Promise<boolean> {
  const cfg = getLockConfig(userId);
  if (!cfg) return false;
  const hash = await sha256(cfg.salt + ":" + password);
  return hash === cfg.hash;
}

export function clearLock(userId: string): void {
  localStorage.removeItem(LS_KEY(userId));
  sessionStorage.removeItem(SS_KEY(userId));
}

export function isUnlocked(userId: string): boolean {
  if (!isLockEnabled(userId)) return true;
  return sessionStorage.getItem(SS_KEY(userId)) === "1";
}

export function markUnlocked(userId: string): void {
  sessionStorage.setItem(SS_KEY(userId), "1");
}

export function lockNow(userId: string): void {
  sessionStorage.removeItem(SS_KEY(userId));
}
