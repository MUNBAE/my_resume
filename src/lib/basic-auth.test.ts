import { describe, expect, it } from 'vitest'

import { readAuthConfig } from '@/lib/auth-env'
import { isAuthorized, parseBasicAuth, safeEqual } from '@/lib/basic-auth'

const basic = (user: string, password: string) =>
  'Basic ' + Buffer.from(`${user}:${password}`, 'utf8').toString('base64')

describe('parseBasicAuth', () => {
  it('사용자·비밀번호를 꺼낸다', () => {
    expect(parseBasicAuth(basic('a', 'b'))).toEqual({
      user: 'a',
      password: 'b',
    })
  })

  it('비밀번호에 콜론이 있어도 첫 콜론에서만 나눈다', () => {
    expect(parseBasicAuth(basic('a', 'b:c'))?.password).toBe('b:c')
  })

  it('UTF-8(한글) 자격 증명을 처리한다', () => {
    expect(parseBasicAuth(basic('사용자', '비밀번호'))).toEqual({
      user: '사용자',
      password: '비밀번호',
    })
  })

  it('스킴 대소문자를 구분하지 않는다', () => {
    expect(
      parseBasicAuth('basic ' + Buffer.from('a:b').toString('base64'))
    ).not.toBeNull()
  })

  it.each([
    ['헤더 없음', null],
    ['Bearer 방식', 'Bearer abc'],
    ['base64 아님', 'Basic !!!!'],
    ['콜론 없음', 'Basic ' + Buffer.from('nocolon').toString('base64')],
    [
      '잘못된 UTF-8',
      'Basic ' + Buffer.from([0xff, 0xfe, 0x3a, 0x41]).toString('base64'),
    ],
  ])('%s 는 null', (_name, header) => {
    expect(parseBasicAuth(header as string | null)).toBeNull()
  })
})

describe('safeEqual', () => {
  it('같으면 true, 다르면 false', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
  })

  it('길이가 달라도 false (접두사만 같은 경우 포함)', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('abcd', 'abc')).toBe(false)
  })

  it('빈 문자열', () => {
    expect(safeEqual('', '')).toBe(true)
    expect(safeEqual('', 'a')).toBe(false)
  })
})

describe('isAuthorized', () => {
  const expected = { user: 'moonbae', password: 'p@ss:word-비밀번호' }

  it('올바른 자격 증명만 통과한다', () => {
    expect(isAuthorized(basic('moonbae', 'p@ss:word-비밀번호'), expected)).toBe(
      true
    )
    expect(isAuthorized(basic('moonbae', 'wrong'), expected)).toBe(false)
    expect(isAuthorized(basic('other', 'p@ss:word-비밀번호'), expected)).toBe(
      false
    )
    expect(isAuthorized(basic('moonbae', 'p@ss'), expected)).toBe(false)
    expect(isAuthorized(null, expected)).toBe(false)
  })
})

describe('readAuthConfig', () => {
  it('둘 다 없거나 빈 값이면 missing', () => {
    expect(readAuthConfig({}).state).toBe('missing')
    expect(
      readAuthConfig({ BASIC_AUTH_USER: '', BASIC_AUTH_PASSWORD: '' }).state
    ).toBe('missing')
  })

  it('한쪽만 있으면 invalid', () => {
    expect(readAuthConfig({ BASIC_AUTH_USER: 'a' }).state).toBe('invalid')
    expect(readAuthConfig({ BASIC_AUTH_PASSWORD: '12345678' }).state).toBe(
      'invalid'
    )
  })

  it('비밀번호가 8자 미만이면 invalid 이고 이유를 알려준다', () => {
    const r = readAuthConfig({
      BASIC_AUTH_USER: 'a',
      BASIC_AUTH_PASSWORD: '1234567',
    })
    expect(r.state === 'invalid' && r.reason.includes('8자')).toBe(true)
  })

  it('정상 설정', () => {
    expect(
      readAuthConfig({ BASIC_AUTH_USER: 'a', BASIC_AUTH_PASSWORD: '12345678' })
    ).toEqual({
      state: 'configured',
      user: 'a',
      password: '12345678',
    })
  })
})
