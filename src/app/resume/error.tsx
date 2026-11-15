'use client'

import { useEffect } from 'react'

import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'

// 예상하지 못한 오류가 났을 때 보여주고 다시 시도할 수 있게 한다
export default function ResumeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[resume] 화면 오류', error)
  }, [error])

  return (
    <main className="flex-1 py-10">
      <Container size="md">
        <div role="alert" className="space-y-3">
          <h1 className="text-xl font-bold">문제가 발생했습니다</h1>
          <p className="text-muted-foreground text-sm">
            화면을 불러오는 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.
            계속되면 Notion 연결 설정(키·페이지 연결)을 확인해 주세요.
          </p>
          <Button onClick={reset}>다시 시도</Button>
        </div>
      </Container>
    </main>
  )
}
