import { describe, expect, it } from 'vitest'

import {
  normalizeName,
  normalizeResume,
  sortByLatest,
  validateSources,
} from '@/lib/resume-normalize'
import {
  SRC_A,
  SRC_B,
  SRC_FAKE,
  achievement,
  experience,
  makeResume,
} from '@/test/fixtures'

const inputs = [
  { id: 'doc-a', title: '이력서' },
  { id: 'doc-b', title: '지원서' },
]

describe('normalizeName', () => {
  it('(주)·㈜·공백·대소문자를 무시한다', () => {
    expect(normalizeName('(주) A 컴퍼니')).toBe(normalizeName('A컴퍼니'))
    expect(normalizeName('A㈜')).toBe(normalizeName('a'))
    expect(normalizeName('주식회사 에이')).toBe(normalizeName('에이'))
  })
})

describe('sortByLatest', () => {
  it('진행 중 → 종료일 최신 → 시작일 순으로 정렬한다', () => {
    const sorted = sortByLatest([
      experience({
        id: '1',
        company: 'X',
        startDate: '2018-01',
        endDate: '2019-12',
      }),
      experience({
        id: '2',
        company: 'Y',
        startDate: '2022-03',
        endDate: null,
      }),
      experience({
        id: '3',
        company: 'Z',
        startDate: '2020-01',
        endDate: '2021-06',
      }),
      experience({
        id: '4',
        company: 'W',
        startDate: '2019-06',
        endDate: '2019-12',
      }),
    ])
    expect(sorted.map(e => e.id)).toEqual(['2', '3', '4', '1'])
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const original = [
      experience({
        id: '1',
        company: 'X',
        startDate: '2018-01',
        endDate: '2019-12',
      }),
      experience({
        id: '2',
        company: 'Y',
        startDate: '2022-03',
        endDate: null,
      }),
    ]
    const copy = [...original]
    sortByLatest(original)
    expect(original).toEqual(copy)
  })

  it('동률이면 원래 순서를 유지한다', () => {
    const sorted = sortByLatest([
      experience({
        id: 'a',
        company: 'A',
        startDate: '2020-01',
        endDate: '2020-12',
      }),
      experience({
        id: 'b',
        company: 'B',
        startDate: '2020-01',
        endDate: '2020-12',
      }),
    ])
    expect(sorted.map(e => e.id)).toEqual(['a', 'b'])
  })
})

describe('normalizeResume', () => {
  const merged = () =>
    normalizeResume(
      makeResume({
        experiences: [
          experience({
            id: 'e1',
            company: '(주)에이컴퍼니',
            startDate: '2021-03',
            endDate: null,
            sources: [SRC_A],
            achievements: [achievement('매출 20% 증가')],
          }),
          experience({
            id: 'e2',
            company: '에이컴퍼니',
            startDate: '2021-03',
            endDate: null,
            sources: [SRC_B],
            achievements: [
              achievement('매출  20% 증가', 'enriched', [SRC_B]),
              achievement('신규 성과', 'enriched', [SRC_B]),
            ],
          }),
          experience({
            id: 'e3',
            company: '비컴퍼니',
            startDate: '2019-01',
            endDate: '2020-12',
          }),
        ],
      })
    )

  it('표기만 다른 같은 회사·같은 시작일은 하나로 합친다', () => {
    expect(merged().experiences).toHaveLength(2)
  })

  it('출처를 합집합으로 보존한다', () => {
    const ids = merged()
      .experiences[0].sources.map(s => s.documentId)
      .sort()
    expect(ids).toEqual(['doc-a', 'doc-b'])
  })

  it('같은 성과는 한 번만 남기고 original 을 우선한다', () => {
    const { achievements } = merged().experiences[0]
    expect(achievements).toHaveLength(2)
    expect(achievements[0].origin).toBe('original')
  })

  it('최신순으로 정렬한다', () => {
    const names = merged().experiences.map(e => e.company)
    expect(names[1]).toBe('비컴퍼니')
  })

  it('시작일이 다르면 별개 항목으로 둔다', () => {
    const result = normalizeResume(
      makeResume({
        experiences: [
          experience({
            id: 'a',
            company: 'A',
            startDate: '2020-01',
            endDate: '2020-12',
          }),
          experience({
            id: 'b',
            company: 'A',
            startDate: '2022-01',
            endDate: null,
          }),
        ],
      })
    )
    expect(result.experiences).toHaveLength(2)
  })

  it('같은 필드의 충돌 후보를 합치고 출처를 보존한다', () => {
    const conflict = (value: string, src = SRC_A) => ({
      field: 'position',
      candidates: [
        { value, sources: [src] },
        { value: '공통', sources: [SRC_B] },
      ],
    })
    const result = normalizeResume(
      makeResume({
        experiences: [
          experience({
            id: 'a',
            company: 'A',
            startDate: '2020-01',
            endDate: null,
            conflicts: [conflict('대리')],
          }),
          experience({
            id: 'b',
            company: 'A',
            startDate: '2020-01',
            endDate: null,
            conflicts: [conflict('과장')],
          }),
        ],
      })
    )
    const values = result.experiences[0].conflicts[0].candidates.map(
      c => c.value
    )
    expect(values.sort()).toEqual(['공통', '과장', '대리'])
  })
})

describe('validateSources', () => {
  const resume = () =>
    makeResume({
      experiences: [
        experience({
          id: 'e1',
          company: 'A사',
          startDate: '2020-01',
          endDate: null,
          sources: [{ documentId: 'doc-a', title: '잘못된 제목' }, SRC_FAKE],
          achievements: [
            achievement('정상 성과'),
            achievement('지어낸 출처만 있는 성과입니다', 'enriched', [
              SRC_FAKE,
            ]),
            achievement('일부만 지어낸 성과', 'enriched', [SRC_B, SRC_FAKE]),
          ],
          conflicts: [
            {
              field: 'position',
              candidates: [
                { value: '대리', sources: [SRC_A] },
                { value: '과장', sources: [SRC_B] },
              ],
            },
            {
              field: 'endDate',
              candidates: [
                { value: '2022-01', sources: [SRC_A] },
                { value: '2023-01', sources: [SRC_FAKE] },
              ],
            },
          ],
        }),
        experience({
          id: 'e2',
          company: '유령회사',
          startDate: '2018-01',
          endDate: '2019-01',
          sources: [SRC_FAKE],
        }),
      ],
      skills: [
        { id: 's1', name: 'Go', sources: [SRC_B] },
        { id: 's2', name: '지어낸기술', sources: [SRC_FAKE] },
      ],
    })

  it('지어낸 출처만 있는 항목·기술은 제외한다', () => {
    const { resume: out } = validateSources(resume(), inputs)
    expect(out.experiences.map(e => e.id)).toEqual(['e1'])
    expect(out.skills.map(s => s.name)).toEqual(['Go'])
  })

  it('가짜 출처를 제거하고 제목을 실제 문서 제목으로 보정한다', () => {
    const { resume: out } = validateSources(resume(), inputs)
    expect(out.experiences[0].sources).toEqual([
      { documentId: 'doc-a', title: '이력서' },
    ])
  })

  it('가짜 출처뿐인 성과는 제외하고 일부만 가짜면 유효한 출처만 남긴다', () => {
    const { resume: out } = validateSources(resume(), inputs)
    const texts = out.experiences[0].achievements.map(a => a.text)
    expect(texts).toEqual(['정상 성과', '일부만 지어낸 성과'])
    expect(out.experiences[0].achievements[1].sources).toEqual([SRC_B])
  })

  it('후보가 1개로 줄어든 충돌은 제거하고 정상 충돌은 유지한다', () => {
    const { resume: out } = validateSources(resume(), inputs)
    expect(out.experiences[0].conflicts.map(c => c.field)).toEqual(['position'])
  })

  it('제거 내역을 한글 경고로 알려준다', () => {
    const { warnings } = validateSources(resume(), inputs)
    expect(
      warnings.some(w => w.includes('유령회사') && w.includes('제외'))
    ).toBe(true)
    expect(warnings.some(w => w.includes('doc-fake'))).toBe(true)
  })

  it('원본을 바꾸지 않는다', () => {
    const original = resume()
    validateSources(original, inputs)
    expect(original.experiences).toHaveLength(2)
    expect(original.experiences[0].sources).toHaveLength(2)
  })

  it('정상 입력은 경고 없이 그대로 통과한다', () => {
    const clean = makeResume({
      skills: [{ id: 's', name: 'Go', sources: [SRC_B] }],
    })
    const { resume: out, warnings } = validateSources(clean, inputs)
    expect(warnings).toEqual([])
    expect(out.skills).toHaveLength(1)
  })

  it('입력에서 빠진 문서의 출처는 걸러낸다', () => {
    const { warnings } = validateSources(resume(), [inputs[0]])
    expect(warnings.some(w => w.includes('doc-b'))).toBe(true)
  })
})
