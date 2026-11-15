import { NextResponse, type NextRequest } from 'next/server'

import { toNotionServiceError } from '@/lib/notion'
import { getCachedDocumentList } from '@/lib/notion-cache'
import {
  mergeRequestSchema,
  parseBody,
  processMergeResult,
} from '@/lib/resume-api'

// 사용자가 붙여 넣은 AI 결과를 검증·정리해 병합 초안을 돌려준다 (PRD §6.2)
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

  const parsed = parseBody(mergeRequestSchema, body)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.message },
      { status: parsed.status }
    )
  }

  try {
    // 출처 검증에 쓸 입력 문서 (제목은 실제 Notion 제목)
    const titles = new Map(
      (await getCachedDocumentList()).map(d => [d.id, d.title])
    )
    const inputs = parsed.data.documentIds
      .filter(id => titles.has(id))
      .map(id => ({ id, title: titles.get(id) ?? '' }))

    const outcome = processMergeResult(parsed.data.result, inputs)
    if (!outcome.ok) {
      // 사용자가 결과를 고쳐 다시 붙여 넣을 수 있도록 상세를 함께 돌려준다
      return NextResponse.json(
        {
          error: outcome.message,
          issues: outcome.issues,
          fixPrompt: outcome.fixPrompt,
        },
        { status: 422 }
      )
    }
    return NextResponse.json({
      resume: outcome.resume,
      warnings: outcome.warnings,
    })
  } catch (error) {
    const { message, status } = toNotionServiceError(error)
    console.error('[api/resume/merge]', error)
    return NextResponse.json({ error: message }, { status })
  }
}
