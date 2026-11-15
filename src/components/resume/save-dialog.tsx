'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'

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

  async function save() {
    if (inFlight.current || status === 'saved') return
    if (title.trim() === '') {
      toast.error('제목을 입력해 주세요.')
      return
    }
    inFlight.current = true
    setStatus('saving')
    try {
      const response = await fetch('/api/resume/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, resume }),
      })
      const data = (await response.json()) as {
        url?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(data.error ?? '저장하지 못했습니다.')
      }
      setUrl(data.url ?? '')
      setStatus('saved')
      toast.success('Notion에 저장했습니다.')
    } catch (error) {
      setStatus('idle')
      toast.error(
        error instanceof Error ? error.message : '저장하지 못했습니다.'
      )
    } finally {
      inFlight.current = false
    }
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
