// 기준본 대비 변경점 계산 (순수 함수).
// 수동 연계에서는 기준본을 별도 이력서 데이터로 파싱하지 않으므로, 각 항목의 출처(sources)에
// 기준본 문서가 포함되는지로 판단한다. (PRD §3.4, ROADMAP 4.7 가정안)
import type { Achievement, Resume, SourceRef } from '@/types/resume'

export type DiffStatus = 'added' | 'changed' | 'unchanged'

export type DiffSection =
  | 'experiences'
  | 'projects'
  | 'skills'
  | 'educations'
  | 'certifications'

export const SECTION_LABELS: Record<DiffSection, string> = {
  experiences: '경력',
  projects: '프로젝트',
  skills: '기술',
  educations: '학력',
  certifications: '자격·수상',
}

export interface DiffEntry {
  section: DiffSection
  id: string
  label: string
  status: DiffStatus
  /** 기준본 문서에는 없던 성과 */
  addedAchievements: Achievement[]
  /** 문서마다 값이 달라 충돌이 있는 필드 */
  conflictFields: string[]
}

const hasSource = (sources: SourceRef[], documentId: string) =>
  sources.some(s => s.documentId === documentId)

// 선택 문서 중 기준본을 고른다: 이력서 성격의 제목 우선, 그다음 최근 수정본
export function pickBaselineDocument<
  T extends { id: string; title: string; lastEditedTime: string },
>(documents: readonly T[]): T | undefined {
  const byRecent = [...documents].sort((a, b) =>
    b.lastEditedTime.localeCompare(a.lastEditedTime)
  )
  const resumeLike = byRecent.find(d => /이력서|resume|cv/i.test(d.title))
  return resumeLike ?? byRecent[0]
}

function classify(
  sources: SourceRef[],
  conflictFields: string[],
  addedAchievements: Achievement[],
  baselineId: string
): DiffStatus {
  if (!hasSource(sources, baselineId)) return 'added'
  if (conflictFields.length > 0 || addedAchievements.length > 0) {
    return 'changed'
  }
  return 'unchanged'
}

export function diffResume(
  resume: Resume,
  baselineDocumentId: string
): DiffEntry[] {
  const entries: DiffEntry[] = []

  const push = (
    section: DiffSection,
    item: {
      id: string
      sources: SourceRef[]
      conflicts: { field: string }[]
      achievements?: Achievement[]
    },
    label: string
  ) => {
    const addedAchievements = (item.achievements ?? []).filter(
      a => !hasSource(a.sources, baselineDocumentId)
    )
    const conflictFields = item.conflicts.map(c => c.field)
    entries.push({
      section,
      id: item.id,
      label,
      status: classify(
        item.sources,
        conflictFields,
        addedAchievements,
        baselineDocumentId
      ),
      addedAchievements,
      conflictFields,
    })
  }

  for (const e of resume.experiences) {
    push('experiences', e, [e.company, e.position].filter(Boolean).join(' · '))
  }
  for (const p of resume.projects) push('projects', p, p.name)
  for (const s of resume.skills) push('skills', s, s.name)
  for (const e of resume.educations) {
    push('educations', e, [e.school, e.major].filter(Boolean).join(' · '))
  }
  for (const c of resume.certifications) push('certifications', c, c.name)

  return entries
}

export function summarizeDiff(entries: DiffEntry[]) {
  return {
    added: entries.filter(e => e.status === 'added').length,
    changed: entries.filter(e => e.status === 'changed').length,
    unchanged: entries.filter(e => e.status === 'unchanged').length,
  }
}
