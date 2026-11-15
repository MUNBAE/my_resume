import { AlertTriangleIcon, FileTextIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SourceRef } from '@/types/resume'

interface SourceBadgesProps {
  sources: SourceRef[]
  className?: string
}

// 출처 문서 제목을 배지로 보여준다. 출처가 없으면 경고로 표시한다 (PRD §3.3, §10)
export function SourceBadges({ sources, className }: SourceBadgesProps) {
  if (sources.length === 0) {
    return (
      <Badge variant="destructive" className={className}>
        <AlertTriangleIcon aria-hidden />
        출처 없음
      </Badge>
    )
  }

  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-1', className)}
      aria-label="출처 문서"
    >
      {sources.map(source => (
        <Badge
          key={source.documentId}
          variant="outline"
          className="max-w-full font-normal"
          title={source.title ?? source.documentId}
        >
          <FileTextIcon aria-hidden />
          <span className="truncate">{source.title ?? '제목 없음'}</span>
        </Badge>
      ))}
    </span>
  )
}

// 배지를 놓을 수 없는 곳(기술 태그 등)에 쓰는 툴팁용 문자열
export function sourceTitles(sources: SourceRef[]): string {
  return sources.length === 0
    ? '출처 없음'
    : `출처: ${sources.map(s => s.title ?? s.documentId).join(', ')}`
}
