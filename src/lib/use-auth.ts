import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectAndSaveCountry } from "./geolocation";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  age: number | null;
  gender: "male" | "female" | null;
  bio: string;
  avatar_url: string | null;
  name_color: string;
  text_color: string;
  is_guest: boolean;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  country: string | null;
  country_code: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void loadProfile(session.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void loadProfile(session.user.id).then((p) => {
          setProfile(p);
          setLoading(false);
        });
        // Bump last_seen so retention cleanup keeps active accounts
        void supabase.from("profiles").update({ last_seen: new Date().toISOString(), is_online: true }).eq("id", session.user.id);
        // Detect country (cached, updates weekly)
        void detectAndSaveCountry(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, loading, refreshProfile: async () => {
    if (user) setProfile(await loadProfile(user.id));
  }};
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data as Profile | null;
}
