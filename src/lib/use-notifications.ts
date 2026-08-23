import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type NotificationCounts = {
  unreadMessages: number;
  friendRequests: number;
  activeRooms: number;
};

/* Shared singleton: one realtime channel + one count query for the whole
 * app, no matter how many navbars/badges call the hook. */

let counts: NotificationCounts = { unreadMessages: 0, friendRequests: 0, activeRooms: 0 };
const listeners = new Set<(c: NotificationCounts) => void>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let boundUserId: string | null = null;
let inFlight: Promise<void> | null = null;
let lastFetch = 0;

function emit(next: NotificationCounts) {
  if (
    next.unreadMessages === counts.unreadMessages &&
    next.friendRequests === counts.friendRequests &&
    next.activeRooms === counts.activeRooms
  )
    return;
  counts = next;
  for (const l of listeners) l(counts);
}

async function refresh(userId: string, force = false) {
  if (!force && Date.now() - lastFetch < 4000) return;
  if (inFlight) return inFlight;
  lastFetch = Date.now();
  inFlight = (async () => {
    const [pm, fr] = await Promise.all([
      supabase
        .from("private_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("read", false),
      supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", userId)
        .eq("status", "pending"),
    ]);
    emit({ ...counts, unreadMessages: pm.count ?? 0, friendRequests: fr.count ?? 0 });
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function bind(userId: string) {
  if (boundUserId === userId && channel) return;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  boundUserId = userId;
  void refresh(userId, true);

  const ch = supabase.channel(`notif:${userId}`);
  ch.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "private_messages", filter: `receiver_id=eq.${userId}` },
    () => void refresh(userId),
  );
  ch.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${userId}` },
    () => void refresh(userId),
  );
  ch.subscribe();
  channel = ch;
}

export function useNotifications() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<NotificationCounts>(counts);

  useEffect(() => {
    listeners.add(setSnap);
    setSnap(counts);
    if (user) bind(user.id);
    return () => {
      listeners.delete(setSnap);
    };
  }, [user]);

  return snap;
}
