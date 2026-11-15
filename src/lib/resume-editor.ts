// 편집 상태(수락·거절·수정·충돌 선택)와 최종본 계산 — 순수 함수로 구성해 테스트하기 쉽게 한다.
// 원본 병합 결과(Resume)는 바꾸지 않고, 사용자의 결정만 상태로 쌓아 최종본을 만든다. (PRD §3.4)
import type { Achievement, Resume } from '@/types/resume'
import type { DiffSection } from '@/lib/resume-diff'

export const SECTIONS: DiffSection[] = [
  'experiences',
  'projects',
  'skills',
  'educations',
  'certifications',
]

export const itemKey = (section: DiffSection, id: string) => `${section}:${id}`
const fieldKey = (key: string, field: string) => `${key}.${field}`
const achievementKey = (key: string, index: number) => `${key}#${index}`

export interface EditorState {
  /** 거절한 항목 키 */
  rejectedItems: string[]
  /** 거절한 성과 키 (항목 키 + 인덱스) */
  rejectedAchievements: string[]
  /** 직접 수정한 필드 값 */
  fieldEdits: Record<string, string>
  /** 직접 수정한 성과 문장 */
  achievementEdits: Record<string, string>
  /** 충돌 선택값 */
  resolutions: Record<string, string | undefined>
}

export const createInitialState = (): EditorState => ({
  rejectedItems: [],
  rejectedAchievements: [],
  fieldEdits: {},
  achievementEdits: {},
  resolutions: {},
})

export type EditorAction =
  | { type: 'toggleItem'; itemKey: string }
  | { type: 'toggleAchievement'; itemKey: string; index: number }
  | { type: 'editField'; itemKey: string; field: string; value: string }
  | { type: 'editAchievement'; itemKey: string; index: number; value: string }
  | {
      type: 'resolveConflict'
      itemKey: string
      field: string
      value: string | undefined
    }
  | { type: 'reset' }

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter(v => v !== value) : [...list, value]

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case 'toggleItem':
      return {
        ...state,
        rejectedItems: toggle(state.rejectedItems, action.itemKey),
      }
    case 'toggleAchievement':
      return {
        ...state,
        rejectedAchievements: toggle(
          state.rejectedAchievements,
          achievementKey(action.itemKey, action.index)
        ),
      }
    case 'editField':
      return {
        ...state,
        fieldEdits: {
          ...state.fieldEdits,
          [fieldKey(action.itemKey, action.field)]: action.value,
        },
      }
    case 'editAchievement':
      return {
        ...state,
        achievementEdits: {
          ...state.achievementEdits,
          [achievementKey(action.itemKey, action.index)]: action.value,
        },
      }
    case 'resolveConflict':
      return {
        ...state,
        resolutions: {
          ...state.resolutions,
          [fieldKey(action.itemKey, action.field)]: action.value,
        },
      }
    case 'reset':
      return createInitialState()
  }
}

type AnyItem = {
  id: string
  conflicts: { field: string }[]
  achievements?: Achievement[]
} & Record<string, unknown>

const sectionItems = (resume: Resume, section: DiffSection): AnyItem[] =>
  resume[section] as unknown as AnyItem[]

// 값이 비어 있지 않은 선택만 '해결됨'으로 본다
const isFilled = (value: string | undefined) => (value?.trim() ?? '') !== ''

// 종료일 "현재"는 진행 중(null)으로 바꿔 저장한다
const toFieldValue = (field: string, value: string): string | null =>
  field === 'endDate' && value.trim() === '현재' ? null : value

/** 거절하지 않은 항목 중 아직 선택하지 않은 충돌 개수 */
export function countUnresolvedConflicts(
  resume: Resume,
  state: EditorState
): number {
  let count = 0
  for (const section of SECTIONS) {
    for (const item of sectionItems(resume, section)) {
      const key = itemKey(section, item.id)
      if (state.rejectedItems.includes(key)) continue
      for (const conflict of item.conflicts) {
        if (!isFilled(state.resolutions[fieldKey(key, conflict.field)])) {
          count++
        }
      }
    }
  }
  return count
}

/** 충돌이 모두 해결돼야 확정(저장)할 수 있다 */
export const canFinalize = (resume: Resume, state: EditorState) =>
  countUnresolvedConflicts(resume, state) === 0

/**
 * 사용자의 결정을 반영한 최종본을 만든다.
 * 거절한 항목·성과는 제외하고, 충돌 선택 → 직접 수정 순서로 값을 덮어쓴다.
 */
export function buildFinalResume(resume: Resume, state: EditorState): Resume {
  const result = { ...resume } as Record<string, unknown>

  for (const section of SECTIONS) {
    result[section] = sectionItems(resume, section)
      .filter(item => !state.rejectedItems.includes(itemKey(section, item.id)))
      .map(item => {
        const key = itemKey(section, item.id)
        const next: Record<string, unknown> = { ...item }

        for (const conflict of item.conflicts) {
          const chosen = state.resolutions[fieldKey(key, conflict.field)]
          if (isFilled(chosen)) {
            next[conflict.field] = toFieldValue(conflict.field, chosen!)
          }
        }
        // 충돌 선택이 끝난 항목은 충돌 목록을 비운다
        next.conflicts = item.conflicts.filter(
          c => !isFilled(state.resolutions[fieldKey(key, c.field)])
        )

        const prefix = `${key}.`
        for (const [k, value] of Object.entries(state.fieldEdits)) {
          if (k.startsWith(prefix)) {
            const field = k.slice(prefix.length)
            next[field] = toFieldValue(field, value)
          }
        }

        if (item.achievements) {
          next.achievements = item.achievements
            .map((a, index) => ({ a, index }))
            .filter(
              ({ index }) =>
                !state.rejectedAchievements.includes(achievementKey(key, index))
            )
            .map(({ a, index }) => ({
              ...a,
              text:
                state.achievementEdits[achievementKey(key, index)] ?? a.text,
            }))
        }
        return next
      })
  }

  return result as unknown as Resume
}
