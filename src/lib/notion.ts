// 서버 전용 — 클라이언트 컴포넌트에서 import 금지
import {
  APIErrorCode,
  Client,
  ClientErrorCode,
  isHTTPResponseError,
  isNotionClientError,
  type BlockObjectResponse,
  type RichTextItemResponse,
} from '@notionhq/client'

import { env } from '@/lib/env'

// 사용자에게 보여줄 한글 메시지를 가진 Notion 오류 (PRD §10)
export class NotionServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'NotionServiceError'
  }
}

// Notion 오류를 한글 메시지·상태 코드로 변환한다
export function toNotionServiceError(error: unknown): NotionServiceError {
  if (error instanceof NotionServiceError) return error

  if (isNotionClientError(error)) {
    if (error.code === ClientErrorCode.RequestTimeout) {
      return new NotionServiceError(
        'Notion 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
        504,
        true,
        { cause: error }
      )
    }
    if (isHTTPResponseError(error)) {
      const status = error.status
      if (status === 401 || error.code === APIErrorCode.Unauthorized) {
        return new NotionServiceError(
          'Notion API 키가 올바르지 않습니다. NOTION_API_KEY를 확인해 주세요.',
          401,
          false,
          { cause: error }
        )
      }
      if (
        status === 403 ||
        status === 404 ||
        error.code === APIErrorCode.ObjectNotFound ||
        error.code === APIErrorCode.RestrictedResource
      ) {
        return new NotionServiceError(
          'Notion 페이지를 찾을 수 없거나 접근 권한이 없습니다. 페이지에 Integration을 연결했는지 확인해 주세요.',
          status === 403 ? 403 : 404,
          false,
          { cause: error }
        )
      }
      if (status === 429) {
        return new NotionServiceError(
          'Notion 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
          429,
          true,
          { cause: error }
        )
      }
      if (status >= 500) {
        return new NotionServiceError(
          'Notion 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.',
          502,
          true,
          { cause: error }
        )
      }
      return new NotionServiceError(
        'Notion 요청이 올바르지 않습니다.',
        400,
        false,
        { cause: error }
      )
    }
  }

  return new NotionServiceError(
    'Notion 호출 중 알 수 없는 오류가 발생했습니다.',
    500,
    false,
    { cause: error }
  )
}

export interface NotionRunnerOptions {
  /** 요청 시작 간격(ms). 평균 3 req/s 제한 대응 */
  intervalMs?: number
  /** 최대 재시도 횟수 */
  maxRetries?: number
  /** 지수 백오프 기준 지연(ms): 1s, 2s, 4s … */
  baseDelayMs?: number
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

// 429의 Retry-After 헤더(초)를 ms로 읽는다
function retryAfterMs(error: unknown): number | undefined {
  if (!isHTTPResponseError(error)) return undefined
  const headers = error.headers as
    | { get?: (name: string) => string | null }
    | undefined
  const value = headers?.get?.('retry-after')
  const seconds = value ? Number(value) : NaN
  return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

/**
 * 직렬화 큐 + 지수 백오프 재시도 실행기.
 * 모든 Notion 호출은 반드시 이 실행기를 거친다.
 */
export function createNotionRunner(options: NotionRunnerOptions = {}) {
  const { intervalMs = 350, maxRetries = 3, baseDelayMs = 1000 } = options
  let tail: Promise<unknown> = Promise.resolve()
  let lastStart = 0

  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: NotionServiceError | undefined
    for (let retry = 0; retry <= maxRetries; retry++) {
      const wait = lastStart + intervalMs - Date.now()
      if (wait > 0) await sleep(wait)
      lastStart = Date.now()
      try {
        return await fn()
      } catch (error) {
        const converted = toNotionServiceError(error)
        lastError = converted
        if (!converted.retryable || retry === maxRetries) throw converted
        await sleep(retryAfterMs(error) ?? baseDelayMs * 2 ** retry)
      }
    }
    throw lastError
  }

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(() => attempt(fn))
    // 앞선 요청이 실패해도 큐는 계속 진행한다
    tail = result.catch(() => undefined)
    return result
  }
}

export const notionRequest = createNotionRunner()

let client: Client | undefined

// SDK 자체 재시도는 끄고 위 실행기에서만 재시도한다
export function getNotionClient(): Client {
  client ??= new Client({
    auth: env.NOTION_API_KEY,
    retry: false,
    timeoutMs: 30_000,
  })
  return client
}

// 포트폴리오 하위 문서의 메타데이터 (본문 제외)
export interface NotionDocument {
  id: string
  title: string
  createdTime: string
  lastEditedTime: string
}

// 포트폴리오 페이지의 child_page 블록 ID·제목을 모두 가져온다 (페이지네이션 처리)
async function listChildPages(
  parentId: string
): Promise<{ id: string; title: string }[]> {
  const notion = getNotionClient()
  const pages: { id: string; title: string }[] = []
  let cursor: string | undefined

  do {
    const response = await notionRequest(() =>
      notion.blocks.children.list({
        block_id: parentId,
        page_size: 100,
        start_cursor: cursor,
      })
    )
    for (const block of response.results) {
      if ('type' in block && block.type === 'child_page') {
        pages.push({ id: block.id, title: block.child_page.title })
      }
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return pages
}

/**
 * 포트폴리오 하위 문서 목록을 최신 수정순으로 반환한다.
 * 블록 메타데이터의 시각은 부정확하므로 pages.retrieve로 실제 시각을 가져온다.
 */
export async function getDocumentList(): Promise<NotionDocument[]> {
  const notion = getNotionClient()
  const children = await listChildPages(env.NOTION_PORTFOLIO_PAGE_ID)

  const documents: NotionDocument[] = []
  for (const child of children) {
    const page = await notionRequest(() =>
      notion.pages.retrieve({ page_id: child.id })
    )
    if (!('created_time' in page)) continue
    documents.push({
      id: child.id,
      title: child.title,
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
    })
  }

  return documents.sort((a, b) =>
    b.lastEditedTime.localeCompare(a.lastEditedTime)
  )
}

// ---------------------------------------------------------------------------
// 페이지 본문 → 구조화 텍스트(마크다운) 변환
// ---------------------------------------------------------------------------

const richTextToPlain = (richText: RichTextItemResponse[]): string =>
  richText.map(item => item.plain_text).join('')

// 블록의 자식 블록을 페이지네이션으로 모두 가져온다
async function listBlockChildren(
  blockId: string
): Promise<BlockObjectResponse[]> {
  const notion = getNotionClient()
  const blocks: BlockObjectResponse[] = []
  let cursor: string | undefined

  do {
    const response = await notionRequest(() =>
      notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor,
      })
    )
    for (const block of response.results) {
      if ('type' in block) blocks.push(block)
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return blocks
}

export interface PageTextResult {
  text: string
  /** 변환하지 못하고 건너뛴 블록 타입별 개수 */
  skippedBlocks: Record<string, number>
}

// 자식을 재귀하지 않는 블록: 다른 문서(child_page)는 별도 문서로 취급한다
const NO_RECURSE = new Set(['child_page', 'child_database'])

async function renderBlocks(
  blocks: BlockObjectResponse[],
  depth: number,
  skipped: Record<string, number>
): Promise<string[]> {
  const lines: string[] = []
  const indent = '  '.repeat(depth)
  let numbered = 0

  for (const block of blocks) {
    numbered = block.type === 'numbered_list_item' ? numbered + 1 : 0
    let own: string | undefined
    let recurseDepth = depth

    switch (block.type) {
      case 'paragraph':
        own = richTextToPlain(block.paragraph.rich_text)
        break
      case 'heading_1':
        own = `# ${richTextToPlain(block.heading_1.rich_text)}`
        break
      case 'heading_2':
        own = `## ${richTextToPlain(block.heading_2.rich_text)}`
        break
      case 'heading_3':
        own = `### ${richTextToPlain(block.heading_3.rich_text)}`
        break
      case 'bulleted_list_item':
        own = `${indent}- ${richTextToPlain(block.bulleted_list_item.rich_text)}`
        recurseDepth = depth + 1
        break
      case 'numbered_list_item':
        own = `${indent}${numbered}. ${richTextToPlain(block.numbered_list_item.rich_text)}`
        recurseDepth = depth + 1
        break
      case 'to_do':
        own = `${indent}- [${block.to_do.checked ? 'x' : ' '}] ${richTextToPlain(block.to_do.rich_text)}`
        recurseDepth = depth + 1
        break
      case 'toggle':
        own = `${indent}- ${richTextToPlain(block.toggle.rich_text)}`
        recurseDepth = depth + 1
        break
      case 'quote':
        own = `> ${richTextToPlain(block.quote.rich_text)}`
        break
      case 'callout':
        own = `> ${richTextToPlain(block.callout.rich_text)}`
        break
      case 'code':
        own = `\`\`\`${block.code.language}\n${richTextToPlain(block.code.rich_text)}\n\`\`\``
        break
      case 'divider':
        own = '---'
        break
      case 'table': {
        const rows = await listBlockChildren(block.id)
        const tableLines = rows.flatMap(row =>
          row.type === 'table_row'
            ? [
                // 셀 안의 줄바꿈은 표 구조를 깨므로 ' / '로 치환한다
                `| ${row.table_row.cells.map(cell => richTextToPlain(cell).replace(/\s*\n\s*/g, ' / ')).join(' | ')} |`,
              ]
            : []
        )
        if (block.table.has_column_header && tableLines.length > 0) {
          const columns = block.table.table_width
          tableLines.splice(1, 0, `|${' --- |'.repeat(columns)}`)
        }
        lines.push(...tableLines, '')
        continue
      }
      case 'column_list':
      case 'column':
      case 'synced_block':
        // 컨테이너 블록: 자체 텍스트 없이 자식만 이어 붙인다
        break
      default:
        if (!NO_RECURSE.has(block.type)) {
          skipped[block.type] = (skipped[block.type] ?? 0) + 1
        }
        continue
    }

    if (own !== undefined) lines.push(own)

    if (block.has_children && !NO_RECURSE.has(block.type)) {
      const children = await listBlockChildren(block.id)
      lines.push(...(await renderBlocks(children, recurseDepth, skipped)))
    }
  }

  return lines
}

/**
 * 페이지 본문을 마크다운 형태의 구조화 텍스트로 변환한다.
 * child_page는 별도 문서이므로 재귀하지 않고, 이미지 등 텍스트가 없는
 * 블록은 건너뛰며 로그를 남긴다. (PRD §3.1)
 */
export async function getPageContent(pageId: string): Promise<PageTextResult> {
  const skippedBlocks: Record<string, number> = {}
  const blocks = await listBlockChildren(pageId)
  const lines = await renderBlocks(blocks, 0, skippedBlocks)

  if (Object.keys(skippedBlocks).length > 0) {
    console.warn(
      `[notion] 텍스트로 변환하지 못한 블록(${pageId}):`,
      skippedBlocks
    )
  }

  return { text: lines.join('\n').trim(), skippedBlocks }
}

export async function getPageText(pageId: string): Promise<string> {
  return (await getPageContent(pageId)).text
}

// 출처로 쓸 수 있도록 문서 ID·제목과 본문 텍스트를 함께 담는다
export interface NotionDocumentContent {
  id: string
  title: string
  text: string
}

// 페이지의 title 속성을 평문으로 읽는다
async function getPageTitle(pageId: string): Promise<string> {
  const notion = getNotionClient()
  const page = await notionRequest(() =>
    notion.pages.retrieve({ page_id: pageId })
  )
  if (!('properties' in page)) return ''
  for (const property of Object.values(page.properties)) {
    if (property.type === 'title') return richTextToPlain(property.title)
  }
  return ''
}

/**
 * 포트폴리오 페이지 자체 본문(하위 페이지 제외)을 하나의 문서로 반환한다.
 * child_page는 getPageContent에서 재귀하지 않으므로 하위 문서 내용이 섞이지 않는다.
 */
export async function getPortfolioText(): Promise<NotionDocumentContent> {
  const id = env.NOTION_PORTFOLIO_PAGE_ID
  const [title, { text }] = await Promise.all([
    getPageTitle(id),
    getPageContent(id),
  ])
  return { id, title, text }
}
