import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  isAllowedImageType,
  isWithinSizeLimit,
  resizeImage,
} from '@/lib/imageUtils';

const STORAGE_BUCKET = 'post-images';
const ALLOWED_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

// 제목을 URL 친화적인 slug로 변환
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '') // 특수문자 제거
    .replace(/\s+/g, '-') // 공백을 하이픈으로
    .substring(0, 100); // 최대 100자
};

export const WritePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 제목이 변경될 때 slug 자동 생성
  useEffect(() => {
    if (title) {
      const generatedSlug = generateSlug(title);
      setSlug(generatedSlug);
    }
  }, [title]);

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
    setTags(tags.filter(tag => tag !== tagToRemove));
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

  const processFile = async (file: File) => {
    if (!user) return;
    if (!isAllowedImageType(file.type)) {
      toast.error('jpg, png, gif, webp 파일만 업로드할 수 있습니다.');
      return;
    }
    if (!isWithinSizeLimit(file.size)) {
      toast.error('파일이 너무 큽니다. (최대 5MB)');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => (p >= 90 ? 90 : p + 10));
    }, 200);
    try {
      const blob = await resizeImage(file);
      const path = `${user.id}/${Date.now()}.jpg`;
      await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success('이미지가 업로드되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('업로드에 실패했습니다.');
    } finally {
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveImage = () => {
    setImageUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl.trim() || null,
            tags: tags.length > 0 ? tags : null,
            is_public: isPublic,
            slug: slug || generateSlug(title),
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.message.includes('duplicate key value violates unique constraint')) {
          toast.error('이미 사용 중인 URL입니다. 제목을 변경해주세요.');
        } else {
          throw error;
        }
        return;
      }

      toast.success('게시글이 발행되었습니다!');
      navigate(`/post/${data.id}`);
    } catch (error) {
      console.error('작성 오류:', error);
      toast.error('게시글 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">글쓰기</CardTitle>
              <CardDescription className="text-base mt-2">
                새로운 글을 작성하여 공유하세요
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => navigate('/')}
                disabled={loading}
                className="min-w-[100px]"
              >
                취소
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading}
                size="lg"
                className="min-w-[120px]"
              >
                {loading ? '발행 중...' : '발행하기'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 제목 */}
            <div className="space-y-2">
              <Input
                id="title"
                placeholder="제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                required
                className="text-4xl font-bold border-0 focus-visible:ring-0 px-0 h-auto py-2 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* 대표 이미지 업로드 */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">대표 이미지 (선택사항)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_ACCEPT}
                onChange={handleFileChange}
                className="hidden"
              />
              {uploading && (
                <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-medium">업로드 중...</p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {!uploading && imageUrl && (
                <div className="relative inline-block">
                  <img
                    src={imageUrl}
                    alt="대표 이미지 미리보기"
                    className="max-h-64 rounded-xl border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8 rounded-full"
                    onClick={handleRemoveImage}
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {!uploading && !imageUrl && (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'
                  }`}
                >
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <span className="text-center text-sm font-medium text-muted-foreground">
                    드래그해서 놓거나 클릭해서 파일 선택
                  </span>
                  <span className="text-xs text-muted-foreground">
                    JPG, PNG, GIF, WEBP · 최대 5MB
                  </span>
                </div>
              )}
              <div className="pt-2">
                <Label htmlFor="imageUrlManual" className="text-sm text-muted-foreground">
                  또는 URL 직접 입력
                </Label>
                <Input
                  id="imageUrlManual"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={loading}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1 h-11"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                이미지가 없으면 자동으로 예쁜 그라데이션이 표시됩니다
              </p>
            </div>

            {/* URL Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-base font-semibold">
                URL 주소 (자동 생성)
              </Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={loading}
                className="font-mono text-base h-11"
                placeholder="url-slug"
              />
              <p className="text-sm text-muted-foreground">
                게시글의 고유 URL: /post/{slug || 'url-slug'}
              </p>
            </div>

            {/* 태그 입력 */}
            <div className="space-y-2">
              <Label htmlFor="tags" className="text-base font-semibold">태그 (최대 5개)</Label>
              <div className="space-y-3">
                <Input
                  id="tags"
                  placeholder="태그를 입력하고 Enter, 쉼표 또는 스페이스를 누르세요"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  disabled={loading || tags.length >= 5}
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
                          disabled={loading}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {tags.length}/5개 태그
                </p>
              </div>
            </div>

            {/* 공개/비공개 설정 */}
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
                disabled={loading}
              />
            </div>

            {/* 내용 */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-base font-semibold">내용</Label>
              <Textarea
                id="content"
                placeholder="내용을 입력하세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={loading}
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
