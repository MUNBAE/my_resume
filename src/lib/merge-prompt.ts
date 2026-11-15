// 수동 연계용 프롬프트 생성 (서버·클라이언트 공용 순수 함수 모음, 외부 호출 없음)
import type { z } from 'zod'
import { resumeSchema, type Resume } from '@/types/resume'

// 프롬프트에 넣을 문서 (출처로 쓸 Notion 페이지 ID 포함)
export interface PromptDocument {
  id: string
  title: string
  text: string
}

// AI가 따를 출력 JSON 예시 — resumeSchema를 통과하는 값이어야 한다 (테스트로 보장)
export const OUTPUT_EXAMPLE = {
  experiences: [
    {
      id: 'exp-1',
      company: '예시회사',
      position: '선임 연구원',
      startDate: '2021-03',
      endDate: null,
      summary: '한 줄 요약',
      achievements: [
        {
          text: '원문에 있던 성과 문장',
          origin: 'original',
          sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
        },
        {
          text: '다른 문서 본문에서 찾아 보강한 성과 문장',
          origin: 'enriched',
          sources: [{ documentId: '문서ID-2', title: '문서 제목' }],
        },
      ],
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [
        {
          field: 'position',
          candidates: [
            {
              value: '선임 연구원',
              sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
            },
            {
              value: '책임 연구원',
              sources: [{ documentId: '문서ID-2', title: '문서 제목' }],
            },
          ],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'prj-1',
      name: '예시 프로젝트',
      startDate: '2022-01',
      endDate: '2022-06',
      role: '백엔드 개발',
      summary: '한 줄 요약',
      technologies: ['TypeScript', 'PostgreSQL'],
      achievements: [],
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
  skills: [
    {
      id: 'skl-1',
      category: '언어',
      name: 'TypeScript',
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
  educations: [
    {
      id: 'edu-1',
      school: '예시대학교',
      major: '컴퓨터공학',
      degree: '학사',
      status: '졸업',
      gpa: '3.8 / 4.5',
      startDate: '2014-03',
      endDate: '2020-02',
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
  certifications: [
    {
      id: 'crt-1',
      name: '정보처리기사',
      issuer: '한국산업인력공단',
      grade: '합격',
      date: '2019-05',
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
}

// 출력 형식 지시문: 필드 규칙 + 예시 JSON
export function buildSchemaInstruction(): string {
  return [
    '## 출력 형식',
    '반드시 아래 구조의 JSON 하나만 출력하세요. JSON 앞뒤에 설명 문장을 붙이지 마세요. (```json 코드 블록으로 감싸는 것은 허용)',
    '',
    '필드 규칙:',
    '- 최상위 키: experiences(경력), projects(프로젝트), skills(기술), educations(학력), certifications(자격). 해당 항목이 없으면 빈 배열 []',
    '- 모든 항목에는 id(문자열, 항목마다 고유: exp-1, prj-1, skl-1, edu-1, crt-1 …)와 sources(출처 배열, 최소 1개)가 필수입니다.',
    '- sources의 documentId에는 입력 문서 구분선에 적힌 "문서 ID"를 그대로 적고, title에는 그 문서 제목을 적으세요. 입력에 없는 ID를 만들지 마세요.',
    '- 날짜는 "YYYY-MM" 또는 "YYYY" 형식입니다. 현재 재직·진행 중이면 endDate는 null 입니다. 날짜를 알 수 없으면 경력은 가장 가까운 근거로 적되 추측하지 말고, 선택 필드(프로젝트·학력·자격)는 생략하세요.',
    '- experiences: company, startDate, endDate는 필수이고 position, summary는 선택입니다. achievements는 성과 배열입니다.',
    '- achievements의 각 항목: text(성과 문장), origin("original" 또는 "enriched"), sources(최소 1개)',
    '- educations: school은 필수이고 major(전공), degree(학사·석사 등), status(졸업·재학·교육이수 등), gpa(학점 문자열), program(대학 외 교육과정명), startDate, endDate는 선택입니다.',
    '- certifications: name은 필수이고 issuer(발급처), grade(등급·점수), date는 선택입니다.',
    '- 위에 적지 않은 필드명은 사용하지 마세요. 해당 내용은 가장 가까운 필드(summary 등)에 문장으로 넣으세요.',
    '- conflicts: 항목 하나의 같은 필드 값이 문서마다 다를 때만 채웁니다. 충돌이 없으면 빈 배열 [] 입니다. candidates의 value는 항상 문자열이며, "현재 재직·진행 중"은 null이 아니라 "현재"라고 적으세요. candidates는 서로 다른 값 2개 이상입니다.',
    '',
    '예시:',
    '```json',
    JSON.stringify(OUTPUT_EXAMPLE, null, 2),
    '```',
  ].join('\n')
}

// 병합·보강 규칙 지시문
const MERGE_RULES = `## 역할
당신은 이력서 편집자입니다. 아래 "입력 문서"들은 한 사람의 이력서·지원서·포트폴리오입니다. 이 문서들만 근거로 하나의 최신 통합 이력서 데이터를 만드세요.

## 핵심 규칙
1. 근거 없는 내용 금지: 입력 문서에 없는 회사·직함·기간·수치·기술·성과를 만들거나 추측하지 마세요. 확실하지 않으면 해당 필드를 생략하세요.
2. 출처 필수: 모든 항목과 모든 성과 문장에 그 내용이 나온 문서의 "문서 ID"를 sources로 적으세요. 여러 문서에 나오면 모두 적으세요.
3. 중복 제거: 같은 회사(또는 같은 프로젝트)는 회사·프로젝트 이름과 기간이 겹치는지로 식별해 하나의 항목으로 합치세요. 표기만 다른 경우(예: (주)A, A㈜)도 같은 곳으로 봅니다.
4. 충돌 처리: 같은 항목의 기간·직함 등이 문서마다 다르면 임의로 하나를 고르지 마세요. 가장 최근에 작성된 것으로 보이는 문서의 값을 임시로 필드에 넣고, 모든 후보 값과 각각의 출처를 conflicts에 기록하세요. 최종 선택은 사용자가 합니다.
5. 정렬: experiences는 최신순(시작일이 늦은 순)으로 정렬하세요.

## 문서 기반 보강 규칙
- 지원서·포트폴리오·자기소개서 본문에서 정량 성과, 맡은 역할, 사용 기술, 문제 해결 사례를 찾아 관련된 경력·프로젝트의 achievements에 연결하세요.
- 이력서에 이미 있던 성과는 origin을 "original", 다른 문서 본문에서 찾아 새로 추가한 성과는 "enriched"로 표시하세요.
- enriched 성과도 반드시 입력 문서에 실제로 있는 내용이어야 하며, 근거가 된 문서 ID를 sources에 적으세요. 수치는 원문 그대로 옮기고 바꾸거나 새로 만들지 마세요.
- 어느 경력·프로젝트에 속하는지 불분명한 내용은 억지로 연결하지 말고 넣지 마세요.`

// 입력 문서 블록: 문서마다 구분선 + ID + 제목을 붙인다
export function formatDocuments(documents: PromptDocument[]): string {
  return documents
    .map(
      doc =>
        `=== 문서 시작 | 문서 ID: ${doc.id} | 제목: ${doc.title} ===\n${doc.text}\n=== 문서 끝 | 문서 ID: ${doc.id} ===`
    )
    .join('\n\n')
}

// 병합·보강 프롬프트 전체를 만든다
export function buildMergePrompt(documents: PromptDocument[]): string {
  return [
    MERGE_RULES,
    buildSchemaInstruction(),
    '## 입력 문서',
    formatDocuments(documents),
  ].join('\n\n')
}

// ---------------------------------------------------------------------------
// AI 결과에서 JSON 추출
// ---------------------------------------------------------------------------

export type ExtractJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string }

// 문자열 안의 중괄호를 무시하고 첫 '{'부터 짝이 맞는 '}'까지 잘라낸다
function scanBalancedObject(text: string): string | undefined {
  const start = text.indexOf('{')
  if (start === -1) return undefined

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  // 닫히지 않은 JSON(응답이 중간에 잘린 경우)
  return text.slice(start)
}

function describeParseError(candidate: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  const position = /position (\d+)/.exec(detail)?.[1]
  const near =
    position !== undefined
      ? ` 오류 위치 근처: "${candidate.slice(Math.max(0, Number(position) - 20), Number(position) + 20).replace(/\s+/g, ' ')}"`
      : ''
  const truncated = candidate.trimEnd().endsWith('}')
    ? ''
    : ' 응답이 중간에 잘렸을 수 있습니다. AI에게 "이어서 JSON 전체를 다시 출력해 줘"라고 요청해 보세요.'
  return `JSON 형식이 올바르지 않습니다.${near}${truncated}`
}

/**
 * 챗 AI의 응답 텍스트에서 JSON 객체를 꺼낸다.
 * ```json 코드 블록이 있으면 우선 쓰고, 없으면 첫 '{'부터 짝이 맞는 '}'까지 읽는다.
 */
export function extractJson(raw: string): ExtractJsonResult {
  const text = raw.trim()
  if (text === '') {
    return {
      ok: false,
      message: 'AI 결과가 비어 있습니다. 결과를 붙여 넣어 주세요.',
    }
  }

  const candidates: string[] = []
  for (const match of text.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)) {
    const inner = scanBalancedObject(match[1])
    if (inner) candidates.push(inner)
  }
  const bare = scanBalancedObject(text)
  if (bare) candidates.push(bare)

  if (candidates.length === 0) {
    return {
      ok: false,
      message:
        'JSON을 찾지 못했습니다. AI 응답에서 { 로 시작하는 JSON 전체를 복사해 붙여 넣어 주세요.',
    }
  }

  let lastError = ''
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate)
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return { ok: true, value }
      }
      lastError = 'JSON 최상위는 객체({ ... })여야 합니다.'
    } catch (error) {
      lastError = describeParseError(candidate, error)
    }
  }
  return { ok: false, message: lastError }
}

// ---------------------------------------------------------------------------
// 검증과 수정 요청 프롬프트
// ---------------------------------------------------------------------------

export interface ResumeIssue {
  /** 사람이 읽을 수 있는 위치 (예: 경력 2번 > 성과 3번 > 출처) */
  location: string
  message: string
}

export type ValidateResumeResult =
  | { ok: true; resume: Resume }
  | {
      ok: false
      /** 화면에 보여줄 요약 */
      message: string
      issues: ResumeIssue[]
      /** AI에게 되돌려 붙여 넣어 결과를 고치게 하는 프롬프트 (JSON 추출에 성공한 경우만) */
      fixPrompt?: string
    }

const SECTION_NAMES: Record<string, string> = {
  experiences: '경력',
  projects: '프로젝트',
  skills: '기술',
  educations: '학력',
  certifications: '자격',
  achievements: '성과',
  sources: '출처',
  conflicts: '충돌',
  candidates: '후보',
}

// zod 경로 → "경력 1번 > 성과 3번 > text"
function describePath(path: PropertyKey[]): string {
  if (path.length === 0) return '최상위'
  const parts: string[] = []
  for (let i = 0; i < path.length; i++) {
    const key = String(path[i])
    const next = path[i + 1]
    if (SECTION_NAMES[key] && typeof next === 'number') {
      parts.push(`${SECTION_NAMES[key]} ${next + 1}번`)
      i++
    } else {
      parts.push(SECTION_NAMES[key] ?? key)
    }
  }
  return parts.join(' > ')
}

function describeIssue(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.message.includes('received undefined')
        ? '필수 항목이 없습니다.'
        : `값의 형식이 올바르지 않습니다. (필요한 형식: ${issue.expected})`
    case 'too_small':
      return issue.message.startsWith('Too small')
        ? '비어 있을 수 없습니다.'
        : issue.message
    case 'invalid_value':
      return '허용되지 않는 값입니다.'
    default:
      return issue.message
  }
}

const MAX_ISSUES = 30

export function buildFixPrompt(value: unknown, issues: ResumeIssue[]): string {
  const list = issues
    .slice(0, MAX_ISSUES)
    .map((issue, index) => `${index + 1}. ${issue.location}: ${issue.message}`)
    .join('\n')
  const more =
    issues.length > MAX_ISSUES
      ? `\n(그 외 ${issues.length - MAX_ISSUES}개 오류가 더 있습니다. 같은 규칙으로 모두 고쳐 주세요.)`
      : ''

  return [
    '아래 JSON에서 형식 오류를 찾았습니다. 내용은 바꾸지 말고, 오류만 고쳐서 JSON 전체를 다시 출력하세요.',
    '새로운 사실을 추가하거나 값을 지어내지 마세요. 출처(documentId)가 없는 항목은 원래 근거가 된 문서의 ID를 넣고, 근거를 알 수 없으면 그 항목을 삭제하세요.',
    '',
    '## 발견된 오류',
    list + more,
    '',
    buildSchemaInstruction(),
    '',
    '## 고칠 JSON',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
  ].join('\n')
}

/**
 * 붙여 넣은 AI 응답을 JSON으로 꺼내 resumeSchema로 검증한다.
 * 실패하면 한글 오류 목록과, AI에게 되돌려 줄 수정 요청 프롬프트를 함께 반환한다.
 */
export function validateResumeJson(raw: string): ValidateResumeResult {
  const extracted = extractJson(raw)
  if (!extracted.ok) {
    return { ok: false, message: extracted.message, issues: [] }
  }

  const parsed = resumeSchema.safeParse(extracted.value)
  if (parsed.success) return { ok: true, resume: parsed.data }

  const issues: ResumeIssue[] = parsed.error.issues.map(issue => ({
    location: describePath(issue.path),
    message: describeIssue(issue),
  }))
  return {
    ok: false,
    message: `결과에서 ${issues.length}개의 형식 오류를 찾았습니다.`,
    issues,
    fixPrompt: buildFixPrompt(extracted.value, issues),
  }
}

// ---------------------------------------------------------------------------
// 프롬프트 길이 점검
// ---------------------------------------------------------------------------

/** 이 글자 수를 넘으면 결과 JSON이 중간에 잘리거나 품질이 떨어질 수 있어 경고한다 */
export const PROMPT_WARN_CHARS = 40_000
/** 이 글자 수를 넘으면 한 번에 실행하지 말고 문서를 나눠 실행하도록 안내한다 */
export const PROMPT_MAX_CHARS = 100_000

export type PromptLengthLevel = 'ok' | 'warn' | 'too_long'

export interface PromptLengthReport {
  /** 지시문과 문서를 합친 프롬프트 전체 글자 수 */
  totalChars: number
  /** 문서별 본문 글자 수 (긴 순) */
  perDocument: { id: string; title: string; chars: number }[]
  level: PromptLengthLevel
  /** 화면에 보여줄 안내 문장 (ok면 빈 문자열) */
  message: string
}

export function checkPromptLength(
  documents: PromptDocument[],
  limits: { warn?: number; max?: number } = {}
): PromptLengthReport {
  const warn = limits.warn ?? PROMPT_WARN_CHARS
  const max = limits.max ?? PROMPT_MAX_CHARS
  const totalChars = buildMergePrompt(documents).length
  const perDocument = documents
    .map(d => ({ id: d.id, title: d.title, chars: d.text.length }))
    .sort((a, b) => b.chars - a.chars)

  const level: PromptLengthLevel =
    totalChars > max ? 'too_long' : totalChars > warn ? 'warn' : 'ok'

  const biggest = perDocument
    .slice(0, 3)
    .map(d => `${d.title}(${d.chars.toLocaleString('ko-KR')}자)`)
    .join(', ')
  const total = totalChars.toLocaleString('ko-KR')

  const message =
    level === 'too_long'
      ? `프롬프트가 ${total}자로 너무 깁니다. 한 번에 실행하면 AI가 끝까지 처리하지 못할 수 있어요. 분량이 큰 문서(${biggest})를 제외하고 나눠서 실행해 주세요.`
      : level === 'warn'
        ? `프롬프트가 ${total}자로 깁니다. 결과가 중간에 잘리면 분량이 큰 문서(${biggest})를 제외하고 다시 시도해 주세요.`
        : ''

  return { totalChars, perDocument, level, message }
}
