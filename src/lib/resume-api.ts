// prompt·merge API의 요청 검증과 병합 파이프라인 (순수 함수 — Notion 호출 없음)
import { z } from 'zod'

import {
  buildMergePrompt,
  checkPromptLength,
  validateResumeJson,
  type PromptDocument,
  type PromptLengthReport,
} from '@/lib/merge-prompt'
import {
  normalizeResume,
  validateSources,
  type InputDocumentRef,
} from '@/lib/resume-normalize'
import type { Resume } from '@/types/resume'

const documentIdsSchema = z
  .array(z.string().min(1))
  .min(1, '문서를 한 개 이상 선택해 주세요')
  .max(20, '한 번에 선택할 수 있는 문서는 20개까지입니다')

export const promptRequestSchema = z.object({ documentIds: documentIdsSchema })

export const mergeRequestSchema = z.object({
  documentIds: documentIdsSchema,
  /** 사용자가 ChatGPT 등에서 받아 붙여 넣은 응답 전체 */
  result: z.string().trim().min(1, 'AI 결과를 붙여 넣어 주세요'),
})

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): ParseResult<T> {
  const parsed = schema.safeParse(body)
  if (parsed.success) return { ok: true, data: parsed.data }
  const issue = parsed.error.issues[0]
  return {
    ok: false,
    status: 400,
    message: `요청 형식이 올바르지 않습니다: ${issue.message}`,
  }
}

export interface PromptResponse {
  prompt: string
  length: PromptLengthReport
  /** 본문이 비어 있어 프롬프트에서 제외한 문서 제목 */
  skippedEmpty: string[]
  /** 프롬프트에 실제로 들어간 문서 ID (merge 요청에 그대로 보낸다) */
  documentIds: string[]
}

/** 본문이 없는 문서는 제외하고 프롬프트와 길이 정보를 만든다 */
export function buildPromptResponse(
  documents: PromptDocument[]
): PromptResponse {
  const usable = documents.filter(d => d.text.trim() !== '')
  return {
    prompt: buildMergePrompt(usable),
    length: checkPromptLength(usable),
    skippedEmpty: documents
      .filter(d => d.text.trim() === '')
      .map(d => d.title || d.id),
    documentIds: usable.map(d => d.id),
  }
}

export type MergeOutcome =
  | { ok: true; resume: Resume; warnings: string[] }
  | {
      ok: false
      message: string
      issues: { location: string; message: string }[]
      fixPrompt?: string
    }

/**
 * 붙여 넣은 AI 결과를 검증하고 정리한다.
 * 추출·스키마 검증 → 출처 검증(가짜 출처 제거) → 중복 병합·최신순 정렬 순서로 처리한다.
 */
export function processMergeResult(
  raw: string,
  inputDocuments: readonly InputDocumentRef[]
): MergeOutcome {
  const validated = validateResumeJson(raw)
  if (!validated.ok) return validated

  const { resume: sourced, warnings } = validateSources(
    validated.resume,
    inputDocuments
  )
  return { ok: true, resume: normalizeResume(sourced), warnings }
}
