// 이력서(최종본) → Notion 블록 변환 (순수 함수, 외부 호출 없음)
import type { BlockObjectRequest } from '@notionhq/client'

import type { Resume } from '@/types/resume'

// Notion은 rich_text 한 항목당 2000자까지만 허용한다
export const NOTION_TEXT_LIMIT = 2000

/** 긴 문자열을 2000자 이하 조각으로 나눈다 (가능하면 줄바꿈·공백에서 자른다) */
export function splitText(text: string, limit = NOTION_TEXT_LIMIT): string[] {
  if (text.length <= limit) return [text]
  const chunks: string[] = []
  let rest = text
  while (rest.length > limit) {
    const window = rest.slice(0, limit)
    const cut = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '))
    const at = cut > limit * 0.5 ? cut + 1 : limit
    chunks.push(rest.slice(0, at))
    rest = rest.slice(at)
  }
  if (rest) chunks.push(rest)
  return chunks
}

type RichText = { type: 'text'; text: { content: string } }[]

const richText = (text: string): RichText =>
  splitText(text).map(content => ({ type: 'text', text: { content } }))

const heading2 = (text: string): BlockObjectRequest => ({
  type: 'heading_2',
  heading_2: { rich_text: richText(text) },
})

const heading3 = (text: string): BlockObjectRequest => ({
  type: 'heading_3',
  heading_3: { rich_text: richText(text) },
})

const paragraph = (text: string): BlockObjectRequest => ({
  type: 'paragraph',
  paragraph: { rich_text: richText(text) },
})

const bullet = (text: string): BlockObjectRequest => ({
  type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: richText(text) },
})

// "2021-03" → "2021.03", null → "현재"
const part = (value: string | null | undefined) =>
  value === null ? '현재' : (value?.replace('-', '.') ?? '')

function period(start?: string, end?: string | null): string {
  if (!start && end === undefined) return ''
  return `${part(start)} – ${end === undefined ? '' : part(end)}`.trim()
}

const joinNonEmpty = (parts: (string | undefined)[], separator: string) =>
  parts.filter(p => p && p.trim() !== '').join(separator)

/**
 * 최종본을 Notion 페이지 본문 블록으로 변환한다.
 * 한 번에 최대 100블록까지만 보낼 수 있으므로 호출하는 쪽에서 chunkBlocks로 나눈다.
 */
export function toNotionBlocks(resume: Resume): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = []

  if (resume.experiences.length > 0) {
    blocks.push(heading2('경력'))
    for (const e of resume.experiences) {
      blocks.push(
        heading3(
          joinNonEmpty(
            [
              joinNonEmpty([e.company, e.position], ' · '),
              period(e.startDate, e.endDate),
            ],
            '  |  '
          )
        )
      )
      if (e.summary) blocks.push(paragraph(e.summary))
      for (const a of e.achievements) blocks.push(bullet(a.text))
    }
  }

  if (resume.projects.length > 0) {
    blocks.push(heading2('프로젝트'))
    for (const p of resume.projects) {
      blocks.push(
        heading3(
          joinNonEmpty(
            [
              joinNonEmpty([p.name, p.role], ' · '),
              period(p.startDate, p.endDate),
            ],
            '  |  '
          )
        )
      )
      if (p.summary) blocks.push(paragraph(p.summary))
      if (p.technologies.length > 0) {
        blocks.push(paragraph(`사용 기술: ${p.technologies.join(', ')}`))
      }
      for (const a of p.achievements) blocks.push(bullet(a.text))
    }
  }

  if (resume.skills.length > 0) {
    blocks.push(heading2('기술'))
    const groups = new Map<string, string[]>()
    for (const s of resume.skills) {
      const key = s.category?.trim() || '기타'
      groups.set(key, [...(groups.get(key) ?? []), s.name])
    }
    for (const [category, names] of groups) {
      blocks.push(bullet(`${category}: ${names.join(', ')}`))
    }
  }

  if (resume.educations.length > 0) {
    blocks.push(heading2('학력'))
    for (const e of resume.educations) {
      blocks.push(
        bullet(
          joinNonEmpty(
            [
              joinNonEmpty([e.school, e.major], ' · '),
              period(e.startDate, e.endDate),
            ],
            '  |  '
          )
        )
      )
    }
  }

  if (resume.certifications.length > 0) {
    blocks.push(heading2('자격·수상'))
    for (const c of resume.certifications) {
      blocks.push(
        bullet(
          joinNonEmpty(
            [joinNonEmpty([c.name, c.issuer], ' · '), part(c.date)],
            '  |  '
          )
        )
      )
    }
  }

  return blocks
}

/** Notion 한 번 요청당 최대 100블록 제한에 맞춰 나눈다 */
export function chunkBlocks<T>(blocks: T[], size = 100): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < blocks.length; i += size) {
    chunks.push(blocks.slice(i, i + size))
  }
  return chunks
}
