# Development Guidelines (AI Agent 전용)

## 프로젝트 개요

- 목적: Notion 포트폴리오 페이지 + 하위 문서(DB 없음) → 프롬프트 생성 → (사용자가 ChatGPT 등에서 실행) → 결과 JSON 붙여넣기·검증 → 웹 미리보기/수정 → Notion 새 페이지 저장 (개인용, 단일 사용자)
- 스택: Next.js 15.5.3 (App Router, Turbopack) / React 19.1.0 / TypeScript strict / Tailwind v4 / shadcn/ui (new-york) / Zod 4 / react-hook-form
- 외부 연동 (예정): `@notionhq/client`, `@anthropic-ai/sdk`
- 현재 상태: 스타터킷만 존재. 이력서 기능은 `docs/ROADMAP.md` Phase 순서대로 구현한다.

## 언어 규칙

- 모든 응답·설명·코드 리뷰·코드 주석·커밋 메시지는 **한국어**로 작성한다.
- 변수명·함수명·파일명은 **영어**로 작성한다.

## 디렉토리 구조 및 배치 규칙

| 대상                            | 위치                                               |
| ------------------------------- | -------------------------------------------------- |
| 페이지                          | `src/app/<route>/page.tsx`                         |
| API Route                       | `src/app/api/resume/{sources,merge,save}/route.ts` |
| 이력서 도메인 컴포넌트          | `src/components/resume/`                           |
| 레이아웃·네비·섹션              | `src/components/{layout,navigation,sections}/`     |
| shadcn 컴포넌트                 | `src/components/ui/` (직접 수정 금지, CLI로 추가)  |
| Notion 클라이언트·조회·저장     | `src/lib/notion.ts`                                |
| 프롬프트 생성·AI 결과 JSON 추출 | `src/lib/merge-prompt.ts`                          |
| 환경변수 검증                   | `src/lib/env.ts` (기존 파일 확장)                  |
| 이력서 Zod 스키마·타입          | `src/types/resume.ts` (PRD 경로 우선)              |
| 유틸 (`cn`)                     | `src/lib/utils.ts`                                 |

- import는 `@/` 별칭만 사용한다. 상대경로 `../../` 금지.
- 새 도메인 파일은 위 표의 위치를 따른다. 표에 없는 위치에 만들지 않는다.

## 코드 표준

- 포맷: 세미콜론 없음, 작은따옴표, 2칸 들여쓰기, trailing comma `es5`, 화살표 함수 괄호 생략(`arrowParens: avoid`), printWidth 80
- 클래스 병합은 `cn()` (`src/lib/utils.ts`)만 사용한다.
- 서버 컴포넌트를 기본으로 한다. 상태·이벤트가 필요한 파일에만 `'use client'`를 둔다.
- 아이콘은 `lucide-react`만 사용한다.
- 토스트는 `sonner`(`@/components/ui/sonner`)만 사용한다.

✅ `import { cn } from '@/lib/utils'`
❌ `import { cn } from '../../lib/utils'`

## 환경변수 규칙

- 변수 추가 시 **반드시 동시에** 수정: `src/lib/env.ts`(zod 스키마 + parse 객체), `.env.example`
- 대상 키: `NOTION_API_KEY`, `NOTION_PORTFOLIO_PAGE_ID`
- 실제 키는 `.env.local`에만 둔다. `.env.example`은 값을 비워 둔다 (git 추적 대상)
- 위 키에 `NEXT_PUBLIC_` 접두사 **금지**. 클라이언트 컴포넌트에서 `env` import **금지**.
- `process.env`를 `env.ts` 외부에서 직접 읽지 않는다.
- `.env.local`·실제 키 값을 커밋·출력하지 않는다.

## 기능 구현 규칙

- Notion 호출은 **서버(Route Handler / Server Action)에서만** 수행한다. AI API는 호출하지 않는다 (API 키·과금 없음, 수동 연계).
- AI 결과(사용자가 붙여 넣은 JSON)는 `src/lib/merge-prompt.ts`로 추출하고 `src/types/resume.ts`의 Zod 스키마로 `safeParse` 검증한다. 검증 실패 시 한글 오류와 수정 요청 프롬프트를 반환한다.
- 병합 결과의 모든 항목에 `sources`(Notion 문서 페이지 ID)를 포함한다. 근거 없는 내용 생성 금지.
- 충돌 항목(기간·직함 불일치)은 임의 선택하지 않고 `conflicts`로 사용자에게 선택지를 제공한다.
- Notion 저장은 **새 페이지 생성만** 허용한다. 기존 이력서 페이지 수정·삭제 금지 (비파괴 원칙).
- Notion API는 직렬화·캐싱으로 속도 제한(평균 3 req/s)을 지킨다.
- 데이터 소스는 DB가 아니라 포트폴리오 페이지의 `child_page` 하위 문서다. `databases.query`를 쓰지 않는다. 모든 페이지의 속성은 `title`뿐이며 날짜는 `created_time`/`last_edited_time`을 쓴다 (PRD §5).
- 새 이력서 저장 위치는 가정안(포트폴리오 하위 페이지)이다. 확정 전 변경하지 않는다.

## 폼 규칙

- react-hook-form + Zod(`@hookform/resolvers`) + shadcn `form` 컴포넌트 조합을 사용한다. 상세는 `docs/guides/forms-react-hook-form.md`.

## UI 컴포넌트 추가 규칙

- 새 shadcn 컴포넌트는 `npx shadcn@latest add <name>`으로 추가한다. 수동 복붙 금지.
- 스타일 규칙은 `docs/guides/styling-guide.md`, 컴포넌트 패턴은 `docs/guides/component-patterns.md`를 따른다.
- 다크모드는 `next-themes`(class 방식) 토큰 기반으로 처리한다. 하드코딩 색상 금지.

## 파일 연동 규칙 (동시 수정 필수)

| 변경                   | 함께 수정                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| 환경변수 추가/삭제     | `src/lib/env.ts` + `.env.example`                                                                       |
| 이력서 Zod 스키마 변경 | `src/lib/merge-prompt.ts`(프롬프트 지시문·검증) + `src/lib/notion.ts`(변환) + `src/components/resume/*` |
| 새 라우트 추가         | `src/components/navigation/main-nav.tsx`, `mobile-nav.tsx` 링크                                         |
| Phase 작업 완료        | `docs/ROADMAP.md` 체크박스·진행 현황 갱신 (`/docs:update-roadmap`)                                      |
| 디렉토리 구조 변경     | `docs/guides/project-structure.md`                                                                      |
| 의존성 추가            | `package.json` + `package-lock.json` (npm install로 처리)                                               |
| 사이트 메타 변경       | `src/app/layout.tsx` metadata (현재 스타터 문구, 이력서 앱에 맞게 교체)                                 |

## 워크플로우

1. `docs/ROADMAP.md`에서 다음 미완료 작업과 완료 조건 확인
2. `docs/PRD.md` 해당 절 확인
3. 구현
4. `npm run check-all` (typecheck + lint + format:check)
5. `npm run build`
6. ROADMAP 갱신 후 `/git:commit` 규칙으로 커밋

- 커밋: 이모지 + 컨벤셔널 형식, 한국어 (`✨ feat: ...`, `📝 docs: ...`). 훅(husky + lint-staged)을 우회(`--no-verify`)하지 않는다.

## 문서 수정 규칙

- `docs/PRD.md`는 사용자 요청 없이 수정하지 않는다.
- `docs/ROADMAP.md`는 작업 진행 상태 갱신 시에만 수정한다.
- 가이드 문서(`docs/guides/*`)와 규칙이 충돌하면 PRD → ROADMAP → 가이드 순으로 우선한다.

## AI 결정 기준

- 스키마 위치 모호 → `src/types/resume.ts` (PRD 우선)
- 테스트 도구 필요 → 도입 전 사용자 승인 받는다 (현재 테스트 러너 없음)
- 접근 제한 방식·AI 실행 방식·diff 기준본 등 ROADMAP "미결정 사항" → 임의 확정하지 말고 사용자에게 질문한다
- 스타터 잔여 페이지(landing, login, signup) 삭제 → 사용자 확인 후 수행한다
- 개인 데이터를 배포 환경에 노출하기 전 ROADMAP 6.1(접근 제한)이 완료되어야 한다

## 금지 사항

- ❌ API 키·토큰을 클라이언트 번들, 로그, 커밋에 노출
- ❌ 클라이언트에서 Notion 직접 호출, AI API 키 도입(사용자 승인 없이)
- ❌ Notion 기존 페이지 덮어쓰기·삭제
- ❌ Zod 검증 없이 AI 결과 사용
- ❌ `src/components/ui/*` 임의 수정, `npm run check-all` 실패 상태로 작업 완료 보고
- ❌ 회원가입·다중 사용자·PDF/DOCX 내보내기·공고 맞춤 생성 구현 (MVP 제외 범위)
- ❌ `any` 사용, `@ts-ignore`로 오류 은폐
- ❌ npm 외 패키지 매니저 사용 (`package-lock.json` 유지)
