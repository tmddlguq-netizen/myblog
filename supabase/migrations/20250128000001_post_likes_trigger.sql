-- 한 사람당 한 글에 한 번만 좋아요 가능
ALTER TABLE public.likes
DROP CONSTRAINT IF EXISTS likes_post_id_user_id_key;
ALTER TABLE public.likes
ADD CONSTRAINT likes_post_id_user_id_key UNIQUE (post_id, user_id);

-- 좋아요 시 posts.likes_count 자동 갱신
CREATE OR REPLACE FUNCTION public.update_posts_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS posts_likes_count_trigger ON public.likes;
CREATE TRIGGER posts_likes_count_trigger
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_posts_likes_count();
