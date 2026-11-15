import { NextResponse, type NextRequest } from 'next/server'

import { toNotionServiceError } from '@/lib/notion'
import {
  getCachedDocumentList,
  invalidateNotionCache,
} from '@/lib/notion-cache'

// 포트폴리오 하위 문서 목록(본문 제외)을 반환한다 (PRD §6.2)
// ?refresh=1 이면 캐시를 무효화하고 Notion에서 다시 읽는다
export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('refresh') === '1') {
      invalidateNotionCache()
    }
    const documents = await getCachedDocumentList()
    return NextResponse.json({ documents })
  } catch (error) {
    const { message, status } = toNotionServiceError(error)
    console.error('[api/resume/sources]', error)
    return NextResponse.json({ error: message }, { status })
  }
}
