import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type NotificationCounts = {
  unreadMessages: number;
  friendRequests: number;
  activeRooms: number;
};

export function useNotifications() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    friendRequests: 0,
    activeRooms: 0,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function refresh() {
      if (!user) return;
      const [pm, fr, rooms] = await Promise.all([
        supabase
          .from("private_messages")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("read", false),
        supabase
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .eq("addressee_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("rooms")
          .select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      setCounts({
        unreadMessages: pm.count ?? 0,
        friendRequests: fr.count ?? 0,
        activeRooms: rooms.count ?? 0,
      });
    }

    void refresh();
    const interval = setInterval(refresh, 15000);

    const ch = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages", filter: `receiver_id=eq.${user.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${user.id}` }, () => void refresh())
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [user]);

  return counts;
}
