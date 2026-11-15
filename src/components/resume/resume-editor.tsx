'use client'

import { useMemo, useReducer, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ConflictResolver,
  type Resolutions,
} from '@/components/resume/conflict-resolver'
import { SourceBadges } from '@/components/resume/source-badge'
import { SECTION_LABELS, type DiffSection } from '@/lib/resume-diff'
import {
  SECTIONS,
  buildFinalResume,
  countUnresolvedConflicts,
  createInitialState,
  editorReducer,
  itemKey,
} from '@/lib/resume-editor'
import { cn } from '@/lib/utils'
import type { Achievement, Resume, SourceRef } from '@/types/resume'

// 섹션별로 직접 수정할 수 있는 필드 (첫 번째가 항목 제목)
const EDITABLE_FIELDS: Record<DiffSection, { field: string; label: string }[]> =
  {
    experiences: [
      { field: 'company', label: '회사' },
      { field: 'position', label: '직함' },
      { field: 'summary', label: '요약' },
    ],
    projects: [
      { field: 'name', label: '이름' },
      { field: 'role', label: '역할' },
      { field: 'summary', label: '요약' },
    ],
    skills: [{ field: 'name', label: '기술' }],
    educations: [
      { field: 'school', label: '학교' },
      { field: 'major', label: '전공' },
    ],
    certifications: [
      { field: 'name', label: '자격' },
      { field: 'issuer', label: '발급처' },
    ],
  }

type EditableItem = {
  id: string
  sources: SourceRef[]
  conflicts: { field: string; candidates: unknown[] }[]
  achievements?: Achievement[]
} & Record<string, unknown>

interface InlineTextProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

// 읽기 상태에서는 텍스트, '수정'을 누르면 입력창으로 바뀐다
function InlineText({ label, value, onChange, disabled }: InlineTextProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          aria-label={`${label} 수정`}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="h-8"
          autoFocus
        />
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
          완료
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-14 shrink-0 text-xs leading-6">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-sm break-words">
        {value || <span className="text-muted-foreground">(비어 있음)</span>}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled}
        aria-label={`${label} 수정`}
        onClick={() => setEditing(true)}
      >
        수정
      </Button>
    </div>
  )
}

interface ResumeEditorProps {
  resume: Resume
  /** 확정 시 최종본을 전달한다 (저장은 Phase 5에서 연결) */
  onFinalize?: (finalResume: Resume) => void
  className?: string
}

// 항목 단위 수락·거절·직접 수정·충돌 선택 (PRD §3.4)
export function ResumeEditor({
  resume,
  onFinalize,
  className,
}: ResumeEditorProps) {
  const [state, dispatch] = useReducer(
    editorReducer,
    undefined,
    createInitialState
  )
  const finalResume = useMemo(
    () => buildFinalResume(resume, state),
    [resume, state]
  )
  const unresolved = countUnresolvedConflicts(resume, state)

  // 거절하지 않은 항목은 최종본 값(충돌 선택·수정 반영)을 보여준다
  const finalItems = (section: DiffSection) =>
    new Map(
      (finalResume[section] as unknown as EditableItem[]).map(i => [i.id, i])
    )

  return (
    <div className={cn('space-y-8', className)}>
      <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <p className="text-sm" role="status">
          {unresolved > 0 ? (
            <>
              미해결 충돌 <strong>{unresolved}개</strong> — 모두 선택해야 확정할
              수 있습니다.
            </>
          ) : (
            '모든 충돌이 해결되었습니다.'
          )}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: 'reset' })}
          >
            초기화
          </Button>
          <Button
            size="sm"
            disabled={unresolved > 0}
            onClick={() => onFinalize?.(finalResume)}
          >
            확정
          </Button>
        </div>
      </div>

      {SECTIONS.map(section => {
        const items = resume[section] as unknown as EditableItem[]
        if (items.length === 0) return null
        const current = finalItems(section)
        const fields = EDITABLE_FIELDS[section]

        return (
          <section key={section} className="space-y-3">
            <h2 className="border-b pb-2 text-lg font-semibold">
              {SECTION_LABELS[section]}
            </h2>
            {items.map(original => {
              const key = itemKey(section, original.id)
              const rejected = state.rejectedItems.includes(key)
              const item = current.get(original.id) ?? original
              const resolutions: Resolutions = {}
              for (const c of original.conflicts) {
                resolutions[c.field] = state.resolutions[`${key}.${c.field}`]
              }

              return (
                <article
                  key={key}
                  aria-label={String(item[fields[0].field] ?? '')}
                  className={cn(
                    'space-y-2 rounded-lg border p-4',
                    rejected && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <SourceBadges sources={original.sources} />
                    <Button
                      size="sm"
                      variant={rejected ? 'secondary' : 'outline'}
                      onClick={() =>
                        dispatch({ type: 'toggleItem', itemKey: key })
                      }
                    >
                      {rejected ? '복원' : '거절'}
                    </Button>
                  </div>

                  <div className={cn(rejected && 'line-through')}>
                    {fields.map(({ field, label }) => (
                      <InlineText
                        key={field}
                        label={label}
                        disabled={rejected}
                        value={String(item[field] ?? '')}
                        onChange={value =>
                          dispatch({
                            type: 'editField',
                            itemKey: key,
                            field,
                            value,
                          })
                        }
                      />
                    ))}
                  </div>

                  {!rejected && original.conflicts.length > 0 && (
                    <ConflictResolver
                      conflicts={
                        original.conflicts as Parameters<
                          typeof ConflictResolver
                        >[0]['conflicts']
                      }
                      resolutions={resolutions}
                      onResolve={(field, value) =>
                        dispatch({
                          type: 'resolveConflict',
                          itemKey: key,
                          field,
                          value,
                        })
                      }
                    />
                  )}

                  {!rejected && original.achievements && (
                    <ul className="space-y-2">
                      {original.achievements.map((achievement, index) => {
                        const aKey = `${key}#${index}`
                        const aRejected =
                          state.rejectedAchievements.includes(aKey)
                        const text =
                          state.achievementEdits[aKey] ?? achievement.text
                        return (
                          <li
                            key={aKey}
                            className={cn(
                              'rounded-md border p-2',
                              aRejected && 'opacity-60'
                            )}
                          >
                            <div className={cn(aRejected && 'line-through')}>
                              <InlineText
                                label="성과"
                                disabled={aRejected}
                                value={text}
                                onChange={value =>
                                  dispatch({
                                    type: 'editAchievement',
                                    itemKey: key,
                                    index,
                                    value,
                                  })
                                }
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {achievement.origin === 'enriched' && (
                                <Badge variant="secondary">보강</Badge>
                              )}
                              <SourceBadges sources={achievement.sources} />
                              <Button
                                size="sm"
                                variant={aRejected ? 'secondary' : 'outline'}
                                onClick={() =>
                                  dispatch({
                                    type: 'toggleAchievement',
                                    itemKey: key,
                                    index,
                                  })
                                }
                              >
                                {aRejected ? '복원' : '거절'}
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
