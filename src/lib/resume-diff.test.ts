import { describe, expect, it } from 'vitest'

import {
  diffResume,
  pickBaselineDocument,
  summarizeDiff,
} from '@/lib/resume-diff'
import {
  SRC_A,
  SRC_B,
  achievement,
  experience,
  makeResume,
} from '@/test/fixtures'

// 기준본 = doc-a
const resume = () =>
  makeResume({
    experiences: [
      experience({
        id: 'same',
        company: 'A',
        startDate: '2020-01',
        endDate: null,
        sources: [SRC_A],
        achievements: [achievement('x')],
      }),
      experience({
        id: 'more',
        company: 'B',
        startDate: '2019-01',
        endDate: '2019-12',
        sources: [SRC_A, SRC_B],
        achievements: [achievement('y'), achievement('z', 'enriched', [SRC_B])],
      }),
      experience({
        id: 'conflict',
        company: 'C',
        startDate: '2018-01',
        endDate: '2018-12',
        sources: [SRC_A, SRC_B],
        conflicts: [
          {
            field: 'position',
            candidates: [
              { value: 'a', sources: [SRC_A] },
              { value: 'b', sources: [SRC_B] },
            ],
          },
        ],
      }),
      experience({
        id: 'new',
        company: 'D',
        startDate: '2017-01',
        endDate: '2017-12',
        sources: [SRC_B],
      }),
    ],
    skills: [{ id: 's1', name: 'Go', sources: [SRC_B] }],
  })

describe('diffResume', () => {
  const status = (id: string) =>
    diffResume(resume(), 'doc-a').find(e => e.id === id)!.status

  it('기준본 출처만 있고 달라진 것이 없으면 동일', () => {
    expect(status('same')).toBe('unchanged')
  })

  it('기준본에 없던 성과가 붙으면 변경', () => {
    expect(status('more')).toBe('changed')
  })

  it('충돌이 있으면 변경이고 충돌 필드를 알려준다', () => {
    expect(status('conflict')).toBe('changed')
    const entry = diffResume(resume(), 'doc-a').find(e => e.id === 'conflict')!
    expect(entry.conflictFields).toEqual(['position'])
  })

  it('기준본 출처가 없는 항목은 추가', () => {
    expect(status('new')).toBe('added')
    expect(status('s1')).toBe('added')
  })

  it('추가된 성과만 골라 돌려준다', () => {
    const entry = diffResume(resume(), 'doc-a').find(e => e.id === 'more')!
    expect(entry.addedAchievements.map(a => a.text)).toEqual(['z'])
  })

  it('요약 개수가 맞는다', () => {
    expect(summarizeDiff(diffResume(resume(), 'doc-a'))).toEqual({
      added: 2,
      changed: 2,
      unchanged: 1,
    })
  })
})

describe('pickBaselineDocument', () => {
  const docs = [
    { id: 'a', title: '입사지원서', lastEditedTime: '2026-11-14T09:00' },
    { id: 'b', title: '이력서(삼성)', lastEditedTime: '2026-11-14T08:00' },
    { id: 'c', title: '손문배', lastEditedTime: '2026-11-14T10:00' },
  ]

  it('이력서 제목이 있으면 가장 최근 수정본과 상관없이 우선한다', () => {
    expect(pickBaselineDocument(docs)?.id).toBe('b')
  })

  it('이력서 제목이 없으면 가장 최근 수정본을 고른다', () => {
    expect(pickBaselineDocument(docs.filter(d => d.id !== 'b'))?.id).toBe('c')
  })

  it('문서가 없으면 undefined', () => {
    expect(pickBaselineDocument([])).toBeUndefined()
  })
})
