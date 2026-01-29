# AI Agent Guidelines for myblog

이 프로젝트는 React + TypeScript + Vite 기반의 블로그 애플리케이션입니다.

## UI 디자인 규칙

### shadcn/ui 사용

- 모든 UI 컴포넌트는 **shadcn/ui**를 적극적으로 활용합니다
- 새로운 컴포넌트가 필요할 때는 shadcn/ui 라이브러리를 우선적으로 검토합니다
- 커스텀 디자인이 필요한 경우에도 shadcn/ui 컴포넌트를 기반으로 확장합니다

### 컴포넌트 추가 방법

**반드시 터미널 명령어를 통해 컴포넌트를 추가합니다:**

```bash
# shadcn/ui 컴포넌트 추가 예시
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add form
```

❌ **잘못된 방법**: 수동으로 컴포넌트 파일 생성

✅ **올바른 방법**: CLI를 통한 컴포넌트 추가

## 개발 워크플로우

1. 새로운 UI 기능 구현 시:
   - shadcn/ui에서 해당 컴포넌트 확인
   - `npx shadcn@latest add [component-name]` 명령어로 추가
   - 추가된 컴포넌트를 import하여 사용

2. 컴포넌트 커스터마이징:
   - `src/components/ui/` 디렉토리의 컴포넌트를 수정
   - Tailwind CSS를 사용한 스타일링

## 예시

```typescript
// 1. 먼저 터미널에서 컴포넌트 추가
// npx shadcn@latest add button

// 2. 컴포넌트 import 및 사용
import { Button } from "@/components/ui/button"

export function MyComponent() {
  return (
    <Button variant="default">Click me</Button>
  )
}
```

## 주의사항

- shadcn/ui 컴포넌트는 프로젝트 내부에 복사되므로 자유롭게 수정 가능합니다
- 컴포넌트 추가 시 필요한 dependencies도 자동으로 설치됩니다
- Tailwind CSS 설정이 올바르게 되어있는지 확인하세요
