import { describe, expect, it } from 'vitest'

import { cleanNotionMarkdown } from '@/lib/notion-markdown'

describe('cleanNotionMarkdown', () => {
  it('이미지는 제거하고 개수를 센다', () => {
    const r = cleanNotionMarkdown(
      '앞 문장\n\n![](https://prod-files-secure.s3.us-west-2.amazonaws.com/abc/def?X-Amz=1)\n\n![사진](https://x.test/a.png)\n뒤 문장'
    )
    expect(r.images).toBe(2)
    expect(r.text).not.toContain('http')
    expect(r.text).toContain('앞 문장')
    expect(r.text).toContain('뒤 문장')
  })

  it('HTML 표를 | 구분 행으로 바꾸고 헤더 행 구분선을 넣는다', () => {
    const md = [
      '<table header-row="true">',
      '<tr>',
      '<td>구분</td>',
      '<td>내용</td>',
      '</tr>',
      '<tr>',
      '<td>경력</td>',
      '<td>- 회사 A<br>- 회사 B</td>',
      '</tr>',
      '</table>',
    ].join('\n')
    const { text } = cleanNotionMarkdown(md)
    expect(text.split('\n')).toEqual([
      '| 구분 | 내용 |',
      '| --- | --- |',
      '| 경력 | - 회사 A / - 회사 B |',
    ])
  })

  it('헤더 행이 없는 표에는 구분선을 넣지 않는다', () => {
    const { text } = cleanNotionMarkdown(
      '<table><tr><td>a</td><td>b</td></tr></table>'
    )
    expect(text).toBe('| a | b |')
  })

  it('셀 안의 파이프와 빈 셀을 안전하게 처리한다', () => {
    const { text } = cleanNotionMarkdown(
      '<table><tr><td>a \\| b</td><td></td></tr></table>'
    )
    expect(text).toBe('| a / b |  |')
  })

  it('백슬래시 이스케이프를 푼다', () => {
    expect(
      cleanNotionMarkdown('2023.01 \\~ 2024.12 \\| 완료 \\* 메모').text
    ).toBe('2023.01 ~ 2024.12 | 완료 * 메모')
  })

  it('<br> 은 줄바꿈으로, 장식용 span 은 제거한다', () => {
    expect(
      cleanNotionMarkdown('첫 줄<br>둘째 줄 <span color="gray">회색</span>')
        .text
    ).toBe('첫 줄\n둘째 줄 회색')
  })

  it('본문에 쓴 < > 비교 기호는 건드리지 않는다', () => {
    expect(cleanNotionMarkdown('처리 시간 < 1초, 정확도 > 95%').text).toBe(
      '처리 시간 < 1초, 정확도 > 95%'
    )
  })

  it('제목·목록·인용 같은 일반 마크다운은 그대로 둔다', () => {
    const md = '## 경력\n- 항목 1\n  - 하위 항목\n1. 번호 항목\n> 인용문'
    expect(cleanNotionMarkdown(md).text).toBe(md)
  })

  it('연속된 빈 줄을 줄이고 앞뒤 공백을 정리한다', () => {
    expect(cleanNotionMarkdown('\n\na\n\n\n\n\nb  \n\n').text).toBe('a\n\nb')
  })

  it('빈 입력은 빈 결과', () => {
    expect(cleanNotionMarkdown('')).toEqual({ text: '', images: 0 })
  })
})

describe('cleanNotionMarkdown 링크', () => {
  it('메일 링크는 주소를 한 번만 남긴다', () => {
    expect(
      cleanNotionMarkdown('[test@example.com](mailto:test@example.com)').text
    ).toBe('test@example.com')
  })

  it('글자와 주소가 같은 웹 링크는 한 번만 남긴다', () => {
    expect(
      cleanNotionMarkdown('[https://a.test/x](https://a.test/x)').text
    ).toBe('https://a.test/x')
  })

  it('글자가 다른 웹 링크는 주소를 괄호로 남긴다', () => {
    expect(
      cleanNotionMarkdown('[포트폴리오](https://a.test/x) 참고').text
    ).toBe('포트폴리오 (https://a.test/x) 참고')
  })

  it('이미지는 링크 처리보다 먼저 제거된다', () => {
    const r = cleanNotionMarkdown('![](https://a.test/img.png) 본문')
    expect(r.images).toBe(1)
    expect(r.text).toBe('본문')
  })
})

describe('cleanNotionMarkdown 하위 페이지·임베드', () => {
  it('하위 페이지 참조는 본문에서 제거한다 (별도 문서이므로)', () => {
    const md = [
      '<empty-block/>',
      '<page url="https://www.notion.so/abc">손문배 이력서</page>',
      '<page url="https://www.notion.so/def">지원서</page>',
      '<empty-block/>',
    ].join('\n')
    expect(cleanNotionMarkdown(md).text).toBe('')
  })

  it('임베드·파일은 제거하고 개수에 포함한다', () => {
    const md =
      '앞\n<embed src="https://prod-files-secure.s3.amazonaws.com/x?sig=1"/>\n<file src="https://f.test/a.pdf">문서</file>\n뒤'
    const r = cleanNotionMarkdown(md)
    expect(r.text).toBe('앞\n\n\n뒤'.replace(/\n{3,}/g, '\n\n'))
    expect(r.images).toBe(2)
    expect(r.text).not.toContain('http')
  })

  it('본문 사이의 하위 페이지 참조만 빠지고 나머지 문장은 남는다', () => {
    const md =
      '## 소개\n문장입니다.\n<page url="https://n.so/x">제목</page>\n다음 문장'
    expect(cleanNotionMarkdown(md).text).toBe(
      '## 소개\n문장입니다.\n\n다음 문장'
    )
  })
})
