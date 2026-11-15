import { NextResponse, type NextRequest } from 'next/server'

import { createResumePage, toNotionServiceError } from '@/lib/notion'
import { validateSaveRequest } from '@/lib/save-request'

// 확정된 이력서를 Notion에 새 페이지로 저장한다 (PRD §6.2). 기존 문서는 수정하지 않는다.
// 서버리스 환경에서 함수가 너무 일찍 끊기지 않도록 실행 시간을 늘린다 (일반 요청은 2초 안팎)
export const maxDuration = 30

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: '요청 본문이 올바른 JSON이 아닙니다.' },
      { status: 400 }
    )
  }

  const validation = validateSaveRequest(body)
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.message },
      { status: validation.status }
    )
  }

  try {
    const { title, resume } = validation.data
    const page = await createResumePage(title, resume)
    return NextResponse.json({ id: page.id, url: page.url })
  } catch (error) {
    const { message, status } = toNotionServiceError(error)
    console.error('[api/resume/save]', error)
    return NextResponse.json({ error: message }, { status })
  }
}
