import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Heart, MessageCircle, Eye, User as UserIcon, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card } from '@/components/ui/card';
import { getRelativeTimeString, getRandomGradient } from '@/lib/dateUtils';
import { highlightText, escapeForLike } from '@/lib/searchUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface PostRow {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views: number;
  user_id: string;
  profiles: { nickname: string; avatar_url: string | null } | null;
}

interface ProfileRow {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const CONTENT_SNIPPET_LEN = 120;

export const SearchPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) {
      setPosts([]);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const pattern = `%${escapeForLike(q)}%`;
    const patternQuoted = `"${pattern.replace(/"/g, '""')}"`;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [postsRes, profilesRes] = await Promise.all([
          supabase
            .from('posts')
            .select('id, title, content, image_url, created_at, likes_count, comments_count, views, user_id')
            .eq('is_public', true)
            .or(`title.ilike.${patternQuoted},content.ilike.${patternQuoted}`)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('profiles')
            .select('id, nickname, avatar_url, bio')
            .ilike('nickname', pattern)
            .limit(20),
        ]);

        if (postsRes.error) throw postsRes.error;
        if (profilesRes.error) throw profilesRes.error;

        const postsRaw = (postsRes.data ?? []) as (Omit<PostRow, 'profiles'> & { user_id: string })[];
        const userIds = [...new Set(postsRaw.map((p) => p.user_id).filter(Boolean))];
        const { data: profileList } =
          userIds.length > 0
            ? await supabase.from('profiles').select('id, nickname, avatar_url').in('id', userIds)
            : { data: [] };

        const profilesMap: Record<string, { nickname: string; avatar_url: string | null }> = {};
        for (const p of profileList ?? []) {
          profilesMap[p.id] = { nickname: p.nickname ?? '', avatar_url: p.avatar_url ?? null };
        }

        const postsWithProfiles: PostRow[] = postsRaw.map((post) => ({
          ...post,
          profiles: profilesMap[post.user_id] ?? null,
        }));

        setPosts(postsWithProfiles);
        setProfiles((profilesRes.data ?? []) as ProfileRow[]);
      } catch (err) {
        console.error('검색 오류:', err);
        setPosts([]);
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [q]);

  if (!q) {
    return (
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <p className="text-center text-muted-foreground">검색어를 입력하세요.</p>
      </div>
    );
  }

  const snippet = (text: string) => {
    const plain = text.replace(/\s+/g, ' ').trim();
    if (plain.length <= CONTENT_SNIPPET_LEN) return plain;
    const idx = plain.toLowerCase().indexOf(q.toLowerCase());
    const start = idx >= 0 ? Math.max(0, idx - 30) : 0;
    const slice = plain.slice(start, start + CONTENT_SNIPPET_LEN);
    return (start > 0 ? '…' : '') + slice + (start + CONTENT_SNIPPET_LEN < plain.length ? '…' : '');
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">
        &quot;<span className="text-primary">{q}</span>&quot; 검색 결과
      </h1>
      <p className="text-muted-foreground mb-8">글 결과 {posts.length}건, 작성자 결과 {profiles.length}건</p>

      {loading ? (
        <div className="space-y-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-8 w-32 mt-8" />
          <div className="grid gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 글 결과 */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5" />
              글 결과
            </h2>
            {posts.length === 0 ? (
              <p className="text-muted-foreground py-6">해당하는 글이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Link key={post.id} to={`/post/${post.id}`}>
                    <Card className="overflow-hidden border-muted hover:shadow-md transition-shadow">
                      <div className="flex gap-4 p-4">
                        <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-muted">
                          {post.image_url ? (
                            <img
                              src={post.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ background: getRandomGradient(post.id) }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg line-clamp-1 mb-1">
                            {highlightText(post.title, q)}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {highlightText(snippet(post.content), q)}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            {post.profiles?.avatar_url ? (
                              <img
                                src={post.profiles.avatar_url}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: getRandomGradient(post.user_id) }}
                              >
                                {(post.profiles?.nickname || '?').slice(0, 1)}
                              </div>
                            )}
                            <span>{post.profiles?.nickname || '익명'}</span>
                            <span>{getRelativeTimeString(post.created_at)}</span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-4 w-4" /> {post.likes_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-4 w-4" /> {post.comments_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" /> {post.views}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 작성자 결과 */}
          <section>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <UserIcon className="h-5 w-5" />
              작성자 결과
            </h2>
            {profiles.length === 0 ? (
              <p className="text-muted-foreground py-6">해당하는 작성자가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => {
                  const isMe = user?.id === profile.id;
                  const to = isMe ? '/mypage' : `/search?q=${encodeURIComponent(profile.nickname || '')}`;
                  return (
                  <Link
                    key={profile.id}
                    to={to}
                    className="block"
                  >
                    <Card className="border-muted hover:shadow-md transition-shadow p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span
                            className="w-full h-full flex items-center justify-center text-lg font-bold text-white"
                            style={{ background: getRandomGradient(profile.id) }}
                          >
                            {(profile.nickname || '?').slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {highlightText(profile.nickname || '익명', q)}
                        </p>
                        {profile.bio && (
                          <p className="text-sm text-muted-foreground truncate">{profile.bio}</p>
                        )}
                      </div>
                    </Card>
                  </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
