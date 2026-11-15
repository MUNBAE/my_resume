// 테스트 전용 가상 데이터 (실제 개인 정보를 쓰지 않는다)
import { resumeSchema, type Resume, type SourceRef } from '@/types/resume'

export const SRC_A: SourceRef = { documentId: 'doc-a', title: '이력서' }
export const SRC_B: SourceRef = { documentId: 'doc-b', title: '지원서' }
export const SRC_FAKE: SourceRef = {
  documentId: 'doc-fake',
  title: '없는 문서',
}

type ExperienceInput = {
  id: string
  company: string
  startDate: string
  endDate: string | null
  position?: string
  summary?: string
  sources?: SourceRef[]
  achievements?: unknown[]
  conflicts?: unknown[]
}

/** 최소 필드만 주면 스키마를 통과하는 경력 항목을 만든다 */
export const experience = (e: ExperienceInput) => ({
  sources: [SRC_A],
  achievements: [],
  conflicts: [],
  ...e,
})

export const achievement = (
  text: string,
  origin: 'original' | 'enriched' = 'original',
  sources: SourceRef[] = [SRC_A]
) => ({ text, origin, sources })

/** 원하는 섹션만 채워 검증된 Resume을 만든다 */
export const makeResume = (parts: Record<string, unknown> = {}): Resume =>
  resumeSchema.parse(parts)

export const sampleResume = (): Resume =>
  makeResume({
    experiences: [
      experience({
        id: 'e1',
        company: 'A사',
        position: '선임',
        startDate: '2020-01',
        endDate: null,
        sources: [SRC_A, SRC_B],
        achievements: [
          achievement('원문 성과'),
          achievement('보강 성과', 'enriched', [SRC_B]),
        ],
        conflicts: [
          {
            field: 'position',
            candidates: [
              { value: '선임', sources: [SRC_A] },
              { value: '책임', sources: [SRC_B] },
            ],
          },
        ],
      }),
      experience({
        id: 'e2',
        company: 'B사',
        startDate: '2018-01',
        endDate: '2019-12',
        sources: [SRC_B],
      }),
    ],
    skills: [{ id: 's1', name: 'Go', sources: [SRC_A] }],
  })
