'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { ErrorNotice } from '@/components/resume/error-notice'
import { postJson, type FailureKind } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Resume } from '@/types/resume'

interface SaveDialogProps {
  /** 사용자가 확정한 최종본 */
  resume: Resume
  /** 미해결 충돌이 있으면 저장할 수 없다 */
  disabled?: boolean
  defaultTitle?: string
}

type Status = 'idle' | 'saving' | 'saved'

// 제목을 입력받아 Notion에 새 페이지로 저장하고 결과 링크를 보여준다 (PRD §3.5)
export function SaveDialog({
  resume,
  disabled = false,
  defaultTitle = '통합 이력서',
}: SaveDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(defaultTitle)
  const [status, setStatus] = useState<Status>('idle')
  const [url, setUrl] = useState('')
  // state 갱신 전에 연속 클릭이 들어와도 요청이 한 번만 나가도록 ref로 막는다
  const inFlight = useRef(false)
  const [saveError, setSaveError] = useState<{
    message: string
    kind: FailureKind
    retryable: boolean
  } | null>(null)

  async function save() {
    if (inFlight.current || status === 'saved') return
    if (title.trim() === '') {
      toast.error('제목을 입력해 주세요.')
      return
    }
    inFlight.current = true
    setStatus('saving')
    setSaveError(null)
    const response = await postJson<{ url?: string }>('/api/resume/save', {
      title,
      resume,
    })
    inFlight.current = false

    if (!response.ok) {
      setStatus('idle')
      setSaveError({
        message: response.message,
        kind: response.kind,
        retryable: response.retryable,
      })
      toast.error(response.message)
      return
    }
    setUrl(response.data.url ?? '')
    setStatus('saved')
    toast.success('Notion에 저장했습니다.')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>Notion에 저장</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notion에 저장</DialogTitle>
          <DialogDescription>
            포트폴리오 페이지 아래에 새 페이지로 저장합니다. 기존 문서는
            수정되지 않습니다.
          </DialogDescription>
        </DialogHeader>

        {status === 'saved' ? (
          <div className="space-y-2 text-sm" role="status">
            <p>저장을 완료했습니다.</p>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary break-all underline underline-offset-4"
              >
                Notion에서 열기
              </a>
            ) : (
              <p className="text-muted-foreground">
                페이지 링크를 받지 못했습니다. Notion에서 확인해 주세요.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="save-title" className="text-sm font-medium">
              페이지 제목
            </label>
            <Input
              id="save-title"
              value={title}
              maxLength={200}
              disabled={status === 'saving'}
              onChange={event => setTitle(event.target.value)}
            />
          </div>
        )}

        {saveError && (
          <ErrorNotice
            message={saveError.message}
            kind={saveError.kind}
            // 응답을 못 받은 실패(네트워크·시간 초과·서버)는 Notion에 이미 만들어졌을 수 있다
            note={
              ['network', 'timeout', 'server'].includes(saveError.kind)
                ? 'Notion에 페이지가 이미 만들어졌을 수 있습니다. 포트폴리오 페이지 아래를 확인한 뒤 다시 시도하면 중복 저장을 피할 수 있습니다.'
                : undefined
            }
            onRetry={saveError.retryable ? save : undefined}
            retrying={status === 'saving'}
          />
        )}

        <DialogFooter>
          {status === 'saved' ? (
            <Button onClick={() => setOpen(false)}>닫기</Button>
          ) : (
            <Button onClick={save} disabled={status === 'saving'}>
              {status === 'saving' ? '저장 중…' : '저장'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
