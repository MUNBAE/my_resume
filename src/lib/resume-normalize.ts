// AI 결과 후처리: 결정적(순수) 함수만 둔다 — 같은 입력이면 항상 같은 결과
import type {
  Achievement,
  Conflict,
  Education,
  Experience,
  Project,
  Resume,
  SourceRef,
} from '@/types/resume'

// 회사·프로젝트 이름을 비교용으로 정규화한다: (주), ㈜, 주식회사, 공백·기호 제거
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|co\.,?\s*ltd\.?|inc\.?/g, '')
    .replace(/[\s\-_.,()·/]/g, '')
}

// 진행 중(null)을 가장 최신으로 취급하는 정렬 키
const endKey = (end: string | null | undefined): string =>
  end === null || end === undefined ? '9999-99' : end

// 최신순 비교: 종료일(진행 중 우선) → 시작일 내림차순
function compareLatest(
  a: { startDate?: string; endDate?: string | null },
  b: { startDate?: string; endDate?: string | null }
): number {
  const byEnd = endKey(b.endDate).localeCompare(endKey(a.endDate))
  if (byEnd !== 0) return byEnd
  return (b.startDate ?? '').localeCompare(a.startDate ?? '')
}

// 원본을 바꾸지 않고 최신순으로 정렬한다 (동률이면 원래 순서 유지)
export function sortByLatest<
  T extends { startDate?: string; endDate?: string | null },
>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compareLatest(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item)
}

const sourceKey = (s: SourceRef) => s.documentId

function mergeSources(a: SourceRef[], b: SourceRef[]): SourceRef[] {
  const seen = new Map<string, SourceRef>()
  for (const s of [...a, ...b]) {
    if (!seen.has(sourceKey(s))) seen.set(sourceKey(s), s)
  }
  return [...seen.values()]
}

function mergeAchievements(a: Achievement[], b: Achievement[]): Achievement[] {
  const byText = new Map<string, Achievement>()
  for (const item of [...a, ...b]) {
    const key = item.text.replace(/\s+/g, '')
    const existing = byText.get(key)
    byText.set(
      key,
      existing
        ? {
            ...existing,
            // 원문에 있던 성과가 하나라도 있으면 original 로 본다
            origin:
              existing.origin === 'original' || item.origin === 'original'
                ? 'original'
                : 'enriched',
            sources: mergeSources(existing.sources, item.sources),
          }
        : item
    )
  }
  return [...byText.values()]
}

function mergeConflicts(a: Conflict[], b: Conflict[]): Conflict[] {
  const byField = new Map<string, Conflict>()
  for (const conflict of [...a, ...b]) {
    const existing = byField.get(conflict.field)
    if (!existing) {
      byField.set(conflict.field, conflict)
      continue
    }
    const values = new Map(existing.candidates.map(c => [c.value, c]))
    for (const candidate of conflict.candidates) {
      const found = values.get(candidate.value)
      values.set(
        candidate.value,
        found
          ? {
              ...found,
              sources: mergeSources(found.sources, candidate.sources),
            }
          : candidate
      )
    }
    byField.set(conflict.field, {
      ...existing,
      candidates: [...values.values()],
    })
  }
  return [...byField.values()]
}

/**
 * 같은 키의 항목을 하나로 합친다. 먼저 나온 항목을 기준으로 하고
 * 출처·성과·충돌 후보는 합집합으로 보존한다.
 */
export function dedupeByKey<T extends Experience | Project>(
  items: readonly T[],
  keyOf: (item: T) => string
): T[] {
  const merged = new Map<string, T>()
  for (const item of items) {
    const key = keyOf(item)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, item)
      continue
    }
    merged.set(key, {
      ...existing,
      sources: mergeSources(existing.sources, item.sources),
      achievements: mergeAchievements(existing.achievements, item.achievements),
      conflicts: mergeConflicts(existing.conflicts, item.conflicts),
    })
  }
  return [...merged.values()]
}

export const experienceKey = (e: Experience): string =>
  `${normalizeName(e.company)}|${e.startDate}`

export const projectKey = (p: Project): string =>
  `${normalizeName(p.name)}|${p.startDate ?? ''}`

const educationKey = (e: Education): string =>
  `${normalizeName(e.school)}|${normalizeName(e.major ?? '')}|${e.startDate ?? ''}`

// 학력은 동일 항목만 단순 제거한다 (성과 필드가 없다)
function dedupeEducations(items: readonly Education[]): Education[] {
  const merged = new Map<string, Education>()
  for (const item of items) {
    const key = educationKey(item)
    const existing = merged.get(key)
    merged.set(
      key,
      existing
        ? {
            ...existing,
            sources: mergeSources(existing.sources, item.sources),
            conflicts: mergeConflicts(existing.conflicts, item.conflicts),
          }
        : item
    )
  }
  return [...merged.values()]
}

// 중복 제거 후 최신순 정렬 (PRD §3.2)
export function normalizeResume(resume: Resume): Resume {
  return {
    ...resume,
    experiences: sortByLatest(dedupeByKey(resume.experiences, experienceKey)),
    projects: sortByLatest(dedupeByKey(resume.projects, projectKey)),
    educations: sortByLatest(dedupeEducations(resume.educations)),
  }
}
