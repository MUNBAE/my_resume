'use client'

import { Button } from '@/components/ui/button'
import type { FailureKind } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// 실패 유형별 보조 안내 (메시지 아래에 한 줄로 보여준다)
const HINTS: Record<FailureKind, string> = {
  network: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
  unauthorized: '페이지를 새로고침하면 로그인 창이 다시 열립니다.',
  rate_limit: 'Notion 요청 제한에 걸렸습니다. 잠시 기다리면 해결됩니다.',
  timeout: '문서가 많거나 서버가 바쁠 때 생길 수 있습니다.',
  server: '계속되면 Notion 연결 설정(키·페이지 연결)을 확인해 주세요.',
  request: '',
}

interface ErrorNoticeProps {
  message: string
  kind?: FailureKind
  /** 같은 요청을 다시 보내는 동작. 재시도할 수 있는 오류일 때만 넘긴다 */
  onRetry?: () => void
  retrying?: boolean
  /** 유형별 기본 안내 외에 덧붙일 주의 문구 */
  note?: string
  className?: string
}

// 오류 메시지와 (가능하면) 다시 시도 버튼을 보여준다
export function ErrorNotice({
  message,
  kind,
  onRetry,
  retrying = false,
  note,
  className,
}: ErrorNoticeProps) {
  const hint = kind ? HINTS[kind] : ''
  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/50 space-y-2 rounded-md border p-3',
        className
      )}
    >
      <p className="text-destructive text-sm font-medium">{message}</p>
      {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
      {note && <p className="text-sm">{note}</p>}
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? '다시 시도 중…' : '다시 시도'}
        </Button>
      )}
    </div>
  )
}
