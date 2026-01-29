# MyBlog

Supabase와 React를 사용한 블로그 애플리케이션입니다.

## 주요 기능

- 🔐 사용자 인증 (회원가입, 로그인, 로그아웃)
- ✍️ 게시글 작성, 수정, 삭제
- 📖 게시글 목록 및 상세보기
- 👤 마이페이지 (내가 작성한 글)
- 🔒 Row Level Security (RLS)로 보안 강화

## 기술 스택

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS 4
- **Backend**: Supabase (PostgreSQL + Auth)
- **Routing**: React Router DOM

## 페이지 구조

- `/` - 메인 페이지 (게시글 목록)
- `/post/:id` - 게시글 상세 페이지
- `/write` - 글쓰기 페이지 (로그인 필요)
- `/login` - 로그인 페이지
- `/signup` - 회원가입 페이지
- `/mypage` - 마이페이지 (로그인 필요)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프리뷰
npm run preview
```

## 환경 변수

`.env` 파일에 다음 환경 변수가 설정되어 있습니다:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 데이터베이스 구조

### posts 테이블
- `id` (UUID) - 기본 키
- `title` (TEXT) - 게시글 제목
- `content` (TEXT) - 게시글 내용
- `user_id` (UUID) - 작성자 ID
- `created_at` (TIMESTAMPTZ) - 작성일
- `updated_at` (TIMESTAMPTZ) - 수정일

## RLS 정책

- ✅ 모든 사용자가 게시글을 읽을 수 있습니다
- ✅ 로그인한 사용자만 게시글을 작성할 수 있습니다
- ✅ 작성자만 자신의 게시글을 수정/삭제할 수 있습니다

## Storage (대표 이미지)

글쓰기 페이지의 대표 이미지 업로드를 사용하려면 Supabase 대시보드에서 Storage 버킷을 생성하세요.

1. **Supabase Dashboard** → **Storage** → **New bucket**
2. 이름: `post-images`
3. **Public bucket** 체크 (공개 읽기 허용)
4. (선택) 정책에서 인증된 사용자만 업로드 허용하도록 설정

또는 SQL Editor에서 다음으로 버킷 생성:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;
```

## 댓글 소프트 삭제 (deleted_at)

댓글 삭제 시 DB에서 바로 지우지 않고 `deleted_at`만 설정합니다. Supabase SQL Editor에서 한 번 실행하세요:

```sql
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
```

## 라이선스

MIT
