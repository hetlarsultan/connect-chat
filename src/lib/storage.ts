import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, TEN_YEARS);
  if (sErr || !data) throw sErr ?? new Error("signed url failed");
  return data.signedUrl;
}

export async function uploadPrivateImage(senderId: string, receiverId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${senderId}/${receiverId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("private-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export async function getPrivateImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("private-images").createSignedUrl(path, 120);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deletePrivateImage(path: string): Promise<void> {
  await supabase.storage.from("private-images").remove([path]);
}
