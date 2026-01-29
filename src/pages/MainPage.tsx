import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Eye, User as UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getRelativeTimeString, getRandomGradient } from '@/lib/dateUtils';

interface Post {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  tags: string[] | null;
  views: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_id: string;
  profiles?: {
    nickname: string;
    avatar_url: string | null;
  };
}

type SortOption = 'latest' | 'popular';

const POSTS_PER_PAGE = 12;

// 태그 색상 배열
const tagColors = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
];

const getTagColor = (tag: string, index: number) => {
  return tagColors[index % tagColors.length];
};

// 스켈레톤 카드
const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <Skeleton className="h-56 w-full" />
    <CardContent className="p-5 space-y-4">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center gap-3 pt-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex gap-6">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-12" />
      </div>
    </CardContent>
  </Card>
);

export const MainPage = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [page, setPage] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchPosts = async (pageNum: number, sort: SortOption, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      let query = supabase
        .from('posts')
        .select('*')
        .eq('is_public', true)
        .range(pageNum * POSTS_PER_PAGE, (pageNum + 1) * POSTS_PER_PAGE - 1);

      if (sort === 'latest') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('likes_count', { ascending: false });
      }

      const { data: postsData, error } = await query;

      if (error) throw error;

      if (!postsData || postsData.length === 0) {
        if (append) {
          setHasMore(false);
        } else {
          setPosts([]);
          setHasMore(false);
        }
        return;
      }

      const userIds = [...new Set(postsData.map((p) => p.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url')
        .in('id', userIds);

      const profilesMap: Record<string, { nickname: string; avatar_url: string | null }> = {};
      for (const p of profilesData ?? []) {
        profilesMap[p.id] = { nickname: p.nickname ?? '', avatar_url: p.avatar_url ?? null };
      }

      const postsWithProfiles = postsData.map((post) => ({
        ...post,
        profiles: profilesMap[post.user_id] ?? null,
      }));

      if (append) {
        setPosts((prev) => [...prev, ...postsWithProfiles]);
      } else {
        setPosts(postsWithProfiles);
      }
      setHasMore(postsData.length === POSTS_PER_PAGE);
    } catch (error) {
      console.error('게시글 불러오기 오류:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 무한 스크롤
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && hasMore && !loadingMore) {
      setPage(prev => prev + 1);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  // 초기 로드
  useEffect(() => {
    setPage(0);
    setPosts([]);
    setHasMore(true);
    fetchPosts(0, sortBy, false);
  }, [sortBy]);

  // 페이지 변경 시 추가 로드
  useEffect(() => {
    if (page > 0) {
      fetchPosts(page, sortBy, true);
    }
  }, [page]);

  // 정렬 변경
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
  };

  if (loading && posts.length === 0) {
    return (
      <div className="container mx-auto px-6 py-20 max-w-7xl">
        <div className="mb-12 text-center">
          <Skeleton className="h-12 w-64 mb-4 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-20 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-12">
        <div className="mb-8">
          <h1 className="text-5xl font-bold tracking-tight mb-3 text-center">최근 게시글</h1>
          <p className="text-lg text-muted-foreground text-center">
            myblog의 다양한 글들을 둘러보세요
          </p>
        </div>
        
        {/* 정렬 옵션 */}
        <div className="flex gap-3 justify-end items-center">
          <span className="text-sm text-muted-foreground mr-2">정렬</span>
          <Button
            variant={sortBy === 'latest' ? 'default' : 'outline'}
            size="default"
            onClick={() => handleSortChange('latest')}
            className="min-w-[100px]"
          >
            최신순
          </Button>
          <Button
            variant={sortBy === 'popular' ? 'default' : 'outline'}
            size="default"
            onClick={() => handleSortChange('popular')}
            className="min-w-[100px]"
          >
            인기순
          </Button>
        </div>
      </div>

      {/* 게시글 그리드 */}
      {posts.length === 0 ? (
        <div className="w-full min-h-[calc(100vh-18rem)] flex items-center justify-center border-t border-b">
          <div className="text-center space-y-4">
            <div className="text-6xl mb-6">📝</div>
            <h3 className="text-2xl font-semibold text-muted-foreground">아직 게시글이 없습니다.</h3>
            <p className="text-base text-muted-foreground">첫 번째 글을 작성해보세요!</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} to={`/post/${post.id}`} className="block h-full">
                <Card className="h-full overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group border-muted">
                  {/* 이미지 또는 그라데이션 */}
                  <div className="relative h-56 overflow-hidden">
                    {post.image_url ? (
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div
                        className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                        style={{ background: getRandomGradient(post.id) }}
                      />
                    )}
                  </div>

                  <CardContent className="p-5 space-y-4">
                    {/* 제목 */}
                    <h2 className="text-2xl font-bold line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>

                    {/* 내용 미리보기 */}
                    <p className="text-base text-muted-foreground line-clamp-2">
                      {post.content}
                    </p>

                    {/* 태그 */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.tags.slice(0, 3).map((tag, index) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className={`text-xs px-3 py-1 ${getTagColor(tag, index)}`}
                          >
                            #{tag}
                          </Badge>
                        ))}
                        {post.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs px-3 py-1">
                            +{post.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* 작성자 정보 */}
                    <div className="flex items-center gap-3 pt-3 border-t">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-base font-semibold">
                        {post.profiles?.avatar_url ? (
                          <img
                            src={post.profiles.avatar_url}
                            alt={post.profiles.nickname}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <UserIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium truncate">
                          {post.profiles?.nickname || '익명'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getRelativeTimeString(post.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* 통계 */}
                    <div className="flex items-center gap-6 text-base text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Heart className="w-5 h-5" />
                        <span>{post.likes_count}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageCircle className="w-5 h-5" />
                        <span>{post.comments_count}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-5 h-5" />
                        <span>{post.views}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* 무한 스크롤 트리거 */}
          <div ref={observerTarget} className="mt-12">
            {loadingMore && (
              <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}
          </div>

          {!hasMore && posts.length > 0 && (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">모든 게시글을 불러왔습니다.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
