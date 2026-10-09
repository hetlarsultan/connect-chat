/**
 * إشعارات للمالك فقط: عند التحقق من أي عملية مكافأة أو فشلها، يظهر إشعار
 * بالحالة وهل أُضيف الرصيد إلى المحفظة. القراءة محمية بدور المالك في قاعدة البيانات.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

const POLL_MS = 30_000;
const KEY = "owner_reward_watch_since_v1";

export function useOwnerRewardWatch() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let isOwner = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      if (document.hidden || !isOwner) return;
      const since = localStorage.getItem(KEY) ?? new Date().toISOString();
      const { data } = await supabase
        .from("ad_reward_transactions")
        .select("transaction_id,reward_amount,verification_status,credit_status,updated_at")
        .gt("updated_at", since)
        .order("updated_at", { ascending: true })
        .limit(20);
      if (stopped || !data) return;
      for (const r of data) {
        const credited = r.credit_status === "credited";
        const failed = r.verification_status === "failed" || r.verification_status === "cancelled";
        if (!credited && !failed) continue;
        const short = r.transaction_id.slice(0, 12);
        const text = `العملية ${short}… — الحالة: ${credited ? "تم التحقق" : "فشل التحقق"} — المحفظة: ${
          credited ? `أُضيف ${Number(r.reward_amount).toFixed(4)}` : "لم يُضف رصيد"
        }`;
        if (credited) toast.success(`المالك: ${text}`);
        else toast.error(`المالك: ${text}`);
      }
      const last = data[data.length - 1]?.updated_at;
      localStorage.setItem(KEY, last ?? since);
    };

    void (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (stopped || !data) return;
      isOwner = true;
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, new Date().toISOString());
      void check();
      timer = setInterval(() => void check(), POLL_MS);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [user]);
}
