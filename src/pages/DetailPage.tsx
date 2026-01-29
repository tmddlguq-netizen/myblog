import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  CalendarClock,
  Edit,
  Trash2,
  Heart,
  MessageCircle,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getRelativeTimeString, getRandomGradient } from '@/lib/dateUtils';

const COMMENTS_PAGE_SIZE = 20;
const COMMENT_MAX_LENGTH = 1000;

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  user_id: string;
  likes_count: number;
}

interface ProfileRow {
  nickname: string | null;
  avatar_url: string | null;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  likes_count: number;
  deleted_at: string | null;
  profiles: ProfileRow | null;
}

/** 댓글 또는 답글(대댓글 포함). parent 있으면 답글의 답글 */
type ReplyItem = CommentRow & { parent?: CommentRow | null };
type CommentWithReplies = CommentRow & { replies: ReplyItem[] };

export const DetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentPage, setCommentPage] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [postLiked, setPostLiked] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPost();
    }
  }, [id]);

  useEffect(() => {
    if (id && user) {
      fetchPostLiked();
    } else if (!user) {
      setPostLiked(false);
    }
  }, [id, user]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      setPost(data);
    } catch (error) {
      console.error('게시글 불러오기 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostLiked = async () => {
    if (!user || !id) return;
    try {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      setPostLiked(!!data);
    } catch {
      setPostLiked(false);
    }
  };

  const fetchMyLikedComments = useCallback(async () => {
    if (!user || !id) return new Set<string>();
    const { data } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', user.id);
    const ids = new Set((data || []).map((r: { comment_id: string }) => r.comment_id));
    return ids;
  }, [user, id]);

  const fetchComments = useCallback(
    async (page: number, append: boolean) => {
      if (!id) return;
      setCommentsLoading(true);
      try {
        const from = page * COMMENTS_PAGE_SIZE;
        const to = from + COMMENTS_PAGE_SIZE - 1;
        const { data: topLevel, error: topError } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', id)
          .is('parent_id', null)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (topError) throw topError;
        const list = (topLevel || []) as CommentRow[];
        setHasMoreComments(list.length === COMMENTS_PAGE_SIZE);

        if (list.length === 0) {
          if (append) return;
          setComments([]);
          setCommentsLoading(false);
          return;
        }

        const parentIds = list.map((c) => c.id);
        const { data: repliesData } = await supabase
          .from('comments')
          .select('*')
          .in('parent_id', parentIds)
          .order('created_at', { ascending: false });

        const directReplies = (repliesData || []) as CommentRow[];
        const directReplyIds = directReplies.map((r) => r.id);
        let nestedReplies: CommentRow[] = [];
        if (directReplyIds.length > 0) {
          const { data: nestedData } = await supabase
            .from('comments')
            .select('*')
            .in('parent_id', directReplyIds)
            .order('created_at', { ascending: false });
          nestedReplies = (nestedData || []) as CommentRow[];
        }

        const allUserIds = new Set<string>();
        list.forEach((c) => allUserIds.add(c.user_id));
        directReplies.forEach((r) => allUserIds.add(r.user_id));
        nestedReplies.forEach((r) => allUserIds.add(r.user_id));
        const userIds = Array.from(allUserIds);
        const profilesMap = new Map<string, ProfileRow>();
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, nickname, avatar_url')
            .in('id', userIds);
          for (const p of (profilesData || []) as { id: string; nickname: string | null; avatar_url: string | null }[]) {
            profilesMap.set(p.id, { nickname: p.nickname, avatar_url: p.avatar_url });
          }
        }

        const attachProfiles = (c: CommentRow): CommentRow => ({
          ...c,
          profiles: profilesMap.get(c.user_id) ?? null,
        });
        const directReplyMap = new Map<string, CommentRow>();
        directReplies.forEach((r) => directReplyMap.set(r.id, attachProfiles(r)));

        const withReplies: CommentWithReplies[] = list.map((c) => {
          const direct = directReplies.filter((r) => r.parent_id === c.id).map(attachProfiles);
          const directIds = direct.map((r) => r.id);
          const nested = nestedReplies
            .filter((n) => directIds.includes(n.parent_id!))
            .map((n) => ({
              ...attachProfiles(n),
              parent: directReplyMap.get(n.parent_id!),
            }));
          const flatReplies: ReplyItem[] = [
            ...direct.map((r) => ({ ...r, parent: null })),
            ...nested,
          ].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          return {
            ...attachProfiles(c),
            replies: flatReplies,
          };
        });

        const myLiked = await fetchMyLikedComments();
        setLikedCommentIds(myLiked);

        if (append) {
          setComments((prev) => [...prev, ...withReplies]);
        } else {
          setComments(withReplies);
        }
      } catch (e) {
        console.error('댓글 불러오기 오류:', e);
        toast.error('댓글을 불러오지 못했습니다.');
      } finally {
        setCommentsLoading(false);
      }
    },
    [id, fetchMyLikedComments]
  );

  useEffect(() => {
    if (id && !loading && post) {
      fetchComments(0, false);
    }
  }, [id, post, loading]);

  const loadMoreComments = () => {
    const next = commentPage + 1;
    setCommentPage(next);
    fetchComments(next, true);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    const content = commentInput.trim();
    if (!content) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }
    if (content.length > COMMENT_MAX_LENGTH) {
      toast.error(`댓글은 ${COMMENT_MAX_LENGTH}자 이하여야 합니다.`);
      return;
    }
    setCommentSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: id,
        user_id: user.id,
        content,
        parent_id: null,
      });
      if (error) throw error;
      setCommentInput('');
      toast.success('댓글이 작성되었습니다.');
      fetchComments(0, false);
    } catch (err) {
      console.error(err);
      toast.error('댓글 작성에 실패했습니다.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!user || !id) return;
    const content = replyInput.trim();
    if (!content || content.length > COMMENT_MAX_LENGTH) {
      toast.error(`댓글은 1~${COMMENT_MAX_LENGTH}자로 입력해주세요.`);
      return;
    }
    setReplySubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: id,
        user_id: user.id,
        content,
        parent_id: parentId,
      });
      if (error) throw error;
      setReplyInput('');
      setReplyToId(null);
      toast.success('답글이 작성되었습니다.');
      fetchComments(0, false);
    } catch (err) {
      console.error(err);
      toast.error('답글 작성에 실패했습니다.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleToggleLike = async (commentId: string) => {
    if (!user) return;
    const liked = likedCommentIds.has(commentId);
    try {
      if (liked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        setLikedCommentIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, likes_count: Math.max(0, c.likes_count - 1) };
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, likes_count: Math.max(0, r.likes_count - 1) } : r
              ),
            };
          })
        );
      } else {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
        setLikedCommentIds((prev) => new Set(prev).add(commentId));
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, likes_count: c.likes_count + 1 };
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, likes_count: r.likes_count + 1 } : r
              ),
            };
          })
        );
      }
    } catch (err) {
      console.error(err);
      toast.error('처리하지 못했습니다.');
    }
  };

  const handleStartEdit = (comment: CommentRow) => {
    setEditCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editCommentId || !editContent.trim() || editContent.length > COMMENT_MAX_LENGTH) return;
    setEditSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editContent.trim() })
        .eq('id', editCommentId)
        .eq('user_id', user!.id);
      if (error) throw error;
      setEditCommentId(null);
      setEditContent('');
      toast.success('댓글이 수정되었습니다.');
      fetchComments(0, false);
    } catch (err) {
      console.error(err);
      toast.error('수정에 실패했습니다.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', user!.id);
      if (error) throw error;
      toast.success('댓글이 삭제되었습니다.');
      fetchComments(0, false);
    } catch (err) {
      console.error(err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('삭제 오류:', error);
    }
  };

  const handlePostLike = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!post || !id) return;
    setHeartAnimating(true);
    setTimeout(() => setHeartAnimating(false), 300);
    try {
      if (postLiked) {
        await supabase.from('likes').delete().eq('post_id', id).eq('user_id', user.id);
        setPostLiked(false);
        setPost((prev) =>
          prev ? { ...prev, likes_count: Math.max(0, prev.likes_count - 1) } : null
        );
      } else {
        await supabase.from('likes').insert({ post_id: id, user_id: user.id });
        setPostLiked(true);
        setPost((prev) => (prev ? { ...prev, likes_count: prev.likes_count + 1 } : null));
      }
    } catch (err) {
      console.error(err);
      toast.error('처리하지 못했습니다.');
    }
  };

  const resizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="text-center text-muted-foreground text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <Card className="border-muted">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg">게시글을 찾을 수 없습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAuthor = user?.id === post.user_id;

  const openReplyInput = (comment: CommentRow) => {
    const nickname = comment.profiles?.nickname || '알 수 없음';
    setReplyToId(comment.id);
    setReplyInput(`@${nickname} `);
    setTimeout(() => replyTextareaRef.current?.focus(), 100);
  };

  const CommentBlock = ({
    c,
    isReply,
    parent,
  }: {
    c: CommentRow;
    isReply?: boolean;
    parent?: CommentRow | null;
  }) => {
    const isOwn = user?.id === c.user_id;
    const liked = likedCommentIds.has(c.id);
    const isDeleted = !!c.deleted_at;
    const isEditing = !isDeleted && editCommentId === c.id;

    return (
      <div
        key={c.id}
        className={`flex gap-3 ${isReply ? 'ml-10 mt-3 pl-4 border-l-2 border-muted' : 'py-4 border-b border-muted/50 last:border-0'}`}
      >
        <div
          className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden"
          style={{
            background: c.profiles?.avatar_url ? undefined : getRandomGradient(c.user_id),
          }}
        >
          {c.profiles?.avatar_url ? (
            <img
              src={c.profiles.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-white">
              {(c.profiles?.nickname || '?').slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{c.profiles?.nickname || '알 수 없음'}</span>
            <span className="text-muted-foreground">{getRelativeTimeString(c.created_at)}</span>
          </div>
          {parent && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              ↳ @{parent.profiles?.nickname || '알 수 없음'}
            </p>
          )}
          {isDeleted ? (
            <p className="mt-1 text-base text-muted-foreground italic">삭제된 댓글입니다.</p>
          ) : isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value.slice(0, COMMENT_MAX_LENGTH));
                  resizeTextarea(e.target);
                }}
                onInput={(e) => resizeTextarea(e.currentTarget)}
                rows={3}
                className="min-h-[80px] resize-none"
                maxLength={COMMENT_MAX_LENGTH}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={editSubmitting}>
                  저장
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditCommentId(null);
                    setEditContent('');
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-base">{c.content}</p>
          )}
          {!isEditing && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {!isDeleted && user && (
                <button
                  type="button"
                  onClick={() => handleToggleLike(c.id)}
                  className={`flex items-center gap-1 transition ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
                  <span>{c.likes_count}</span>
                </button>
              )}
              {!isDeleted && !user && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  {c.likes_count}
                </span>
              )}
              {!isDeleted && user && (
                <button
                  type="button"
                  onClick={() => openReplyInput(c)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="h-4 w-4" />
                  답글
                </button>
              )}
              {!isDeleted && isOwn && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(c)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(c.id)}
                    className="text-destructive hover:underline"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <Card className="border-muted">
        <CardHeader className="space-y-6 pb-8">
          <div>
            <CardTitle className="text-4xl font-bold mb-4">{post.title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                작성: {new Date(post.created_at).toLocaleDateString('ko-KR')}
              </span>
              {post.updated_at && post.updated_at !== post.created_at && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="w-5 h-5" />
                  수정: {new Date(post.updated_at).toLocaleDateString('ko-KR')}
                </span>
              )}
            </CardDescription>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handlePostLike}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition-[transform,color,background-color] duration-200 hover:bg-muted/50 ${
                  postLiked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                } ${heartAnimating ? 'scale-110' : 'scale-100'}`}
                aria-label="좋아요"
              >
                <Heart
                  className={`h-6 w-6 transition-transform duration-200 ${
                    postLiked ? 'fill-current' : ''
                  }`}
                />
                <span className="text-base font-medium">
                  {typeof post.likes_count === 'number'
                    ? `${post.likes_count}명이 좋아합니다`
                    : '0명이 좋아합니다'}
                </span>
              </button>
            </div>
          </div>
          {isAuthor && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => navigate(`/edit/${post.id}`)}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                수정
              </Button>
              <Button onClick={handleDeletePost} variant="destructive" size="lg" className="gap-2">
                <Trash2 className="w-4 h-4" />
                삭제
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="prose max-w-none pt-6">
          <div className="text-lg leading-relaxed whitespace-pre-wrap">{post.content}</div>
        </CardContent>
      </Card>

      {/* 댓글 섹션 */}
      <Card className="border-muted mt-8">
        <CardHeader>
          <CardTitle className="text-2xl">댓글</CardTitle>
          <CardDescription>로그인 후 댓글을 작성할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {user && (
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <Textarea
                ref={textareaRef}
                placeholder="댓글을 입력하세요 (최대 1000자)"
                value={commentInput}
                onChange={(e) => {
                  setCommentInput(e.target.value.slice(0, COMMENT_MAX_LENGTH));
                  resizeTextarea(e.target);
                }}
                onInput={(e) => resizeTextarea(e.currentTarget)}
                rows={3}
                className="min-h-[80px] max-h-[200px] resize-none"
                maxLength={COMMENT_MAX_LENGTH}
                disabled={commentSubmitting}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {commentInput.length}/{COMMENT_MAX_LENGTH}
                </span>
                <Button type="submit" disabled={commentSubmitting || !commentInput.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  댓글 작성
                </Button>
              </div>
            </form>
          )}

          <div className="divide-y divide-muted/50">
            {comments.length === 0 && !commentsLoading && (
              <p className="py-8 text-center text-muted-foreground">아직 댓글이 없습니다.</p>
            )}
            {comments.map((c) => (
              <div key={c.id}>
                <CommentBlock c={c} />
                {replyToId === c.id && (
                  <div className="ml-10 mt-3 pl-4 border-l-2 border-muted">
                    <Textarea
                      ref={replyTextareaRef}
                      placeholder="답글 입력 (최대 1000자)"
                      value={replyInput}
                      onChange={(e) =>
                        setReplyInput(e.target.value.slice(0, COMMENT_MAX_LENGTH))
                      }
                      rows={2}
                      className="min-h-[60px] resize-none"
                      maxLength={COMMENT_MAX_LENGTH}
                      disabled={replySubmitting}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSubmitReply(c.id)}
                        disabled={replySubmitting || !replyInput.trim()}
                      >
                        답글 작성
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyToId(null);
                          setReplyInput('');
                        }}
                      >
                        취소
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {replyInput.length}/{COMMENT_MAX_LENGTH}
                      </span>
                    </div>
                  </div>
                )}
                {c.replies.map((r) => (
                  <div key={r.id}>
                    <CommentBlock c={r} isReply parent={(r as ReplyItem).parent} />
                    {replyToId === r.id && (
                      <div className="ml-10 mt-3 pl-4 border-l-2 border-muted">
                        <Textarea
                          ref={replyTextareaRef}
                          placeholder="답글 입력 (최대 1000자)"
                          value={replyInput}
                          onChange={(e) =>
                            setReplyInput(e.target.value.slice(0, COMMENT_MAX_LENGTH))
                          }
                          rows={2}
                          className="min-h-[60px] resize-none"
                          maxLength={COMMENT_MAX_LENGTH}
                          disabled={replySubmitting}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSubmitReply(r.id)}
                            disabled={replySubmitting || !replyInput.trim()}
                          >
                            답글 작성
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyToId(null);
                              setReplyInput('');
                            }}
                          >
                            취소
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {replyInput.length}/{COMMENT_MAX_LENGTH}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {hasMoreComments && comments.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMoreComments}
                disabled={commentsLoading}
              >
                {commentsLoading ? '불러오는 중...' : '댓글 더보기'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
