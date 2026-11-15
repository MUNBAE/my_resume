'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { CopyButton } from '@/components/resume/copy-button'
import { ErrorNotice } from '@/components/resume/error-notice'
import { ResumeSelectList } from '@/components/resume/resume-select-list'
import { SelectAllBar } from '@/components/resume/select-all-bar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { postJson, type FailureKind } from '@/lib/api-client'
import type { PromptLengthReport } from '@/lib/merge-prompt'
import { saveMergeDraft } from '@/lib/merge-session'
import type { NotionDocument } from '@/lib/notion'
import type { Resume } from '@/types/resume'

interface PromptData {
  prompt: string
  length: PromptLengthReport
  skippedEmpty: string[]
  documentIds: string[]
}

interface PromptError {
  message: string
  kind: FailureKind
  retryable: boolean
}

interface MergeFailure extends PromptError {
  issues: { location: string; message: string }[]
  fixPrompt?: string
}

interface ResumeSelectorProps {
  documents: NotionDocument[]
}

// 문서 선택 → 프롬프트 생성·복사 → AI 결과 붙여넣기 → 검증 후 미리보기로 이동 (PRD §2)
export function ResumeSelector({ documents }: ResumeSelectorProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    documents.map(d => d.id)
  )
  const [promptData, setPromptData] = useState<PromptData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [promptError, setPromptError] = useState<PromptError | null>(null)
  const [failure, setFailure] = useState<MergeFailure | null>(null)

  async function generatePrompt() {
    if (generating) return
    setGenerating(true)
    setFailure(null)
    setPromptError(null)
    const response = await postJson<PromptData>('/api/resume/prompt', {
      documentIds: selectedIds,
    })
    setGenerating(false)

    if (!response.ok) {
      setPromptError({
        message: response.message,
        kind: response.kind,
        retryable: response.retryable,
      })
      return
    }
    if (response.data.documentIds.length === 0) {
      setPromptError({
        message: '선택한 문서에 본문이 없어 프롬프트를 만들 수 없습니다.',
        kind: 'request',
        retryable: false,
      })
      return
    }
    setPromptData(response.data)
  }

  async function verifyResult() {
    if (verifying || !promptData) return
    setVerifying(true)
    setFailure(null)
    const response = await postJson<{ resume: Resume; warnings?: string[] }>(
      '/api/resume/merge',
      { documentIds: promptData.documentIds, result }
    )
    setVerifying(false)

    if (!response.ok) {
      setFailure({
        message: response.message,
        kind: response.kind,
        retryable: response.retryable,
        issues: (response.body?.issues as MergeFailure['issues']) ?? [],
        fixPrompt: response.body?.fixPrompt as string | undefined,
      })
      return
    }

    const used = documents.filter(d => promptData.documentIds.includes(d.id))
    const saved = saveMergeDraft({
      resume: response.data.resume,
      warnings: response.data.warnings ?? [],
      documents: used.map(d => ({
        id: d.id,
        title: d.title,
        lastEditedTime: d.lastEditedTime,
      })),
    })
    if (!saved) {
      toast.error(
        '브라우저 저장소를 사용할 수 없어 미리보기로 넘기지 못했습니다.'
      )
      return
    }
    router.push('/resume/merge')
  }

  const resetPrompt = () => {
    setPromptData(null)
    setPromptError(null)
    setResult('')
    setFailure(null)
  }

  return (
    <div className="space-y-6">
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
          onSelectionChange={ids => {
            setSelectedIds(ids)
            // 선택이 바뀌면 이전에 만든 프롬프트는 더 이상 맞지 않는다
            if (promptData) resetPrompt()
          }}
        />
        <Button
          onClick={generatePrompt}
          disabled={selectedIds.length === 0 || generating}
          className="w-full sm:w-auto"
        >
          {generating ? '프롬프트 만드는 중…' : '프롬프트 생성'}
        </Button>
        {promptError && (
          <ErrorNotice
            message={promptError.message}
            kind={promptError.kind}
            onRetry={promptError.retryable ? generatePrompt : undefined}
            retrying={generating}
          />
        )}
      </div>

      {promptData && (
        <section
          className="space-y-4 rounded-lg border p-4"
          aria-label="프롬프트와 결과"
        >
          <div>
            <h2 className="text-lg font-semibold">
              1. 프롬프트를 AI에 붙여 넣기
            </h2>
            <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>아래 프롬프트를 복사합니다.</li>
              <li>ChatGPT 등 원하는 AI에 붙여 넣고 실행합니다.</li>
              <li>AI가 출력한 JSON을 복사해 아래 2단계에 붙여 넣습니다.</li>
            </ol>
          </div>

          <p
            role="note"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          >
            프롬프트에는 선택한 문서의 본문(개인정보 포함)이 그대로 들어
            있습니다. 외부 AI 서비스에 붙여 넣기 전에 내용을 확인해 주세요.
          </p>

          {promptData.length.message && (
            <p
              role="alert"
              className="text-sm text-amber-700 dark:text-amber-400"
            >
              {promptData.length.message}
            </p>
          )}
          {promptData.skippedEmpty.length > 0 && (
            <p className="text-muted-foreground text-sm">
              본문이 비어 있어 제외한 문서: {promptData.skippedEmpty.join(', ')}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                {promptData.prompt.length.toLocaleString('ko-KR')}자 · 문서{' '}
                {promptData.documentIds.length}개
              </span>
              <CopyButton text={promptData.prompt} label="프롬프트 복사" />
            </div>
            <Textarea
              readOnly
              aria-label="생성된 프롬프트"
              value={promptData.prompt}
              className="max-h-56 font-mono text-xs"
              onFocus={event => event.currentTarget.select()}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">2. AI 결과 붙여 넣기</h2>
            <Textarea
              aria-label="AI 결과"
              placeholder="AI가 출력한 JSON을 여기에 붙여 넣으세요. 설명 문장이나 코드 블록(```json)이 섞여 있어도 괜찮습니다."
              value={result}
              onChange={event => setResult(event.target.value)}
              className="min-h-40 font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={verifyResult}
                disabled={result.trim() === '' || verifying}
              >
                {verifying ? '검증 중…' : '결과 검증하고 미리보기'}
              </Button>
              <Button
                variant="outline"
                onClick={resetPrompt}
                disabled={verifying}
              >
                처음부터
              </Button>
            </div>
          </div>

          {failure && failure.issues.length === 0 && !failure.fixPrompt && (
            // 결과 내용 문제가 아닌 실패(네트워크·인증·서버 등, 또는 JSON 없음): 유형별 안내와 재시도
            <ErrorNotice
              message={failure.message}
              kind={failure.kind}
              onRetry={failure.retryable ? verifyResult : undefined}
              retrying={verifying}
            />
          )}
          {failure && (failure.issues.length > 0 || failure.fixPrompt) && (
            <div
              role="alert"
              className="border-destructive/50 space-y-3 rounded-md border p-3"
            >
              <p className="text-destructive text-sm font-medium">
                {failure.message}
              </p>
              {failure.issues.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {failure.issues.slice(0, 10).map((issue, index) => (
                    <li key={index}>
                      <span className="font-medium">{issue.location}</span>:{' '}
                      {issue.message}
                    </li>
                  ))}
                  {failure.issues.length > 10 && (
                    <li>…외 {failure.issues.length - 10}개</li>
                  )}
                </ul>
              )}
              {failure.fixPrompt && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    아래 수정 요청 프롬프트를 같은 AI 대화에 붙여 넣으면 오류만
                    고친 JSON을 다시 받을 수 있습니다.
                  </p>
                  <CopyButton
                    text={failure.fixPrompt}
                    label="수정 요청 프롬프트 복사"
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
