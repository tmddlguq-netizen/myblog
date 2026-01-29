-- 이메일 공개 여부
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_public boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.email_public IS '이메일 공개 여부 (true: 공개, false: 비공개)';

-- 프로필 사진용 Storage 버킷 (Supabase 대시보드에서 생성하거나 아래 SQL로)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- avatars 버킷 정책: 인증된 사용자만 업로드, 공개 읽기
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
