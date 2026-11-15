// 서버 전용 — Notion 조회 결과 캐시 (병합 결과는 캐시하지 않는다, PRD §7)
import { revalidateTag, unstable_cache } from 'next/cache'

import { getDocumentList, getPageContent } from '@/lib/notion'

const TTL_SECONDS = 60
export const DOCUMENT_LIST_TAG = 'notion-documents'
const pageTag = (pageId: string) => `notion-page-${pageId}`

// 캐시 미스일 때만 실행되므로 로그로 Notion 호출 횟수를 확인할 수 있다
export const getCachedDocumentList = unstable_cache(
  async () => {
    console.info('[notion-cache] MISS 문서 목록 — Notion 호출')
    return getDocumentList()
  },
  ['notion-document-list'],
  { revalidate: TTL_SECONDS, tags: [DOCUMENT_LIST_TAG] }
)

export function getCachedPageContent(pageId: string) {
  return unstable_cache(
    async () => {
      console.info(`[notion-cache] MISS 페이지 본문 ${pageId} — Notion 호출`)
      return getPageContent(pageId)
    },
    ['notion-page-content', pageId],
    { revalidate: TTL_SECONDS, tags: [pageTag(pageId)] }
  )()
}

// 수동 새로고침: 목록과 (지정 시) 개별 페이지 본문 캐시를 무효화한다
export function invalidateNotionCache(pageIds: string[] = []) {
  revalidateTag(DOCUMENT_LIST_TAG)
  for (const id of pageIds) revalidateTag(pageTag(id))
}
