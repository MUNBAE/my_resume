import { describe, expect, it } from 'vitest'

import { classifyStatus, postJson } from '@/lib/api-client'

const respond = (status: number, body: unknown, raw = false) =>
  (async () =>
    new Response(raw ? (body as string) : JSON.stringify(body), {
      status,
      headers: { 'content-type': raw ? 'text/html' : 'application/json' },
    })) as unknown as typeof fetch

describe('classifyStatus', () => {
  it.each([
    [401, 'unauthorized', false],
    [429, 'rate_limit', true],
    [408, 'timeout', true],
    [504, 'timeout', true],
    [500, 'server', true],
    [502, 'server', true],
    [503, 'server', true],
    [400, 'request', false],
    [404, 'request', false],
    [422, 'request', false],
  ])('HTTP %i → %s (재시도 %s)', (status, kind, retryable) => {
    expect(classifyStatus(status)).toEqual({ kind, retryable })
  })
})

describe('postJson', () => {
  it('성공하면 데이터를 돌려준다', async () => {
    const r = await postJson<{ a: number }>('/x', {}, respond(200, { a: 1 }))
    expect(r).toEqual({ ok: true, data: { a: 1 } })
  })

  it('요청 본문을 JSON으로 보낸다', async () => {
    let seen: RequestInit | undefined
    await postJson('/x', { hello: '안녕' }, (async (
      _url: string,
      init?: RequestInit
    ) => {
      seen = init
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch)
    expect(seen?.method).toBe('POST')
    expect(JSON.parse(seen?.body as string)).toEqual({ hello: '안녕' })
  })

  it('네트워크 오류는 예외 없이 한글 메시지와 재시도 가능으로 돌려준다', async () => {
    const r = await postJson('/x', {}, (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.kind).toBe('network')
      expect(r.retryable).toBe(true)
      expect(r.message).toContain('네트워크')
      expect(r.message).not.toContain('Failed to fetch')
    }
  })

  it('서버가 준 한글 오류 메시지를 그대로 쓴다', async () => {
    const r = await postJson(
      '/x',
      {},
      respond(401, { error: 'Notion API 키가 올바르지 않습니다.' })
    )
    expect(
      !r.ok &&
        r.kind === 'unauthorized' &&
        r.message === 'Notion API 키가 올바르지 않습니다.'
    ).toBe(true)
  })

  it('429는 재시도 가능, 502·504는 유형이 구분된다', async () => {
    const rate = await postJson(
      '/x',
      {},
      respond(429, { error: '너무 많습니다' })
    )
    const bad = await postJson(
      '/x',
      {},
      respond(502, { error: 'Notion 일시 오류' })
    )
    const slow = await postJson('/x', {}, respond(504, { error: '시간 초과' }))
    expect(!rate.ok && rate.kind === 'rate_limit' && rate.retryable).toBe(true)
    expect(!bad.ok && bad.kind === 'server' && bad.retryable).toBe(true)
    expect(!slow.ok && slow.kind === 'timeout' && slow.retryable).toBe(true)
  })

  it('JSON이 아닌 오류 응답(HTML 등)은 상태별 기본 한글 메시지로 바꾼다', async () => {
    const r = await postJson(
      '/x',
      {},
      respond(502, '<html>Bad Gateway</html>', true)
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.body).toBeNull()
      expect(r.message).toContain('서버')
      expect(r.message).not.toContain('<html>')
    }
  })

  it('인증 만료(401, 본문 없음)는 새로고침 안내 메시지를 준다', async () => {
    const r = await postJson('/x', {}, respond(401, '', true))
    expect(
      !r.ok &&
        r.kind === 'unauthorized' &&
        r.message.includes('새로고침') &&
        !r.retryable
    ).toBe(true)
  })

  it('422(AI 결과 오류)는 재시도 불가이고 서버 본문을 함께 돌려준다', async () => {
    const r = await postJson(
      '/x',
      {},
      respond(422, {
        error: '형식 오류 2개',
        issues: [{ location: 'a', message: 'b' }],
        fixPrompt: 'fix',
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.retryable).toBe(false)
      expect(r.kind).toBe('request')
      expect(r.body?.fixPrompt).toBe('fix')
      expect((r.body?.issues as unknown[]).length).toBe(1)
    }
  })

  it('성공 응답인데 본문이 JSON이 아니면 서버 오류로 처리한다', async () => {
    const r = await postJson('/x', {}, respond(200, 'ok', true))
    expect(!r.ok && r.kind === 'server').toBe(true)
  })

  it('빈 오류 메시지는 기본 메시지로 대체한다', async () => {
    const r = await postJson('/x', {}, respond(500, { error: '  ' }))
    expect(!r.ok && r.message.includes('서버')).toBe(true)
  })
})
