/**
 * مراقبة عمليات المكافآت في الخلفية:
 * تُشعر المستخدم داخل التطبيق عندما تنتقل أي عملية من «قيد المراجعة»
 * إلى «ناجح» أو «فشل» حتى وهو خارج صفحة /earn.
 * لا تعمل داخل /earn لتفادي تكرار الإشعار.
 */
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

const POLL_MS = 30_000;

export function useRewardWatch() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onEarn = pathname.startsWith("/earn");

  useEffect(() => {
    if (!user || onEarn) return;
    let stopped = false;

    const check = async () => {
      if (document.hidden) return;
      const { data } = await supabase
        .from("ad_reward_transactions")
        .select("id,transaction_id,reward_amount,verification_status,credit_status,notified_at")
        .eq("user_id", user.id)
        .is("notified_at", null)
        .limit(20);
      if (stopped || !data?.length) return;

      const credited = data.filter((r) => r.credit_status === "credited");
      const failed = data.filter(
        (r) => r.credit_status !== "credited" && (r.verification_status === "failed" || r.verification_status === "cancelled"),
      );
      if (credited.length) {
        toast.success(
          credited.length === 1
            ? `تم التحقق من مشاهدتك وأُضيفت مكافأتك (${Number(credited[0]!.reward_amount).toFixed(4)}) إلى محفظتك.`
            : `تم التحقق من ${credited.length} عمليات وأُضيفت مكافآتها إلى محفظتك.`,
        );
      }
      if (failed.length) {
        toast.error(
          failed.length === 1
            ? "لم يكتمل التحقق من إحدى عمليات المشاهدة، ولم يُضف أي رصيد."
            : `لم يكتمل التحقق من ${failed.length} عمليات مشاهدة، ولم يُضف أي رصيد.`,
        );
      }
      const done = [...credited, ...failed].map((r) => r.id);
      if (done.length) {
        await supabase
          .from("ad_reward_transactions")
          .update({ notified_at: new Date().toISOString() })
          .in("id", done);
      }
    };

    void check();
    const t = setInterval(() => void check(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [user, onEarn]);
}
