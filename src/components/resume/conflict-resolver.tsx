'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SourceBadges } from '@/components/resume/source-badge'
import { cn } from '@/lib/utils'
import type { Conflict } from '@/types/resume'

// 필드명 → 화면에 보여줄 이름
const FIELD_LABELS: Record<string, string> = {
  company: '회사',
  position: '직함',
  startDate: '시작일',
  endDate: '종료일',
  name: '이름',
  role: '역할',
  school: '학교',
  major: '전공',
  issuer: '발급처',
  date: '취득일',
  summary: '요약',
}

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field

// 선택값 맵: 필드명 → 사용자가 확정한 값
export type Resolutions = Record<string, string | undefined>

export const isResolved = (field: string, resolutions: Resolutions) =>
  (resolutions[field]?.trim() ?? '') !== ''

export const countUnresolved = (
  conflicts: Conflict[],
  resolutions: Resolutions
) => conflicts.filter(c => !isResolved(c.field, resolutions)).length

interface ConflictResolverProps {
  conflicts: Conflict[]
  resolutions: Resolutions
  onResolve: (field: string, value: string | undefined) => void
  className?: string
}

// 값이 서로 다른 필드를 자동으로 고르지 않고 사용자가 선택하게 한다 (PRD §3.2)
export function ConflictResolver({
  conflicts,
  resolutions,
  onResolve,
  className,
}: ConflictResolverProps) {
  // 직접 입력을 고른 필드 목록
  const [customFields, setCustomFields] = useState<Set<string>>(new Set())

  if (conflicts.length === 0) return null

  const setCustom = (field: string, on: boolean) =>
    setCustomFields(prev => {
      const next = new Set(prev)
      if (on) next.add(field)
      else next.delete(field)
      return next
    })

  return (
    <div className={cn('space-y-3', className)}>
      {conflicts.map(conflict => {
        const { field } = conflict
        const value = resolutions[field]
        const isCustom =
          customFields.has(field) ||
          (value !== undefined &&
            value !== '' &&
            !conflict.candidates.some(c => c.value === value))
        const resolved = isResolved(field, resolutions)
        const name = `conflict-${field}`

        return (
          <fieldset
            key={field}
            className={cn(
              'space-y-2 rounded-lg border p-3',
              !resolved && 'border-destructive/50'
            )}
          >
            <legend className="flex items-center gap-2 px-1 text-sm font-medium">
              {fieldLabel(field)} 충돌
              <Badge variant={resolved ? 'secondary' : 'destructive'}>
                {resolved ? '해결됨' : '미해결'}
              </Badge>
            </legend>
            {conflict.candidates.map((candidate, index) => {
              const id = `${name}-${index}`
              return (
                <label
                  key={id}
                  htmlFor={id}
                  className="hover:bg-accent/40 flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm"
                >
                  <input
                    id={id}
                    type="radio"
                    name={name}
                    className="mt-1"
                    checked={!isCustom && value === candidate.value}
                    onChange={() => {
                      setCustom(field, false)
                      onResolve(field, candidate.value)
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="break-words">{candidate.value}</span>
                    <SourceBadges
                      sources={candidate.sources}
                      className="mt-1 flex"
                    />
                  </span>
                </label>
              )
            })}
            <div className="flex items-center gap-2 p-2">
              <input
                id={`${name}-custom`}
                type="radio"
                name={name}
                checked={isCustom}
                onChange={() => {
                  setCustom(field, true)
                  onResolve(field, '')
                }}
              />
              <label htmlFor={`${name}-custom`} className="text-sm">
                직접 입력
              </label>
              <Input
                aria-label={`${fieldLabel(field)} 직접 입력`}
                value={isCustom ? (value ?? '') : ''}
                disabled={!isCustom}
                onChange={event => onResolve(field, event.target.value)}
                className="h-8 flex-1"
              />
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
