import type { Metadata } from 'next'

import { Container } from '@/components/layout/container'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export const metadata: Metadata = {
  title: '문서 선택',
  description: '병합할 포트폴리오 하위 문서를 선택합니다',
}

export default function ResumePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-10">
        <Container size="md">
          <h1 className="text-2xl font-bold">문서 선택</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            병합할 포트폴리오 하위 문서를 선택합니다.
          </p>
        </Container>
      </main>
      <Footer />
    </div>
  )
}
