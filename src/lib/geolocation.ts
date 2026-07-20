import { supabase } from "@/integrations/supabase/client";

type GeoCache = { country: string; country_code: string; ts: number };
const KEY = "user_geo_v1";

async function fetchGeo(): Promise<{ country: string; country_code: string } | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.country_name || !j?.country_code) return null;
    return { country: String(j.country_name), country_code: String(j.country_code).toUpperCase() };
  } catch {
    return null;
  }
}

export async function detectAndSaveCountry(userId: string, force = false): Promise<void> {
  try {
    const cachedRaw = localStorage.getItem(KEY);
    const cached: GeoCache | null = cachedRaw ? JSON.parse(cachedRaw) : null;
    const fresh = cached && Date.now() - cached.ts < 7 * 24 * 3600 * 1000;
    let geo = fresh ? { country: cached!.country, country_code: cached!.country_code } : await fetchGeo();
    if (!geo) return;
    if (!fresh) localStorage.setItem(KEY, JSON.stringify({ ...geo, ts: Date.now() }));
    if (force || !fresh) {
      await supabase.from("profiles").update({ country: geo.country, country_code: geo.country_code }).eq("id", userId);
    }
  } catch {}
}

export function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return "🌍";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}
