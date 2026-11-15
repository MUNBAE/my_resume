import type { Metadata } from 'next'

import { Container } from '@/components/layout/container'
import { MergeView } from '@/components/resume/merge-view'

export const metadata: Metadata = {
  title: '병합 미리보기',
  description: '병합 결과를 검토하고 수정한 뒤 저장합니다',
}

export default function ResumeMergePage() {
  return (
    <main className="flex-1 py-10">
      <Container size="md">
        <h1 className="text-2xl font-bold">병합 미리보기</h1>
        <p className="text-muted-foreground mt-2 mb-6 text-sm">
          병합 결과를 검토하고 수정한 뒤 저장합니다.
        </p>
        <MergeView />
      </Container>
    </main>
  )
}
