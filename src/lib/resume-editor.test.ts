import { describe, expect, it } from 'vitest'

import {
  buildFinalResume,
  canFinalize,
  countUnresolvedConflicts,
  createInitialState,
  editorReducer,
  itemKey,
  type EditorAction,
} from '@/lib/resume-editor'
import { resumeSchema } from '@/types/resume'
import { sampleResume } from '@/test/fixtures'

const apply = (...actions: EditorAction[]) =>
  actions.reduce(editorReducer, createInitialState())

const E1 = itemKey('experiences', 'e1')
const E2 = itemKey('experiences', 'e2')

describe('충돌 처리', () => {
  it('처음에는 충돌이 미해결이라 확정할 수 없다', () => {
    const resume = sampleResume()
    expect(countUnresolvedConflicts(resume, createInitialState())).toBe(1)
    expect(canFinalize(resume, createInitialState())).toBe(false)
  })

  it('선택하면 해결되어 확정할 수 있고 값이 반영된다', () => {
    const resume = sampleResume()
    const state = apply({
      type: 'resolveConflict',
      itemKey: E1,
      field: 'position',
      value: '책임',
    })
    expect(canFinalize(resume, state)).toBe(true)
    const final = buildFinalResume(resume, state)
    expect(final.experiences[0].position).toBe('책임')
    expect(final.experiences[0].conflicts).toEqual([])
  })

  it('공백뿐인 선택은 미해결로 본다', () => {
    const state = apply({
      type: 'resolveConflict',
      itemKey: E1,
      field: 'position',
      value: '  ',
    })
    expect(countUnresolvedConflicts(sampleResume(), state)).toBe(1)
  })

  it('거절한 항목의 충돌은 세지 않는다', () => {
    const state = apply({ type: 'toggleItem', itemKey: E1 })
    expect(countUnresolvedConflicts(sampleResume(), state)).toBe(0)
  })

  it('종료일 "현재"를 고르면 null(진행 중)로 저장한다', () => {
    const resume = resumeSchema.parse({
      experiences: [
        {
          id: 'e1',
          company: 'A',
          startDate: '2020-01',
          endDate: '2022-01',
          sources: [{ documentId: 'd' }],
          conflicts: [
            {
              field: 'endDate',
              candidates: [
                { value: '현재', sources: [{ documentId: 'd' }] },
                { value: '2022-01', sources: [{ documentId: 'd' }] },
              ],
            },
          ],
        },
      ],
    })
    const state = apply({
      type: 'resolveConflict',
      itemKey: E1,
      field: 'endDate',
      value: '현재',
    })
    expect(buildFinalResume(resume, state).experiences[0].endDate).toBeNull()
  })
})

describe('거절·복원', () => {
  it('성과를 거절하면 최종본에서 빠지고 복원하면 돌아온다', () => {
    const resume = sampleResume()
    const reject: EditorAction = {
      type: 'toggleAchievement',
      itemKey: E1,
      index: 1,
    }
    expect(
      buildFinalResume(resume, apply(reject)).experiences[0].achievements
    ).toHaveLength(1)
    expect(
      buildFinalResume(resume, apply(reject, reject)).experiences[0]
        .achievements
    ).toHaveLength(2)
  })

  it('항목을 거절하면 최종본에서 빠진다', () => {
    const final = buildFinalResume(
      sampleResume(),
      apply({ type: 'toggleItem', itemKey: E2 })
    )
    expect(final.experiences.map(e => e.id)).toEqual(['e1'])
  })
})

describe('직접 수정', () => {
  it('필드와 성과 문장 수정이 최종본에 반영된다', () => {
    const final = buildFinalResume(
      sampleResume(),
      apply(
        {
          type: 'editField',
          itemKey: E1,
          field: 'company',
          value: 'A주식회사',
        },
        { type: 'editAchievement', itemKey: E1, index: 0, value: '수정한 성과' }
      )
    )
    expect(final.experiences[0].company).toBe('A주식회사')
    expect(final.experiences[0].achievements[0].text).toBe('수정한 성과')
  })

  it('직접 수정이 충돌 선택보다 우선한다', () => {
    const final = buildFinalResume(
      sampleResume(),
      apply(
        {
          type: 'resolveConflict',
          itemKey: E1,
          field: 'position',
          value: '책임',
        },
        { type: 'editField', itemKey: E1, field: 'position', value: '수석' }
      )
    )
    expect(final.experiences[0].position).toBe('수석')
  })
})

describe('공통', () => {
  it('원본을 바꾸지 않는다', () => {
    const resume = sampleResume()
    buildFinalResume(
      resume,
      apply(
        { type: 'toggleItem', itemKey: E2 },
        { type: 'editField', itemKey: E1, field: 'company', value: 'X' }
      )
    )
    expect(resume.experiences).toHaveLength(2)
    expect(resume.experiences[0].company).toBe('A사')
  })

  it('최종본은 스키마를 통과한다', () => {
    const state = apply({
      type: 'resolveConflict',
      itemKey: E1,
      field: 'position',
      value: '책임',
    })
    expect(
      resumeSchema.safeParse(buildFinalResume(sampleResume(), state)).success
    ).toBe(true)
  })

  it('reset 은 초기 상태로 돌린다', () => {
    const state = apply({ type: 'toggleItem', itemKey: E1 }, { type: 'reset' })
    expect(state).toEqual(createInitialState())
  })
})
