// Notion 마크다운 API 응답을 프롬프트에 넣기 좋은 평문 마크다운으로 정리한다 (순수 함수).
// 이미지(서명된 긴 URL)는 텍스트가 아니라서 제거하고, HTML 표는 | 구분 행으로 바꾸고,
// 백슬래시 이스케이프를 풀어 AI가 읽기 쉽게 만든다.

export interface CleanedMarkdown {
  text: string
  /** 제거한 이미지 개수 */
  images: number
}

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

// 백슬래시 이스케이프 해제: \~ \| \* \_ \# \[ \] 등
const unescapeMarkdown = (s: string) =>
  s.replace(/\\([\\`*_{}[\]()#+\-.!|~<>$&])/g, '$1')

// 표 셀 안의 내용: 줄바꿈은 ' / ', 남은 태그는 제거
function cellText(inner: string): string {
  return decodeEntities(
    inner
      .replace(/<br\s*\/?>/gi, ' / ')
      .replace(/<\/?(span|u|b|i|strong|em|code)\b[^>]*>/gi, '')
  )
    .replace(/\s*\/\s*(\/\s*)+/g, ' / ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*\/\s*|\s*\/\s*$/g, '')
    .trim()
}

// <table> 블록 하나를 | a | b | 행으로 바꾼다
function tableToPipes(table: string): string {
  const headerRow = /header-row\s*=\s*"true"/i.test(
    table.slice(0, table.indexOf('>') + 1)
  )
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell =>
      // 셀 안의 파이프는 열 구분과 헷갈리지 않게 바꾼다
      unescapeMarkdown(cellText(cell[1])).replace(/\|/g, '/')
    )
  )
  const lines = rows.map(cells => `| ${cells.join(' | ')} |`)
  if (headerRow && rows.length > 0) {
    lines.splice(1, 0, `|${' --- |'.repeat(rows[0].length)}`)
  }
  return lines.join('\n')
}

export function cleanNotionMarkdown(markdown: string): CleanedMarkdown {
  let images = 0
  let text = markdown.replace(/\r\n/g, '\n')

  // 이미지: ![대체텍스트](URL) — 텍스트 정보가 없고 URL이 매우 길다
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, () => {
    images++
    return ''
  })

  // 하위 페이지 참조(<page ...>제목</page>)는 별도 문서이므로 본문에서 뺀다.
  // 파일·임베드류는 텍스트가 아니고 서명된 긴 주소를 담고 있어 개수만 세고 제거한다
  text = text.replace(/<page\b[^>]*>[\s\S]*?<\/page>/gi, '')
  text = text.replace(
    /<(embed|video|audio|file|pdf)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gi,
    () => {
      images++
      return ''
    }
  )

  // 링크: [글자](주소) → 글자. 메일 주소가 두 번 나오는 것처럼 중복되는 것을 막고,
  // 글자와 주소가 다른 웹 링크만 주소를 괄호로 남긴다
  text = text.replace(
    /\[([^\]]+)\]\((mailto:[^)\s]+|https?:\/\/[^)\s]+)\)/g,
    (_match, label: string, url: string) => {
      const target = url.replace(/^mailto:/, '')
      return label === target || label === url ? label : `${label} (${target})`
    }
  )

  // 표
  text = text.replace(
    /<table\b[\s\S]*?<\/table>/gi,
    table => `\n${tableToPipes(table)}\n`
  )

  // 그 밖의 인라인 태그: 줄바꿈과 장식용 span 만 정리한다 (본문의 < 문자는 건드리지 않는다)
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(span|colgroup|col|empty-block)\b[^>]*\/?>/gi, '')

  // 백슬래시 이스케이프 해제: \~ \| \* \_ \# \[ \] 등
  text = unescapeMarkdown(text)

  text = decodeEntities(text)
    .split('\n')
    .map(line => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, images }
}
