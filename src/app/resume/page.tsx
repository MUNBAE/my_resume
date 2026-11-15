import type { Metadata } from 'next'

import { Container } from '@/components/layout/container'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { ResumeSelector } from '@/components/resume/resume-selector'
import { toNotionServiceError, type NotionDocument } from '@/lib/notion'
import { getCachedDocumentList } from '@/lib/notion-cache'

export const metadata: Metadata = {
  title: '문서 선택',
  description: '병합할 포트폴리오 하위 문서를 선택합니다',
}

// 서버에서 문서 목록을 읽는다. 실패하면 화면에 한글 오류를 보여준다.
async function loadDocuments(): Promise<{
  documents: NotionDocument[]
  error?: string
}> {
  try {
    return { documents: await getCachedDocumentList() }
  } catch (error) {
    console.error('[resume] 문서 목록 조회 실패', error)
    return { documents: [], error: toNotionServiceError(error).message }
  }
}

export default async function ResumePage() {
  const { documents, error } = await loadDocuments()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-10">
        <Container size="md">
          <h1 className="text-2xl font-bold">문서 선택</h1>
          <p className="text-muted-foreground mt-2 mb-6 text-sm">
            병합할 포트폴리오 하위 문서를 선택합니다.
          </p>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : (
            <ResumeSelector documents={documents} />
          )}
        </Container>
      </main>
      <Footer />
    </div>
  )
}
