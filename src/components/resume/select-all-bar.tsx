'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface SelectAllBarProps {
  total: number
  selectedCount: number
  onToggleAll: (selectAll: boolean) => void
  className?: string
}

// 전체 선택/해제 토글. 일부만 선택되면 중간(indeterminate) 상태로 표시한다 (PRD §2-2)
export function SelectAllBar({
  total,
  selectedCount,
  onToggleAll,
  className,
}: SelectAllBarProps) {
  const checked =
    selectedCount === 0
      ? false
      : selectedCount === total
        ? true
        : ('indeterminate' as const)

  return (
    <div
      className={cn(
        'bg-muted/40 flex items-center gap-3 rounded-lg border px-4 py-3',
        className
      )}
    >
      <Checkbox
        id="select-all-documents"
        checked={checked}
        disabled={total === 0}
        onCheckedChange={value => onToggleAll(value === true)}
      />
      <label
        htmlFor="select-all-documents"
        className="cursor-pointer text-sm font-medium select-none"
      >
        {selectedCount === total && total > 0 ? '전체 해제' : '전체 선택'}
      </label>
    </div>
  )
}
