import { Client, LogLevel } from '@notionhq/client'
import { describe, expect, it } from 'vitest'

import {
  NotionServiceError,
  createNotionRunner,
  createResumePage,
  toNotionServiceError,
} from '@/lib/notion'
import { SRC_A, achievement, experience, makeResume } from '@/test/fixtures'

// 지정한 상태 코드로 응답하는 가짜 fetch 로 SDK 클라이언트를 만든다 (네트워크 호출 없음)
function clientReturning(
  status: number,
  code: string,
  counter: { calls: number }
) {
  return new Client({
    auth: 'test',
    retry: false,
    logLevel: LogLevel.ERROR, // 재시도 경고 로그로 테스트 출력이 지저분해지지 않게 한다
    fetch: (async () => {
      counter.calls++
      return new Response(
        JSON.stringify({ object: 'error', status, code, message: 'test' }),
        { status, headers: { 'content-type': 'application/json' } }
      )
    }) as never,
  })
}

const fastRunner = () =>
  createNotionRunner({ intervalMs: 1, baseDelayMs: 5, maxRetries: 3 })

async function errorOf(promise: Promise<unknown>): Promise<NotionServiceError> {
  try {
    await promise
  } catch (error) {
    return error as NotionServiceError
  }
  throw new Error('오류가 발생해야 합니다')
}

describe('toNotionServiceError', () => {
  it.each([
    [401, 'unauthorized', 401, false, 'NOTION_API_KEY'],
    [404, 'object_not_found', 404, false, '접근 권한'],
    [403, 'restricted_resource', 403, false, '접근 권한'],
    [429, 'rate_limited', 429, true, '너무 많습니다'],
    [500, 'internal_server_error', 502, true, '일시적인 문제'],
    [400, 'validation_error', 400, false, '올바르지 않습니다'],
  ])(
    'HTTP %i (%s) → 상태 %i, 재시도 %s',
    async (status, code, expectedStatus, retryable, text) => {
      const counter = { calls: 0 }
      const client = clientReturning(status, code, counter)
      const error = toNotionServiceError(await errorOf(client.users.me({})))
      expect(error.status).toBe(expectedStatus)
      expect(error.retryable).toBe(retryable)
      expect(error.message).toContain(text)
    }
  )

  it('알 수 없는 오류는 500 한글 메시지로 바꾼다', () => {
    const error = toNotionServiceError(new Error('boom'))
    expect(error.status).toBe(500)
    expect(error.message).toContain('알 수 없는 오류')
  })

  it('이미 변환된 오류는 그대로 돌려준다', () => {
    const original = new NotionServiceError('x', 418, false)
    expect(toNotionServiceError(original)).toBe(original)
  })
})

describe('createNotionRunner', () => {
  it('5xx는 재시도한 뒤 한글 오류를 던진다 (최초 1회 + 재시도 3회)', async () => {
    const counter = { calls: 0 }
    const client = clientReturning(500, 'internal_server_error', counter)
    const error = await errorOf(fastRunner()(() => client.users.me({})))
    expect(counter.calls).toBe(4)
    expect(error.status).toBe(502)
    expect(error.message).toContain('일시적인 문제')
  })

  it('401은 재시도하지 않는다', async () => {
    const counter = { calls: 0 }
    const client = clientReturning(401, 'unauthorized', counter)
    const error = await errorOf(fastRunner()(() => client.users.me({})))
    expect(counter.calls).toBe(1)
    expect(error.status).toBe(401)
  })

  it('일시적 실패 후 성공하면 결과를 돌려준다', async () => {
    let calls = 0
    const result = await fastRunner()(async () => {
      calls++
      if (calls < 3) {
        throw await errorOf(
          clientReturning(503, 'service_unavailable', { calls: 0 }).users.me({})
        )
      }
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('요청을 한 번에 하나씩, 최소 간격을 두고 보낸다', async () => {
    const runner = createNotionRunner({ intervalMs: 30, maxRetries: 0 })
    const starts: number[] = []
    let running = 0
    let maxRunning = 0
    await Promise.all(
      Array.from({ length: 4 }, () =>
        runner(async () => {
          starts.push(Date.now())
          running++
          maxRunning = Math.max(maxRunning, running)
          await new Promise(r => setTimeout(r, 5))
          running--
        })
      )
    )
    expect(maxRunning).toBe(1)
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(25)
    }
  })

  it('앞선 요청이 실패해도 다음 요청은 계속 처리한다', async () => {
    const runner = createNotionRunner({ intervalMs: 1, maxRetries: 0 })
    const first = runner(async () => {
      throw new Error('실패')
    })
    const second = runner(async () => 'ok')
    await expect(first).rejects.toBeInstanceOf(NotionServiceError)
    await expect(second).resolves.toBe('ok')
  })
})

describe('createResumePage (가짜 클라이언트)', () => {
  const forbidden = (name: string) => () => {
    throw new Error(`금지된 호출: ${name}`)
  }

  // 가짜 클라이언트가 받은 요청 인자 (테스트에서 확인할 필드만 정의)
  type CallArgs = {
    parent: { page_id: string }
    properties: { title: { title: { text: { content: string } }[] } }
    children: unknown[]
    block_id: string
  }

  function fakeClient() {
    const calls: { method: string; args: CallArgs }[] = []
    const client = {
      pages: {
        create: async (args: CallArgs) => (
          calls.push({ method: 'pages.create', args }),
          { id: 'new-page', url: 'https://notion.so/new-page' }
        ),
        update: forbidden('pages.update'),
      },
      blocks: {
        children: {
          append: async (args: CallArgs) => (
            calls.push({ method: 'append', args }),
            {}
          ),
        },
        delete: forbidden('blocks.delete'),
        update: forbidden('blocks.update'),
      },
    } as unknown as Client
    return { client, calls }
  }

  const bigResume = makeResume({
    experiences: [
      experience({
        id: 'e1',
        company: 'A',
        startDate: '2020-01',
        endDate: null,
        achievements: Array.from({ length: 250 }, (_, i) =>
          achievement(`성과 ${i}`)
        ),
      }),
    ],
  })

  it('첫 100블록은 pages.create, 나머지는 새 페이지에 append 한다', async () => {
    const { client, calls } = fakeClient()
    const result = await createResumePage('  새 이력서  ', bigResume, {
      client,
      parentId: 'parent-1',
    })

    const create = calls.filter(c => c.method === 'pages.create')
    const append = calls.filter(c => c.method === 'append')
    expect(create).toHaveLength(1)
    expect(create[0].args.parent.page_id).toBe('parent-1')
    expect(create[0].args.properties.title.title[0].text.content).toBe(
      '새 이력서'
    )
    expect(create[0].args.children).toHaveLength(100)
    expect(append.every(c => c.args.block_id === 'new-page')).toBe(true)
    expect(append.every(c => c.args.children.length <= 100)).toBe(true)

    const total =
      create[0].args.children.length +
      append.reduce((n, c) => n + c.args.children.length, 0)
    expect(total).toBe(result.blockCount)
    expect(result.blockCount).toBe(252) // 경력 제목 2 + 성과 250
    expect(result).toMatchObject({
      id: 'new-page',
      url: 'https://notion.so/new-page',
    })
  })

  it('create·append 외의 호출(수정·삭제)은 하지 않는다', async () => {
    const { client, calls } = fakeClient()
    await createResumePage('x', bigResume, { client, parentId: 'p' })
    expect(
      calls.every(c => c.method === 'pages.create' || c.method === 'append')
    ).toBe(true)
  })

  it('빈 이력서는 블록 없는 페이지 1개만 만든다', async () => {
    const { client, calls } = fakeClient()
    const result = await createResumePage('빈 이력서', makeResume(), {
      client,
      parentId: 'p',
    })
    expect(calls).toHaveLength(1)
    expect(result.blockCount).toBe(0)
    expect(calls[0].args.children).toEqual([])
  })

  it('제목은 200자로 자른다', async () => {
    const { client, calls } = fakeClient()
    await createResumePage(
      '가'.repeat(500),
      makeResume({ skills: [{ id: 's', name: 'Go', sources: [SRC_A] }] }),
      {
        client,
        parentId: 'p',
      }
    )
    expect(calls[0].args.properties.title.title[0].text.content).toHaveLength(
      200
    )
  })
})
