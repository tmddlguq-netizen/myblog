import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100);
};

interface PostRow {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  tags: string[] | null;
  is_public: boolean;
  slug: string | null;
  user_id: string;
  created_at: string;
  updated_at: string | null;
}

export const EditPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState<PostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (id && user) {
      fetchPost();
    } else if (!user) {
      setLoading(false);
    }
  }, [id, user]);

  const fetchPost = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, content, image_url, tags, is_public, slug, user_id, created_at, updated_at')
        .eq('id', id)
        .single();

      if (error) {
        setPost(null);
        setLoading(false);
        return;
      }

      if (data.user_id !== user?.id) {
        setForbidden(true);
        setPost(data as PostRow);
        setLoading(false);
        return;
      }

      setPost(data as PostRow);
      setTitle(data.title ?? '');
      setContent(data.content ?? '');
      setImageUrl(data.image_url ?? '');
      setTags(Array.isArray(data.tags) ? data.tags : []);
      setIsPublic(data.is_public ?? true);
      setSlug(data.slug ?? generateSlug(data.title ?? ''));
    } catch (e) {
      console.error(e);
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (!trimmedTag) return;
    if (tags.length >= 5) {
      toast.error('태그는 최대 5개까지 추가할 수 있습니다.');
      return;
    }
    if (tags.includes(trimmedTag)) {
      toast.error('이미 추가된 태그입니다.');
      return;
    }
    setTags([...tags, trimmedTag]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === ',' || e.key === ' ') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          title: title.trim(),
          content: content.trim(),
          image_url: imageUrl.trim() || null,
          tags: tags.length > 0 ? tags : null,
          is_public: isPublic,
          slug: slug.trim() || generateSlug(title),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          toast.error('이미 사용 중인 URL입니다. 제목을 변경해주세요.');
        } else {
          throw error;
        }
        return;
      }

      toast.success('수정되었습니다.');
      navigate(`/post/${id}`);
    } catch (err) {
      console.error('수정 오류:', err);
      toast.error('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-8">
        <p className="text-muted-foreground text-lg">로딩 중...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">게시글을 찾을 수 없습니다.</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              메인으로
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold text-destructive mb-2">권한이 없습니다.</p>
            <p className="text-muted-foreground mb-6">이 글은 작성자만 수정할 수 있습니다.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(`/post/${id}`)}>
                글 보기
              </Button>
              <Button onClick={() => navigate('/')}>메인으로</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">글 수정</CardTitle>
              <CardDescription className="text-base mt-2">
                내용을 수정한 뒤 저장하세요
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => navigate(`/post/${id}`)}
                disabled={saving}
                className="min-w-[100px]"
              >
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                size="lg"
                className="min-w-[120px]"
              >
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                id="title"
                placeholder="제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                required
                className="text-4xl font-bold border-0 focus-visible:ring-0 px-0 h-auto py-2 placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="text-base font-semibold">
                대표 이미지 URL (선택사항)
              </Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={saving}
                placeholder="https://example.com/image.jpg"
                className="h-11"
              />
              <p className="text-sm text-muted-foreground">
                이미지가 없으면 자동으로 예쁜 그라데이션이 표시됩니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-base font-semibold">
                URL 주소 (자동 생성)
              </Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={saving}
                className="font-mono text-base h-11"
                placeholder="url-slug"
              />
              <p className="text-sm text-muted-foreground">
                게시글의 고유 URL: /post/{slug || 'url-slug'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags" className="text-base font-semibold">태그 (최대 5개)</Label>
              <div className="space-y-3">
                <Input
                  id="tags"
                  placeholder="태그를 입력하고 Enter, 쉼표 또는 스페이스를 누르세요"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  disabled={saving || tags.length >= 5}
                  className="h-11"
                />
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-full text-base font-medium"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive transition"
                          disabled={saving}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{tags.length}/5개 태그</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-5 border rounded-xl bg-muted/30">
              <div className="space-y-1">
                <Label htmlFor="visibility" className="text-base font-semibold">
                  공개 설정
                </Label>
                <p className="text-base text-muted-foreground">
                  {isPublic ? '모두에게 공개됩니다' : '나만 볼 수 있습니다'}
                </p>
              </div>
              <Switch
                id="visibility"
                checked={isPublic}
                onCheckedChange={setIsPublic}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-base font-semibold">내용</Label>
              <Textarea
                id="content"
                placeholder="내용을 입력하세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={saving}
                required
                rows={20}
                className="resize-none text-base leading-relaxed"
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
