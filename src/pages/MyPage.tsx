import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Mail,
  User as UserIcon,
  FileText,
  Heart,
  Eye,
  MessageCircle,
  Edit,
  Trash2,
  Lock,
  Globe,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getRandomGradient } from '@/lib/dateUtils';
import { resizeImage, isAllowedImageType, isWithinSizeLimit } from '@/lib/imageUtils';

const AVATAR_BUCKET = 'avatars';
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

type TabType = 'written' | 'liked';
type SortType = 'latest' | 'popular' | 'views';
type FilterType = 'all' | 'public' | 'private';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  views?: number;
  is_public?: boolean;
  user_id: string;
}

export const MyPage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('written');
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedLoading, setLikedLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortType>('latest');
  const [filterBy, setFilterBy] = useState<FilterType>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editEmailPublic, setEditEmailPublic] = useState(true);
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [avatarDrag, setAvatarDrag] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyPosts();
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'liked') {
      fetchLikedPosts();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (editModalOpen && profile) {
      setEditNickname(profile.nickname ?? '');
      setEditBio(profile.bio ?? '');
      setEditEmailPublic(profile.email_public !== false);
      setEditAvatarUrl(profile.avatar_url ?? '');
    }
  }, [editModalOpen, profile]);

  const fetchMyPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('게시글 불러오기 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLikedPosts = async () => {
    if (!user) return;
    setLikedLoading(true);
    try {
      const { data: likeData, error: likeError } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', user.id);

      if (likeError) throw likeError;
      const postIds = (likeData || []).map((r) => r.post_id).filter(Boolean);
      if (postIds.length === 0) {
        setLikedPosts([]);
        setLikedLoading(false);
        return;
      }
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;
      setLikedPosts(postsData || []);
    } catch (error) {
      console.error('좋아요한 글 불러오기 오류:', error);
    } finally {
      setLikedLoading(false);
    }
  };

  const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count ?? 0), 0);

  const filteredAndSortedPosts = useMemo(() => {
    let list = [...posts];
    if (filterBy === 'public') list = list.filter((p) => p.is_public !== false);
    if (filterBy === 'private') list = list.filter((p) => p.is_public === false);
    if (sortBy === 'latest') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortBy === 'popular') list.sort((a, b) => (b.likes_count ?? 0) + (b.comments_count ?? 0) - (a.likes_count ?? 0) - (a.comments_count ?? 0));
    if (sortBy === 'views') list.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    return list;
  }, [posts, filterBy, sortBy]);

  const handleAvatarFile = async (file: File) => {
    if (!user) return;
    if (!isAllowedImageType(file.type)) {
      toast.error('jpg, png, gif, webp 파일만 업로드할 수 있습니다.');
      return;
    }
    if (!isWithinSizeLimit(file.size)) {
      toast.error('파일이 너무 큽니다. (최대 5MB)');
      return;
    }
    setAvatarUploading(true);
    setAvatarProgress(0);
    const progressInterval = setInterval(() => setAvatarProgress((p) => (p >= 90 ? 90 : p + 15)), 100);
    try {
      const blob = await resizeImage(file);
      const path = `${user.id}/${Date.now()}.jpg`;
      await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      setEditAvatarUrl(data.publicUrl);
      toast.success('사진이 변경되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('업로드에 실패했습니다.');
    } finally {
      clearInterval(progressInterval);
      setAvatarProgress(100);
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nickname: editNickname.trim() || null,
          bio: editBio.trim() || null,
          avatar_url: editAvatarUrl.trim() || null,
          email_public: editEmailPublic,
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setEditModalOpen(false);
      toast.success('프로필이 수정되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('저장에 실패했습니다.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user!.id);
      if (error) throw error;
      toast.success('삭제되었습니다.');
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error(err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="text-center text-muted-foreground text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl space-y-8">
      <Card className="border-muted overflow-hidden">
        <div className="bg-muted/30 p-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative group shrink-0">
              <div
                className="h-28 w-28 rounded-full overflow-hidden border-4 border-background shadow-lg flex items-center justify-center bg-muted"
                style={{
                  background: profile?.avatar_url ? undefined : getRandomGradient(user?.id ?? ''),
                }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="프로필" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-white">
                    {(profile?.nickname || '?').slice(0, 1)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-sm"
              >
                변경
              </button>
            </div>
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h2 className="text-2xl font-bold">{profile?.nickname || '닉네임 없음'}</h2>
              {(profile?.email_public !== false) && (
                <div className="flex items-center gap-2 text-muted-foreground justify-center sm:justify-start">
                  <Mail className="h-5 w-5 shrink-0" />
                  <span>{user?.email}</span>
                </div>
              )}
              {profile?.bio && (
                <p className="text-base text-muted-foreground line-clamp-2">{profile.bio}</p>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center sm:justify-start">
                <UserIcon className="h-4 w-4 shrink-0" />
                <span>
                  가입한 날짜:{' '}
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : 'N/A'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 pt-2 justify-center sm:justify-start">
                <div className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">작성한 글</span>
                  <span className="text-muted-foreground">{posts.length}개</span>
                </div>
                <div className="flex items-center gap-2 text-base">
                  <Heart className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">받은 좋아요</span>
                  <span className="text-muted-foreground">{totalLikes}개</span>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={() => setEditModalOpen(true)} size="lg">
                  프로필 편집
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 탭 메뉴 */}
      <Card className="border-muted">
        <div className="border-b border-muted">
          <div className="flex gap-0">
            <button
              type="button"
              onClick={() => setActiveTab('written')}
              className={`px-6 py-4 text-base font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'written'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              작성한 글
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('liked')}
              className={`px-6 py-4 text-base font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'liked'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              좋아요한 글
            </button>
          </div>
        </div>
        <CardContent className="p-6">
          {activeTab === 'written' && (
            <>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <span className="text-sm font-medium text-muted-foreground">필터</span>
                <div className="flex gap-2">
                  {(['all', 'public', 'private'] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filterBy === f ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterBy(f)}
                    >
                      {f === 'all' ? '전체 글' : f === 'public' ? '공개 글' : '비공개 글'}
                    </Button>
                  ))}
                </div>
                <span className="text-sm font-medium text-muted-foreground ml-4">정렬</span>
                <div className="flex gap-2">
                  {(['latest', 'popular', 'views'] as const).map((s) => (
                    <Button
                      key={s}
                      variant={sortBy === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy(s)}
                    >
                      {s === 'latest' ? '최신순' : s === 'popular' ? '인기순' : '조회수순'}
                    </Button>
                  ))}
                </div>
              </div>
              {filteredAndSortedPosts.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">작성한 게시글이 없습니다.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  {filteredAndSortedPosts.map((post) => (
                    <div key={post.id} className="group relative">
                      <Link to={`/post/${post.id}`}>
                        <Card className="h-full border-muted hover:shadow-lg transition-all overflow-hidden">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-lg font-bold line-clamp-2 flex-1">
                                {post.title}
                              </CardTitle>
                              <Badge variant={post.is_public !== false ? 'secondary' : 'outline'} className="shrink-0">
                                {post.is_public !== false ? (
                                  <><Globe className="h-3 w-3 mr-1" /> 공개</>
                                ) : (
                                  <><Lock className="h-3 w-3 mr-1" /> 비공개</>
                                )}
                              </Badge>
                            </div>
                            <CardDescription className="flex items-center gap-1.5 text-sm">
                              <Calendar className="w-4 h-4" />
                              {new Date(post.created_at).toLocaleDateString('ko-KR')}
                            </CardDescription>
                            <div className="flex gap-4 text-sm text-muted-foreground pt-2">
                              <span className="flex items-center gap-1">
                                <Eye className="h-4 w-4" /> {post.views ?? 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="h-4 w-4" /> {post.likes_count ?? 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-4 w-4" /> {post.comments_count ?? 0}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                          </CardContent>
                        </Card>
                      </Link>
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/edit/${post.id}`);
                          }}
                        >
                          <Edit className="h-4 w-4" /> 수정
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => handleDeletePost(post.id, e)}
                        >
                          <Trash2 className="h-4 w-4" /> 삭제
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'liked' && (
            <>
              {likedLoading ? (
                <p className="text-center text-muted-foreground py-12">불러오는 중...</p>
              ) : likedPosts.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">좋아요한 글이 없습니다.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  {likedPosts.map((post) => (
                    <Link key={post.id} to={`/post/${post.id}`}>
                      <Card className="h-full border-muted hover:shadow-lg transition-all overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg font-bold line-clamp-2 flex-1">
                              {post.title}
                            </CardTitle>
                            <Badge variant={post.is_public !== false ? 'secondary' : 'outline'} className="shrink-0">
                              {post.is_public !== false ? <><Globe className="h-3 w-3 mr-1" /> 공개</> : <><Lock className="h-3 w-3 mr-1" /> 비공개</>}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-1.5 text-sm">
                            <Calendar className="w-4 h-4" />
                            {new Date(post.created_at).toLocaleDateString('ko-KR')}
                          </CardDescription>
                          <div className="flex gap-4 text-sm text-muted-foreground pt-2">
                            <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {post.views ?? 0}</span>
                            <span className="flex items-center gap-1"><Heart className="h-4 w-4" /> {post.likes_count ?? 0}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> {post.comments_count ?? 0}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 프로필 편집 모달 */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>프로필 편집</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditModalOpen(false)}
                disabled={editSaving}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <DialogDescription>닉네임, 한 줄 소개, 프로필 사진, 이메일 공개 여부를 수정할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProfile} className="space-y-6 px-6 pb-6">
            {/* 프로필 사진: 지금 사진 보여주기 + 사진 변경(드래그/클릭) */}
            <div className="space-y-3">
              <Label>프로필 사진</Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => !avatarUploading && avatarInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && !avatarUploading && avatarInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAvatarDrag(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setAvatarDrag(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setAvatarDrag(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && !avatarUploading) handleAvatarFile(file);
                }}
                className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-6 transition-colors ${
                  avatarDrag ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20'
                } ${avatarUploading ? 'pointer-events-none opacity-80' : 'cursor-pointer'}`}
              >
                <div
                  className="h-24 w-24 rounded-full overflow-hidden border-4 border-background shadow flex items-center justify-center bg-muted shrink-0"
                  style={{
                    background: editAvatarUrl ? undefined : getRandomGradient(user?.id ?? ''),
                  }}
                >
                  {editAvatarUrl ? (
                    <img src={editAvatarUrl} alt="현재 프로필" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-white">
                      {(editNickname || profile?.nickname || '?').slice(0, 1)}
                    </span>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarFile(file);
                    e.target.value = '';
                  }}
                />
                {avatarUploading && (
                  <div className="w-full max-w-xs space-y-1">
                    <p className="text-sm text-muted-foreground">업로드 중...</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${avatarProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                  disabled={avatarUploading}
                  className="pointer-events-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  사진 변경
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  드래그하거나 클릭해서 올리기 · JPG, PNG, GIF, WEBP · 최대 5MB
                </p>
              </div>
            </div>

            {/* 닉네임 */}
            <div className="space-y-2">
              <Label htmlFor="edit-nickname">닉네임</Label>
              <Input
                id="edit-nickname"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="닉네임"
                className="h-11"
                disabled={editSaving}
              />
            </div>

            {/* 한 줄 소개 */}
            <div className="space-y-2">
              <Label htmlFor="edit-bio">한 줄 소개</Label>
              <Textarea
                id="edit-bio"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="자기소개를 입력하세요"
                rows={3}
                className="resize-none"
                disabled={editSaving}
              />
            </div>

            {/* 이메일 공개 여부 */}
            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="edit-email-public">이메일 공개 여부</Label>
                <p className="text-sm text-muted-foreground">
                  {editEmailPublic ? '다른 사용자에게 이메일이 보입니다' : '이메일이 숨겨집니다'}
                </p>
              </div>
              <Switch
                id="edit-email-public"
                checked={editEmailPublic}
                onCheckedChange={setEditEmailPublic}
                disabled={editSaving}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                disabled={editSaving}
              >
                취소
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
