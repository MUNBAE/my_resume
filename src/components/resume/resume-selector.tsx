'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ResumeSelectList } from '@/components/resume/resume-select-list'
import { SelectAllBar } from '@/components/resume/select-all-bar'
import type { NotionDocument } from '@/lib/notion'

interface ResumeSelectorProps {
  documents: NotionDocument[]
}

// 문서 선택 영역: 기본값은 전체 선택 (PRD §2-2). 생성 동작은 4.3에서 연결한다.
export function ResumeSelector({ documents }: ResumeSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    documents.map(d => d.id)
  )

  return (
    <div className="space-y-4">
      <SelectAllBar
        total={documents.length}
        selectedCount={selectedIds.length}
        onToggleAll={selectAll =>
          setSelectedIds(selectAll ? documents.map(d => d.id) : [])
        }
      />
      <ResumeSelectList
        documents={documents}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
      <Button disabled={selectedIds.length === 0} className="w-full sm:w-auto">
        프롬프트 생성
      </Button>
    </div>
  )
}
