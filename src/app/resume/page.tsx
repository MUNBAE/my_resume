import type { Metadata } from 'next'

import { Container } from '@/components/layout/container'
import { ResumeSelector } from '@/components/resume/resume-selector'
import { toNotionServiceError, type NotionDocument } from '@/lib/notion'
import { getCachedDocumentList } from '@/lib/notion-cache'

// 개인 문서 목록이므로 빌드 시점에 정적으로 만들지 않고 요청마다 서버에서 렌더링한다
export const dynamic = 'force-dynamic'

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
    <main className="flex-1 py-10">
      <Container size="md">
        <h1 className="text-2xl font-bold">문서 선택</h1>
        <p className="text-muted-foreground mt-2 mb-6 text-sm">
          병합할 포트폴리오 하위 문서를 선택합니다.
        </p>
        {error ? (
          // 네트워크·권한 오류: 원인 메시지와 함께 새로고침을 안내한다
          <div role="alert" className="space-y-2">
            <p className="text-destructive text-sm">{error}</p>
            <p className="text-muted-foreground text-sm">
              문제가 계속되면 페이지를 새로고침하거나 Notion 연결 설정을 확인해
              주세요.
            </p>
          </div>
        ) : documents.length === 0 ? (
          // 포트폴리오 페이지 아래 문서가 하나도 없는 경우
          <div role="status" className="space-y-2">
            <p className="text-sm font-medium">불러올 문서가 없습니다.</p>
            <p className="text-muted-foreground text-sm">
              포트폴리오 페이지 아래에 이력서·지원서 문서를 만들고, Notion
              Integration에 페이지를 연결했는지 확인해 주세요.
            </p>
          </div>
        ) : (
          <ResumeSelector documents={documents} />
        )}
      </Container>
    </main>
  )
}
