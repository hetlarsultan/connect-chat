import type { Profile } from "@/lib/use-auth";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
};

export function Avatar({ profile, size = "md", onClick, ring = true }: { profile: Pick<Profile, "username" | "avatar_url" | "name_color" | "gender" | "is_online">; size?: keyof typeof sizes; onClick?: () => void; ring?: boolean }) {
  const initial = profile.username?.charAt(0)?.toUpperCase() ?? "؟";
  const ringClass = ring ? "ring-2 ring-offset-2 ring-offset-background" : "";
  const ringColor = profile.gender === "female" ? "ring-pink-400/60" : "ring-primary/60";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative ${sizes[size]} rounded-full overflow-hidden font-bold flex items-center justify-center shrink-0 ${ringClass} ${ringColor} ${onClick ? "cursor-pointer hover:scale-105 transition-transform" : "cursor-default"}`}
      style={{ backgroundColor: profile.name_color }}
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username} className="size-full object-cover" />
      ) : (
        <span className="text-white">{initial}</span>
      )}
      {profile.is_online && (
        <span className="absolute bottom-0 left-0 size-2.5 rounded-full bg-green-400 ring-2 ring-background" />
      )}
    </button>
  );
}
