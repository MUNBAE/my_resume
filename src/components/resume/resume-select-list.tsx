'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { NotionDocument } from '@/lib/notion'

// 서버/클라이언트 간 날짜 표기 차이를 막기 위해 시간대를 고정한다
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Seoul',
})

const formatDate = (iso: string) => dateFormatter.format(new Date(iso))

interface ResumeSelectListProps {
  documents: NotionDocument[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  className?: string
}

// 병합할 문서를 다중 선택하는 목록 (PRD §3.1)
export function ResumeSelectList({
  documents,
  selectedIds,
  onSelectionChange,
  className,
}: ResumeSelectListProps) {
  const selected = new Set(selectedIds)

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    // 목록 순서를 유지한 채 선택 ID를 전달한다
    onSelectionChange(documents.filter(d => next.has(d.id)).map(d => d.id))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {documents.length}개 중{' '}
        <span className="text-foreground font-medium">
          {selectedIds.length}개
        </span>{' '}
        선택됨
      </p>
      <ul className="space-y-2">
        {documents.map(doc => {
          const inputId = `document-${doc.id}`
          return (
            <li key={doc.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  'hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                  selected.has(doc.id) && 'border-primary/60 bg-accent/30'
                )}
              >
                <Checkbox
                  id={inputId}
                  checked={selected.has(doc.id)}
                  onCheckedChange={checked => toggle(doc.id, checked === true)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {doc.title || '(제목 없음)'}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    작성 {formatDate(doc.createdTime)} · 수정{' '}
                    {formatDate(doc.lastEditedTime)}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
