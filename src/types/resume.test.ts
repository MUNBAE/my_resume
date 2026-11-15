import { describe, expect, it } from 'vitest'

import { OUTPUT_EXAMPLE } from '@/lib/merge-prompt'
import { achievement, experience, SRC_A } from '@/test/fixtures'
import { resumeSchema } from '@/types/resume'

const parse = (experiences: unknown[]) =>
  resumeSchema.safeParse({ experiences })

describe('resumeSchema', () => {
  it('프롬프트에 넣는 예시 JSON은 스키마를 통과한다', () => {
    expect(resumeSchema.safeParse(OUTPUT_EXAMPLE).success).toBe(true)
  })

  it('빈 객체는 모든 섹션이 빈 배열로 채워진다', () => {
    const result = resumeSchema.parse({})
    expect(result).toEqual({
      experiences: [],
      projects: [],
      skills: [],
      educations: [],
      certifications: [],
    })
  })

  it('출처가 없는 항목은 실패하고 메시지가 한글이다', () => {
    const result = parse([
      experience({
        id: 'e',
        company: 'A',
        startDate: '2020-01',
        endDate: null,
        sources: [],
      }),
    ])
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('출처가 필요합니다')
    }
  })

  it('보강 성과도 출처가 없으면 실패한다', () => {
    const result = parse([
      experience({
        id: 'e',
        company: 'A',
        startDate: '2020-01',
        endDate: null,
        achievements: [achievement('x', 'enriched', [])],
      }),
    ])
    expect(result.success).toBe(false)
  })

  it.each(['2020/01', '20-01', '2020-1', '2020-13x', ''])(
    '잘못된 날짜 형식 %s 는 거부한다',
    startDate => {
      expect(
        parse([experience({ id: 'e', company: 'A', startDate, endDate: null })])
          .success
      ).toBe(false)
    }
  )

  it.each(['2020', '2020-01'])('올바른 날짜 형식 %s 는 통과한다', startDate => {
    expect(
      parse([experience({ id: 'e', company: 'A', startDate, endDate: null })])
        .success
    ).toBe(true)
  })

  it('origin 값은 original·enriched 만 허용한다', () => {
    const bad = parse([
      experience({
        id: 'e',
        company: 'A',
        startDate: '2020-01',
        endDate: null,
        achievements: [{ text: 'x', origin: 'added', sources: [SRC_A] }],
      }),
    ])
    expect(bad.success).toBe(false)
  })

  it('충돌 후보는 2개 이상이어야 한다', () => {
    const result = parse([
      experience({
        id: 'e',
        company: 'A',
        startDate: '2020-01',
        endDate: null,
        conflicts: [
          {
            field: 'position',
            candidates: [{ value: '대리', sources: [SRC_A] }],
          },
        ],
      }),
    ])
    expect(result.success).toBe(false)
  })

  it('충돌 후보 값 null(현재)은 문자열 "현재"로 받아들인다', () => {
    const result = resumeSchema.parse({
      experiences: [
        experience({
          id: 'e',
          company: 'A',
          startDate: '2020-01',
          endDate: null,
          conflicts: [
            {
              field: 'endDate',
              candidates: [
                { value: null, sources: [SRC_A] },
                { value: '2022-01', sources: [SRC_A] },
              ],
            },
          ],
        }),
      ],
    })
    expect(result.experiences[0].conflicts[0].candidates[0].value).toBe('현재')
  })

  it('학력의 학위·졸업 여부·학점·교육과정, 자격의 등급을 보존한다', () => {
    const result = resumeSchema.parse({
      educations: [
        {
          id: 'edu',
          school: '대학',
          degree: '학사',
          status: '졸업',
          gpa: '3.7 / 4.5',
          program: '과정',
          sources: [SRC_A],
        },
      ],
      certifications: [
        { id: 'crt', name: 'OPIC', grade: 'IM1', sources: [SRC_A] },
      ],
    })
    expect(result.educations[0]).toMatchObject({
      degree: '학사',
      status: '졸업',
      gpa: '3.7 / 4.5',
      program: '과정',
    })
    expect(result.certifications[0].grade).toBe('IM1')
  })

  it('진행 중(endDate null)을 허용한다', () => {
    const result = resumeSchema.parse({
      experiences: [
        experience({
          id: 'e',
          company: 'A',
          startDate: '2020-01',
          endDate: null,
        }),
      ],
    })
    expect(result.experiences[0].endDate).toBeNull()
  })
})
