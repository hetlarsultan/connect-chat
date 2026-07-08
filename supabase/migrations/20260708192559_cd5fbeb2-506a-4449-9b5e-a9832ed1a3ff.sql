
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_snippet text,
  ADD COLUMN IF NOT EXISTS reply_username text;

ALTER TABLE public.private_messages
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

-- Storage policies (buckets created via tool)
-- Avatars: public read, owner write in folder named after their uid
CREATE POLICY "avatars_read_all"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Private images: only sender (folder[1]) and receiver (folder[2]) can read; only sender writes/deletes
CREATE POLICY "pmimg_read_participants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'private-images' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      auth.uid()::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "pmimg_insert_sender"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'private-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pmimg_delete_participant"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'private-images' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      auth.uid()::text = (storage.foldername(name))[2]
    )
  );
