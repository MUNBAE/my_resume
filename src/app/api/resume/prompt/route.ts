import { NextResponse, type NextRequest } from 'next/server'

import { toNotionServiceError } from '@/lib/notion'
import {
  buildPromptResponse,
  parseBody,
  promptRequestSchema,
} from '@/lib/resume-api'
import { getCachedDocumentList, getCachedPageContent } from '@/lib/notion-cache'

// 선택한 문서로 AI(ChatGPT 등)에 붙여 넣을 프롬프트를 만든다 (PRD §6.2)
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

  const parsed = parseBody(promptRequestSchema, body)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.message },
      { status: parsed.status }
    )
  }

  try {
    // 목록에 있는 문서만 허용한다 (임의의 페이지 ID로 다른 페이지를 읽지 못하게 한다)
    const allowed = new Map(
      (await getCachedDocumentList()).map(d => [d.id, d.title])
    )
    const unknown = parsed.data.documentIds.filter(id => !allowed.has(id))
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: '포트폴리오 하위 문서가 아닌 ID가 포함되어 있습니다.' },
        { status: 400 }
      )
    }

    const documents = []
    for (const id of parsed.data.documentIds) {
      documents.push({
        id,
        title: allowed.get(id) ?? '',
        text: (await getCachedPageContent(id)).text,
      })
    }
    return NextResponse.json(buildPromptResponse(documents))
  } catch (error) {
    const { message, status } = toNotionServiceError(error)
    console.error('[api/resume/prompt]', error)
    return NextResponse.json({ error: message }, { status })
  }
}
