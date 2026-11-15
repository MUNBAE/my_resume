// HTTP Basic 인증 검증 (순수 함수, Edge 런타임에서도 동작하도록 Node 전용 API를 쓰지 않는다)

export interface Credentials {
  user: string
  password: string
}

/** "Authorization: Basic xxx" 헤더에서 사용자·비밀번호를 꺼낸다. 형식이 틀리면 null */
export function parseBasicAuth(header: string | null): Credentials | null {
  if (!header) return null
  const match = /^Basic\s+([A-Za-z0-9+/=_-]+)\s*$/i.exec(header)
  if (!match) return null

  try {
    const binary = atob(match[1].replace(/-/g, '+').replace(/_/g, '/'))
    // 한글 등 UTF-8 자격 증명을 위해 바이트로 디코딩한다
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const colon = decoded.indexOf(':')
    if (colon === -1) return null
    return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) }
  } catch {
    return null
  }
}

/** 길이와 내용에 상관없이 비슷한 시간이 걸리도록 비교한다 (타이밍 공격 완화) */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  const length = Math.max(x.length, y.length)
  let diff = x.length ^ y.length
  for (let i = 0; i < length; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return diff === 0
}

export function isAuthorized(
  header: string | null,
  expected: Credentials
): boolean {
  const given = parseBasicAuth(header)
  if (!given) return false
  // 두 값을 모두 비교해 어느 쪽이 틀렸는지 시간으로 드러나지 않게 한다
  const userOk = safeEqual(given.user, expected.user)
  const passwordOk = safeEqual(given.password, expected.password)
  return userOk && passwordOk
}
