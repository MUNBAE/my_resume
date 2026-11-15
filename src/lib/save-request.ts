// 저장 요청 검증 (순수 함수) — Notion 호출 없이 테스트할 수 있도록 라우트에서 분리했다
import { z } from 'zod'

import { resumeSchema, type Resume } from '@/types/resume'

export const saveRequestSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해 주세요').max(200),
  resume: resumeSchema,
})

export type SaveRequest = { title: string; resume: Resume }

export type SaveValidation =
  | { ok: true; data: SaveRequest }
  | { ok: false; status: number; message: string }

/** 최종본에 남아 있는 충돌 개수 (확정 전에 모두 해결되어 있어야 한다) */
export function countRemainingConflicts(resume: Resume): number {
  return [
    ...resume.experiences,
    ...resume.projects,
    ...resume.skills,
    ...resume.educations,
    ...resume.certifications,
  ].reduce((sum, item) => sum + item.conflicts.length, 0)
}

export function validateSaveRequest(body: unknown): SaveValidation {
  const parsed = saveRequestSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue.path.length > 0 ? ` (${issue.path.join('.')})` : ''
    return {
      ok: false,
      status: 400,
      message: `요청 형식이 올바르지 않습니다: ${issue.message}${where}`,
    }
  }

  const remaining = countRemainingConflicts(parsed.data.resume)
  if (remaining > 0) {
    return {
      ok: false,
      status: 422,
      message: `해결하지 않은 충돌이 ${remaining}개 있습니다. 모두 선택한 뒤 저장해 주세요.`,
    }
  }

  return { ok: true, data: parsed.data }
}
