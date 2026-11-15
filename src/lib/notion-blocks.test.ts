import { describe, expect, it } from 'vitest'

import {
  NOTION_TEXT_LIMIT,
  chunkBlocks,
  splitText,
  toNotionBlocks,
} from '@/lib/notion-blocks'
import { OUTPUT_EXAMPLE } from '@/lib/merge-prompt'
import { SRC_A, achievement, experience, makeResume } from '@/test/fixtures'
import { resumeSchema } from '@/types/resume'

type Block = { type: string } & Record<
  string,
  { rich_text: { text: { content: string } }[] }
>

const texts = (block: Block) =>
  block[block.type].rich_text.map(r => r.text.content)

describe('splitText', () => {
  it('짧은 글은 그대로 둔다', () => {
    expect(splitText('abc')).toEqual(['abc'])
  })

  it('2000자를 넘으면 나누고 내용을 보존한다', () => {
    const long = '가나다라 '.repeat(1500).trim()
    const parts = splitText(long)
    expect(parts.length).toBeGreaterThanOrEqual(4)
    expect(parts.every(p => p.length <= NOTION_TEXT_LIMIT)).toBe(true)
    expect(parts.join('')).toBe(long)
  })

  it('공백이 없는 긴 글도 나눈다', () => {
    const long = 'x'.repeat(4500)
    const parts = splitText(long)
    expect(parts.every(p => p.length <= NOTION_TEXT_LIMIT)).toBe(true)
    expect(parts.join('')).toBe(long)
  })

  it('사용자 지정 한도를 지킨다', () => {
    expect(splitText('abcdef', 4).every(p => p.length <= 4)).toBe(true)
  })
})

describe('toNotionBlocks', () => {
  const resume = resumeSchema.parse(OUTPUT_EXAMPLE)
  const blocks = toNotionBlocks(resume) as unknown as Block[]

  it('섹션 제목 5개를 만든다', () => {
    expect(blocks.filter(b => b.type === 'heading_2')).toHaveLength(5)
  })

  it('경력 제목에 회사·직함·기간(현재)을 담는다', () => {
    const heading = texts(blocks[1])[0]
    expect(blocks[1].type).toBe('heading_3')
    expect(heading).toContain('예시회사')
    expect(heading).toContain('2021.03')
    expect(heading).toContain('현재')
  })

  it('성과를 불릿으로 만든다', () => {
    expect(
      blocks.filter(b => b.type === 'bulleted_list_item').length
    ).toBeGreaterThanOrEqual(2)
  })

  it('학력의 학위·졸업 여부·학점과 자격 등급을 포함한다', () => {
    const all = blocks.flatMap(texts).join('\n')
    expect(all).toContain('학사')
    expect(all).toContain('졸업')
    expect(all).toContain('학점 3.8 / 4.5')
    expect(all).toContain('합격')
  })

  it('빈 이력서는 블록이 없다', () => {
    expect(toNotionBlocks(makeResume())).toEqual([])
  })

  it('2000자가 넘는 요약·성과도 모든 조각이 한도 이하이다', () => {
    const long = '가나다라 '.repeat(600).trim()
    const result = toNotionBlocks(
      makeResume({
        experiences: [
          experience({
            id: 'e',
            company: 'A',
            startDate: '2020-01',
            endDate: null,
            summary: long,
            achievements: [achievement(long)],
          }),
        ],
      })
    ) as unknown as Block[]
    const lengths = result.flatMap(texts).map(t => t.length)
    expect(lengths.every(n => n <= NOTION_TEXT_LIMIT)).toBe(true)
    expect(result.some(b => b[b.type].rich_text.length > 1)).toBe(true)
  })

  it('출처 정보는 Notion 본문에 넣지 않는다', () => {
    const all = (
      toNotionBlocks(
        makeResume({ skills: [{ id: 's', name: 'Go', sources: [SRC_A] }] })
      ) as unknown as Block[]
    )
      .flatMap(texts)
      .join('\n')
    expect(all).not.toContain('doc-a')
  })
})

describe('chunkBlocks', () => {
  it('100개 단위로 나눈다', () => {
    const chunks = chunkBlocks(Array.from({ length: 250 }, (_, i) => i))
    expect(chunks.map(c => c.length)).toEqual([100, 100, 50])
  })

  it('빈 배열이면 청크가 없다', () => {
    expect(chunkBlocks([])).toEqual([])
  })
})
