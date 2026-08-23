/**
 * Tiny in-memory TTL cache so navigating between pages repaints instantly
 * from memory instead of re-hitting the network every mount.
 */
type Entry = { value: unknown; ts: number };

const store = new Map<string, Entry>();

export function getCached<T>(key: string, ttlMs: number): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() - e.ts > ttlMs) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function setCached(key: string, value: unknown) {
  store.set(key, { value, ts: Date.now() });
}

/** Return cached value immediately (if any) and refresh in background. */
export async function swr<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onData: (v: T) => void,
): Promise<void> {
  const cached = getCached<T>(key, ttlMs);
  if (cached !== undefined) onData(cached);
  const fresh = await fetcher();
  setCached(key, fresh);
  onData(fresh);
}
