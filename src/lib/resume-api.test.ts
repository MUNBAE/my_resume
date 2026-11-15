import { describe, expect, it } from 'vitest'

import { OUTPUT_EXAMPLE } from '@/lib/merge-prompt'
import {
  buildPromptResponse,
  mergeRequestSchema,
  parseBody,
  processMergeResult,
  promptRequestSchema,
} from '@/lib/resume-api'
import {
  countRemainingConflicts,
  validateSaveRequest,
} from '@/lib/save-request'
import { sampleResume } from '@/test/fixtures'

describe('parseBody', () => {
  it('문서 ID가 없으면 한글 메시지로 거부한다', () => {
    const r = parseBody(promptRequestSchema, { documentIds: [] })
    expect(!r.ok && r.status === 400 && r.message.includes('한 개 이상')).toBe(
      true
    )
  })

  it('문서는 20개까지만 허용한다', () => {
    const ids = Array.from({ length: 21 }, (_, i) => `d${i}`)
    expect(parseBody(promptRequestSchema, { documentIds: ids }).ok).toBe(false)
  })

  it('merge 요청은 AI 결과가 비어 있으면 거부한다', () => {
    const r = parseBody(mergeRequestSchema, {
      documentIds: ['a'],
      result: '   ',
    })
    expect(!r.ok && r.message.includes('붙여 넣어')).toBe(true)
  })

  it('정상 요청은 통과한다', () => {
    expect(
      parseBody(mergeRequestSchema, { documentIds: ['a'], result: '{}' }).ok
    ).toBe(true)
  })
})

describe('buildPromptResponse', () => {
  it('본문이 빈 문서는 프롬프트에서 제외하고 알려준다', () => {
    const r = buildPromptResponse([
      { id: 'a', title: '이력서', text: '내용' },
      { id: 'b', title: '빈 문서', text: '  \n ' },
    ])
    expect(r.documentIds).toEqual(['a'])
    expect(r.skippedEmpty).toEqual(['빈 문서'])
    expect(r.prompt).toContain('문서 ID: a')
    expect(r.prompt).not.toContain('문서 ID: b')
    expect(r.length.perDocument).toHaveLength(1)
  })
})

describe('processMergeResult', () => {
  const docIds = ['문서ID-1', '문서ID-2']
  const inputs = docIds.map(id => ({ id, title: `제목 ${id}` }))

  it('유효한 결과는 출처 검증과 정규화를 거쳐 돌려준다', () => {
    const r = processMergeResult(JSON.stringify(OUTPUT_EXAMPLE), inputs)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.warnings).toEqual([])
      // 제목은 실제 입력 문서 제목으로 보정된다
      expect(r.resume.experiences[0].sources[0].title).toBe('제목 문서ID-1')
    }
  })

  it('입력에 없는 문서의 출처는 경고와 함께 걸러낸다', () => {
    const r = processMergeResult(JSON.stringify(OUTPUT_EXAMPLE), [inputs[0]])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('형식 오류는 오류 목록과 수정 요청 프롬프트를 돌려준다', () => {
    const broken = structuredClone(OUTPUT_EXAMPLE) as unknown as {
      experiences: { sources: unknown[] }[]
    }
    broken.experiences[0].sources = []
    const r = processMergeResult(JSON.stringify(broken), inputs)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues.length).toBeGreaterThan(0)
      expect(r.fixPrompt).toBeTruthy()
    }
  })

  it('JSON이 아닌 응답은 메시지만 돌려준다', () => {
    const r = processMergeResult('이력서를 만들 수 없습니다.', inputs)
    expect(!r.ok && r.fixPrompt === undefined).toBe(true)
  })
})

describe('validateSaveRequest', () => {
  const resolved = () => ({
    title: '통합 이력서',
    resume: {
      skills: [{ id: 's', name: 'Go', sources: [{ documentId: 'd' }] }],
    },
  })

  it('정상 요청은 통과한다', () => {
    expect(validateSaveRequest(resolved()).ok).toBe(true)
  })

  it('제목이 비어 있으면 400', () => {
    const r = validateSaveRequest({ ...resolved(), title: '  ' })
    expect(!r.ok && r.status === 400 && r.message.includes('제목')).toBe(true)
  })

  it('출처 없는 항목은 항목 경로와 함께 400', () => {
    const r = validateSaveRequest({
      title: 'x',
      resume: { skills: [{ id: 's', name: 'Go', sources: [] }] },
    })
    expect(
      !r.ok && r.status === 400 && r.message.includes('resume.skills.0.sources')
    ).toBe(true)
  })

  it('해결하지 않은 충돌이 있으면 422와 개수를 안내한다', () => {
    const r = validateSaveRequest({ title: 'x', resume: sampleResume() })
    expect(!r.ok && r.status === 422 && r.message.includes('1개')).toBe(true)
  })

  it('남은 충돌 개수를 센다', () => {
    expect(countRemainingConflicts(sampleResume())).toBe(1)
  })
})
