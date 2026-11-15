'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { DiffView } from '@/components/resume/diff-view'
import { ResumeEditor } from '@/components/resume/resume-editor'
import { ResumePreview } from '@/components/resume/resume-preview'
import { SaveDialog } from '@/components/resume/save-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { pickBaselineDocument } from '@/lib/resume-diff'
import { loadMergeDraft, type MergeDraft } from '@/lib/merge-session'
import type { Resume } from '@/types/resume'

type DraftState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; draft: MergeDraft }

// 병합 초안 검토 → 확정 → Notion 저장 (PRD §2-6~8)
export function MergeView() {
  const [state, setState] = useState<DraftState>({ status: 'loading' })
  const [finalResume, setFinalResume] = useState<Resume | null>(null)

  // sessionStorage는 브라우저에서만 읽을 수 있어 마운트 후에 불러온다
  useEffect(() => {
    const draft = loadMergeDraft()
    setState(draft ? { status: 'ready', draft } : { status: 'empty' })
  }, [])

  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label="불러오는 중" className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (state.status === 'empty') {
    // 초안 없이 직접 접근했거나 탭을 닫았다가 다시 연 경우
    return (
      <div role="status" className="space-y-3">
        <p className="text-sm font-medium">검토할 병합 결과가 없습니다.</p>
        <p className="text-muted-foreground text-sm">
          문서를 선택해 프롬프트를 만들고 AI 결과를 붙여 넣으면 이곳에서 검토할
          수 있습니다. 브라우저 탭을 닫으면 결과가 사라집니다.
        </p>
        <Link href="/resume" className={buttonVariants()}>
          문서 선택으로 이동
        </Link>
      </div>
    )
  }

  const { draft } = state
  const baseline = pickBaselineDocument(draft.documents)

  if (finalResume) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <p className="text-sm" role="status">
            확정된 이력서입니다. 저장하면 Notion에 새 페이지로 만들어집니다.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFinalResume(null)}>
              다시 수정
            </Button>
            <SaveDialog resume={finalResume} />
          </div>
        </div>
        <ResumePreview resume={finalResume} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {draft.warnings.length > 0 && (
        <section
          role="note"
          aria-label="검증 경고"
          className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
        >
          <p className="font-medium">AI 결과에서 정리한 내용</p>
          <ul className="list-disc pl-5">
            {draft.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      {baseline && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">기준본 대비 변경점</h2>
          <DiffView
            resume={draft.resume}
            baselineDocumentId={baseline.id}
            baselineTitle={baseline.title}
          />
        </section>
      )}

      <ResumeEditor resume={draft.resume} onFinalize={setFinalResume} />
    </div>
  )
}
