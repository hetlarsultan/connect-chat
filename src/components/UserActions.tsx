import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { User, MessageCircle, UserPlus, X } from "lucide-react";
import type { Profile } from "@/lib/use-auth";
import { Avatar } from "./Avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";

export function UserActionsDialog({ profile, open, onOpenChange }: { profile: Profile | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  if (!profile) return null;
  const isSelf = user?.id === profile.id;

  async function sendFriendRequest() {
    if (!user || !profile) return;
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: profile.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("سبق أن أرسلت طلب صداقة");
      else toast.error("تعذر إرسال الطلب");
    } else {
      toast.success("تم إرسال طلب الصداقة");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-sm">
        <DialogTitle className="sr-only">خيارات المستخدم</DialogTitle>
        <button onClick={() => onOpenChange(false)} className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <Avatar profile={profile} size="lg" />
          <div>
            <h3 className="font-bold text-lg" style={{ color: profile.name_color }}>{profile.username}</h3>
            <p className="text-xs text-muted-foreground">{profile.gender === "male" ? "ذكر" : profile.gender === "female" ? "أنثى" : ""} {profile.age ? `• ${profile.age} سنة` : ""}</p>
            {profile.bio && <p className="text-xs text-muted-foreground italic mt-1">"{profile.bio}"</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Link to="/profile/$userId" params={{ userId: profile.id }} onClick={() => onOpenChange(false)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-background hover:bg-accent transition-colors">
            <User className="size-5 text-primary" />
            <span className="text-[10px] font-semibold">الملف</span>
          </Link>
          {!isSelf && (
            <>
              <Link to="/messages/$userId" params={{ userId: profile.id }} onClick={() => onOpenChange(false)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-background hover:bg-accent transition-colors">
                <MessageCircle className="size-5 text-secondary" />
                <span className="text-[10px] font-semibold">رسالة خاصة</span>
              </Link>
              <button onClick={sendFriendRequest} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-background hover:bg-accent transition-colors">
                <UserPlus className="size-5 text-primary-glow" />
                <span className="text-[10px] font-semibold">صداقة</span>
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
