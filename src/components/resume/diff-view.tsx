import { Badge } from '@/components/ui/badge'
import { fieldLabel } from '@/components/resume/conflict-resolver'
import {
  SECTION_LABELS,
  diffResume,
  summarizeDiff,
  type DiffEntry,
  type DiffSection,
} from '@/lib/resume-diff'
import { cn } from '@/lib/utils'
import type { Resume } from '@/types/resume'

interface DiffViewProps {
  resume: Resume
  baselineDocumentId: string
  baselineTitle: string
  className?: string
}

const STATUS_LABEL = { added: '추가', changed: '변경' } as const

function EntryRow({ entry }: { entry: DiffEntry }) {
  if (entry.status === 'unchanged') return null
  return (
    <li
      className={cn(
        'rounded-md border-l-4 py-2 pr-2 pl-3 text-sm',
        entry.status === 'added'
          ? 'border-l-emerald-500 bg-emerald-500/5'
          : 'border-l-amber-500 bg-amber-500/5'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={entry.status === 'added' ? 'default' : 'secondary'}>
          {STATUS_LABEL[entry.status]}
        </Badge>
        <span className="font-medium break-words">{entry.label}</span>
      </div>
      {entry.conflictFields.length > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">
          값이 다른 항목: {entry.conflictFields.map(fieldLabel).join(', ')}
        </p>
      )}
      {entry.status === 'changed' && entry.addedAchievements.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          {entry.addedAchievements.map((a, i) => (
            <li key={i} className="break-words">
              {a.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// 기준본 문서 대비 추가·변경된 항목만 보여준다 (PRD §3.4)
export function DiffView({
  resume,
  baselineDocumentId,
  baselineTitle,
  className,
}: DiffViewProps) {
  const entries = diffResume(resume, baselineDocumentId)
  const summary = summarizeDiff(entries)
  const sections = Object.keys(SECTION_LABELS) as DiffSection[]

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-muted-foreground text-sm">
        기준본 <span className="text-foreground">{baselineTitle}</span> 대비
        추가 {summary.added}건 · 변경 {summary.changed}건 · 동일{' '}
        {summary.unchanged}건
      </p>
      {summary.added + summary.changed === 0 && (
        <p className="text-sm">기준본과 달라진 항목이 없습니다.</p>
      )}
      {sections.map(section => {
        const changed = entries.filter(
          e => e.section === section && e.status !== 'unchanged'
        )
        if (changed.length === 0) return null
        return (
          <section key={section} className="space-y-2">
            <h3 className="text-sm font-semibold">{SECTION_LABELS[section]}</h3>
            <ul className="space-y-2">
              {changed.map(entry => (
                <EntryRow key={`${section}-${entry.id}`} entry={entry} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
