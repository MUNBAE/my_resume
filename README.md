# Notion 포트폴리오 통합·최신화

Notion에 흩어진 이력서·지원서를 읽어 **하나의 최신 이력서**로 통합하는 개인용 웹 도구입니다.
AI 호출은 앱이 하지 않습니다. 앱이 만든 프롬프트를 ChatGPT 등에 직접 붙여 넣고, 결과 JSON을 다시 붙여 넣으면 앱이 검증·병합해서 보여 줍니다. **API 키와 AI 사용료가 필요 없습니다.**

## 동작 방식

1. 포트폴리오 페이지의 하위 문서(이력서·지원서) 목록에서 병합할 문서를 고릅니다.
2. **프롬프트 생성**을 누르고 복사해 ChatGPT 등에 붙여 넣어 실행합니다.
3. AI가 출력한 JSON을 앱에 붙여 넣으면 스키마·출처를 검증합니다. 형식 오류가 있으면 위치와 함께 알려 주고, AI에게 되돌려 줄 **수정 요청 프롬프트**를 만들어 줍니다.
4. 기준본 대비 변경점과 항목별 출처를 보면서 항목을 수락·거절·수정하고, 값이 다른 항목(충돌)은 직접 고릅니다. 충돌이 모두 해결되어야 확정할 수 있습니다.
5. 확정하면 포트폴리오 페이지 아래에 **새 페이지**로 저장합니다. 기존 문서는 수정하거나 삭제하지 않습니다.

> ⚠️ 프롬프트에는 선택한 문서의 본문(개인정보 포함)이 그대로 들어갑니다. 외부 AI 서비스에 붙여 넣기 전에 내용을 확인하세요.

## 기술 스택

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Zod · `@notionhq/client` · Vitest

## 시작하기

필요한 것: Node.js 20 이상, Notion 계정

```bash
npm install
cp .env.example .env.local   # 값을 채운다 (아래 "환경변수" 참고)
npm run dev                  # http://localhost:3000/resume
```

### 환경변수

`.env.local`에 설정합니다. 이 파일은 git에 올라가지 않습니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요(서버 전용 값입니다).

| 변수                       | 필수         | 설명                                                                  |
| -------------------------- | ------------ | --------------------------------------------------------------------- |
| `NOTION_API_KEY`           | 예           | Notion Integration 토큰                                               |
| `NOTION_PORTFOLIO_PAGE_ID` | 예           | 분석할 포트폴리오 페이지 ID (이 페이지의 하위 페이지를 문서로 읽는다) |
| `BASIC_AUTH_USER`          | 배포 시 필수 | 접근 제한(Basic 인증) 사용자 이름                                     |
| `BASIC_AUTH_PASSWORD`      | 배포 시 필수 | 접근 제한 비밀번호 (8자 이상)                                         |

### Notion 연결

1. [Notion 연동 관리](https://www.notion.so/profile/integrations)에서 **내부 연동(Internal integration)** 을 만들고 시크릿을 `NOTION_API_KEY`에 넣습니다.
   - 권한(Capabilities)은 **콘텐츠 읽기**와 **콘텐츠 삽입**(저장용)이 필요합니다.
2. 포트폴리오 페이지에서 `⋯` → **연결(Connections)** → 방금 만든 연동을 추가합니다. 하위 페이지도 함께 읽힙니다.
3. 페이지 주소의 마지막 32자리(`...-419156e6c13d...` 형태에서 하이픈 뒤 ID)를 `NOTION_PORTFOLIO_PAGE_ID`에 넣습니다.
4. 이력서·지원서는 포트폴리오 페이지 **바로 아래 하위 페이지**여야 목록에 나타납니다. (데이터베이스는 사용하지 않습니다.)

연결이 잘못되면 `/resume`에 "Notion API 키가 올바르지 않습니다" 또는 "접근 권한이 없습니다" 같은 안내가 표시됩니다.

## 접근 제한 (Basic 인증)

개인 이력서를 보호하기 위해 `/resume`과 `/api/resume`는 HTTP Basic 인증을 요구합니다. 홈 화면은 보호 대상이 아닙니다.

| 환경             | 동작                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| 로컬 개발        | `BASIC_AUTH_*`가 없으면 인증 없이 접속됩니다 (편의용)                                      |
| 배포(production) | 값이 없거나 잘못되면 **접속을 차단(503)** 합니다. 설정하면 브라우저가 로그인 창을 띄웁니다 |

설정 오류 시 차단 이유가 화면에 표시됩니다. (예: "BASIC_AUTH_PASSWORD는 8자 이상이어야 합니다.")

## 배포 (Vercel)

배포는 직접 진행합니다. 비밀값이 외부로 새지 않도록 Vercel 대시보드에서 직접 입력하세요.

1. Vercel에서 **Add New → Project**로 이 저장소를 가져옵니다. 프레임워크는 Next.js로 자동 감지됩니다.
2. **Settings → Environment Variables**에 아래 4개를 등록합니다. **Production과 Preview 모두** 설정하세요. (Preview에 없으면 접속이 차단됩니다.)
   - `NOTION_API_KEY`, `NOTION_PORTFOLIO_PAGE_ID`
   - `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` (8자 이상, 추측하기 어려운 값)
3. 배포합니다.

### 배포 후 확인 체크리스트

- [ ] 주소 뒤에 `/resume`를 열면 로그인 창이 뜬다
- [ ] 틀린 비밀번호로는 들어가지 못한다 (401)
- [ ] 로그인하지 않고 `/api/resume/sources`를 열면 `{"error":"인증이 필요합니다."}` 가 나온다
- [ ] 로그인 후 문서 목록(4건 등)이 보인다
- [ ] 문서 선택 → 프롬프트 생성 → AI 결과 붙여넣기 → 미리보기 → 확정 → 저장이 끝까지 된다
- [ ] 저장된 새 페이지가 Notion 포트폴리오 아래에 생기고, 기존 문서는 그대로다
- [ ] 확인용으로 만든 테스트 페이지는 Notion에서 직접 삭제한다

> 서버리스 함수 제한 시간: API 라우트에 `maxDuration = 30`(초)을 지정해 두었습니다. 계정 요금제의 최대 실행 시간이 더 짧으면 그 값이 적용됩니다. 일반 요청(문서 4건)은 첫 요청 약 2초, 이후 캐시로 즉시 응답합니다.

## 개발 명령

| 명령                | 설명                                        |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | 개발 서버 (Turbopack)                       |
| `npm run build`     | 프로덕션 빌드                               |
| `npm test`          | 단위 테스트 (Vitest)                        |
| `npm run check-all` | 타입 검사 + 린트 + 포맷 검사 (커밋 전 확인) |
| `npm run lint:fix`  | 린트 자동 수정                              |
| `npm run format`    | Prettier로 전체 포맷                        |

커밋 시 husky + lint-staged가 변경된 파일을 검사·정리합니다. 줄바꿈은 `.gitattributes`로 LF에 통일됩니다.

## 프로젝트 구조

```
src/
├─ app/
│  ├─ resume/                 # 문서 선택(/resume), 병합 미리보기(/resume/merge), 공통 layout·loading·error
│  └─ api/resume/{sources,prompt,merge,save}/route.ts
├─ components/resume/         # 선택 목록, 프롬프트·결과 흐름, 미리보기, diff, 충돌 선택, 편집기, 저장 다이얼로그
├─ lib/
│  ├─ notion.ts               # Notion 클라이언트(직렬화·재시도), 조회, 새 페이지 생성
│  ├─ notion-markdown.ts      # Notion 마크다운 응답 정리 (이미지·임베드 제거, 표 변환)
│  ├─ merge-prompt.ts         # 프롬프트 생성, AI 결과 JSON 추출·검증, 수정 요청 프롬프트
│  ├─ resume-normalize.ts     # 중복 병합·최신순 정렬·출처 검증
│  ├─ resume-diff.ts, resume-editor.ts, notion-blocks.ts, ...
│  └─ basic-auth.ts, auth-env.ts, env.ts
├─ middleware.ts              # Basic 인증
└─ types/resume.ts            # 이력서 스키마 (Zod)
```

더 자세한 내용은 `docs/`를 참고하세요: [PRD](docs/PRD.md) · [로드맵](docs/ROADMAP.md) · [개발 가이드](docs/guides/)

## 알아둘 점

- 병합 초안은 브라우저 탭의 `sessionStorage`에만 임시로 보관됩니다. 탭을 닫으면 사라지고 서버에는 저장되지 않습니다.
- 앱이 쓰기를 하는 곳은 Notion **새 페이지 생성** 뿐입니다. 기존 페이지를 수정·삭제·보관하는 코드는 없습니다.
- 챗 AI의 입력 길이에는 한도가 있습니다. 프롬프트가 4만 자를 넘으면 경고하고, 10만 자를 넘으면 문서를 나눠 실행하도록 안내합니다.
- 저장 중 네트워크·시간 초과가 나면 Notion에 이미 페이지가 만들어졌을 수 있으니, 다시 저장하기 전에 포트폴리오 아래를 확인하세요.
