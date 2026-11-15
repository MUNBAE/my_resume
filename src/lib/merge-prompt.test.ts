import { describe, expect, it } from 'vitest'

import {
  OUTPUT_EXAMPLE,
  PROMPT_MAX_CHARS,
  PROMPT_WARN_CHARS,
  buildMergePrompt,
  buildSchemaInstruction,
  checkPromptLength,
  extractJson,
  validateResumeJson,
} from '@/lib/merge-prompt'

const doc = (id: string, chars: number) => ({
  id,
  title: `문서${id}`,
  text: '가'.repeat(chars),
})

describe('buildMergePrompt', () => {
  const docs = [
    { id: 'doc-aaa', title: '이력서 A', text: '## 경력\n- 회사 2024.12 ~' },
    { id: 'doc-bbb', title: '지원서 B', text: '본문 { 중괄호 } 포함' },
  ]
  const prompt = buildMergePrompt(docs)

  it('문서마다 ID·제목·본문과 시작·끝 구분선을 담는다', () => {
    for (const d of docs) {
      expect(prompt).toContain(
        `문서 시작 | 문서 ID: ${d.id} | 제목: ${d.title}`
      )
      expect(prompt).toContain(`문서 끝 | 문서 ID: ${d.id}`)
      expect(prompt).toContain(d.text)
    }
    expect(prompt.indexOf('doc-aaa')).toBeLessThan(prompt.indexOf('doc-bbb'))
  })

  it.each([
    '근거 없는 내용 금지',
    '출처 필수',
    '기간이 겹치는지',
    'conflicts에 기록',
    '임의로 하나를 고르지 마세요',
    '최신순',
    'enriched',
    '수치는 원문 그대로',
    'JSON 하나만 출력',
    '"현재"',
  ])('규칙 문구 "%s" 를 포함한다', phrase => {
    expect(prompt).toContain(phrase)
  })

  it('보강 규칙: 정량 성과·역할·기술·문제 해결 추출과 출처 필수', () => {
    expect(prompt).toContain('정량 성과')
    expect(prompt).toContain('맡은 역할')
    expect(prompt).toContain('문제 해결')
    expect(prompt).toContain('근거가 된 문서 ID를 sources에 적으세요')
  })

  it('스키마 지시문을 포함하고 입력 문서가 마지막 섹션이다', () => {
    expect(prompt).toContain(buildSchemaInstruction())
    expect(prompt.lastIndexOf('## 입력 문서')).toBeGreaterThan(
      prompt.lastIndexOf('## 출력 형식')
    )
  })

  it('문서가 없어도 만들어진다', () => {
    expect(buildMergePrompt([])).toContain('## 입력 문서')
  })
})

describe('extractJson', () => {
  const obj = {
    a: 1,
    text: '중괄호 { } 와 "따옴표" 와 역슬래시 \\ 도',
    nested: { b: [1, { c: '}' }] },
  }
  const json = JSON.stringify(obj)
  const expectObj = (input: string) => {
    const result = extractJson(input)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(obj)
  }

  it('순수 JSON', () => expectObj(json))
  it('들여쓴 JSON', () => expectObj(JSON.stringify(obj, null, 2)))
  it('```json 코드 블록', () => expectObj('```json\n' + json + '\n```'))
  it('언어 표시 없는 코드 블록', () => expectObj('```\n' + json + '\n```'))
  it('앞뒤 설명문', () =>
    expectObj('네, 결과입니다.\n' + json + '\n끝. {참고}'))
  it('코드 블록 + 앞뒤 설명문', () =>
    expectObj('아래와 같습니다:\n```json\n' + json + '\n```\n설명'))
  it('앞에 다른 코드 블록이 있어도', () =>
    expectObj('```text\n무시\n```\n```json\n' + json + '\n```'))
  it('앞뒤 공백', () => expectObj('\n\n  ' + json + '  \n'))

  it('빈 입력은 오류', () => {
    const r = extractJson('  ')
    expect(!r.ok && r.message.includes('비어')).toBe(true)
  })

  it('JSON이 없으면 오류', () => {
    const r = extractJson('그냥 문장입니다.')
    expect(!r.ok && r.message.includes('찾지 못')).toBe(true)
  })

  it('깨진 JSON은 올바르지 않다고 안내한다', () => {
    const r = extractJson('```json\n{"a": 1, "b": }\n```')
    expect(!r.ok && r.message.includes('올바르지')).toBe(true)
  })

  it('중간에 잘린 JSON은 잘렸을 수 있다고 안내한다', () => {
    const r = extractJson(json.slice(0, json.length - 10))
    expect(!r.ok && r.message.includes('잘렸')).toBe(true)
  })

  it('최상위가 배열이면 거절한다', () => {
    expect(extractJson('[1,2,3]').ok).toBe(false)
  })
})

describe('validateResumeJson', () => {
  // 테스트에서 일부 필드를 망가뜨리기 위해 쓰기 가능한 형태로 복제한다
  type Mutable = {
    experiences: { sources: unknown[] }[]
    projects: { name?: string }[]
    skills: { name: string }[]
  }
  const valid = () => structuredClone(OUTPUT_EXAMPLE) as unknown as Mutable

  it('정상 결과(코드 블록 + 설명문)는 통과한다', () => {
    const r = validateResumeJson(
      '결과입니다.\n```json\n' + JSON.stringify(valid()) + '\n```'
    )
    expect(r.ok).toBe(true)
  })

  it('깨진 결과는 위치와 한글 메시지, 수정 요청 프롬프트를 돌려준다', () => {
    const broken = valid()
    broken.experiences[0].sources = []
    delete broken.projects[0].name
    broken.skills[0].name = ''
    const r = validateResumeJson(JSON.stringify(broken))

    expect(r.ok).toBe(false)
    if (r.ok) return
    const text = r.issues.map(i => `${i.location} ${i.message}`).join('\n')
    expect(text).toContain('경력 1번 > 출처')
    expect(text).toContain('프로젝트 1번 > name')
    expect(text).toContain('필수 항목이 없습니다')
    expect(text).toContain('기술 1번 > name')
    expect(text).toContain('비어 있을 수 없습니다')
    expect(text).not.toMatch(/Invalid input|Too small|expected string/)

    const fix = r.fixPrompt ?? ''
    expect(fix).toContain('발견된 오류')
    expect(fix).toContain('경력 1번 > 출처')
    expect(fix).toContain('지어내지 마세요')
    expect(fix).toContain('## 출력 형식')
    expect(fix).toContain('예시회사')
  })

  it('JSON이 아니면 수정 요청 프롬프트 없이 메시지만 돌려준다', () => {
    const r = validateResumeJson('죄송하지만 만들 수 없습니다.')
    expect(!r.ok && r.issues.length === 0 && r.fixPrompt === undefined).toBe(
      true
    )
  })

  it('오류가 많으면 수정 요청 프롬프트에는 30개까지만 싣는다', () => {
    const many = {
      skills: Array.from({ length: 40 }, (_, i) => ({
        id: `s${i}`,
        name: '',
        sources: [],
      })),
    }
    const r = validateResumeJson(JSON.stringify(many))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues.length).toBeGreaterThan(30)
      expect(r.fixPrompt).toContain('그 외')
    }
  })
})

describe('checkPromptLength', () => {
  it('정상 범위', () => {
    const r = checkPromptLength([doc('a', 1800), doc('b', 7500)])
    expect(r.level).toBe('ok')
    expect(r.message).toBe('')
    expect(r.totalChars).toBe(
      buildMergePrompt([doc('a', 1800), doc('b', 7500)]).length
    )
    expect(r.perDocument.map(d => d.chars)).toEqual([7500, 1800])
  })

  it('경고 구간: 큰 문서를 안내한다', () => {
    const r = checkPromptLength([doc('a', 20000), doc('b', 25000)])
    expect(r.level).toBe('warn')
    expect(r.totalChars).toBeGreaterThan(PROMPT_WARN_CHARS)
    expect(r.totalChars).toBeLessThanOrEqual(PROMPT_MAX_CHARS)
    expect(r.message).toContain('문서b')
    expect(r.message).toContain('25,000자')
  })

  it('너무 긴 경우: 나눠 실행하도록 안내한다', () => {
    const r = checkPromptLength([
      doc('a', 60000),
      doc('b', 50000),
      doc('c', 100),
    ])
    expect(r.level).toBe('too_long')
    expect(r.message).toContain('나눠서 실행')
    expect(r.message.indexOf('문서a')).toBeLessThan(r.message.indexOf('문서b'))
  })

  it('임계값을 지정할 수 있다', () => {
    expect(
      checkPromptLength([doc('a', 1000)], { warn: 100, max: 200 }).level
    ).toBe('too_long')
  })

  it('실제 규모(문서 4개, 약 1.3만 자)는 정상이다', () => {
    const r = checkPromptLength([
      doc('a', 1681),
      doc('b', 1964),
      doc('c', 1802),
      doc('d', 7473),
    ])
    expect(r.level).toBe('ok')
  })
})
