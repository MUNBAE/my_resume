// 브라우저에서 내부 API를 호출하고 실패를 사용자에게 보여줄 한글 메시지로 정리한다.
// 서버가 JSON 오류를 주지 않는 경우(네트워크 단절, 게이트웨이 오류, 인증 만료 등)도 처리한다.

export type FailureKind =
  | 'network' // 서버에 닿지 못함
  | 'unauthorized' // 인증 필요·만료
  | 'rate_limit' // 요청 과다
  | 'timeout' // 응답 시간 초과
  | 'server' // 서버·외부 서비스 오류
  | 'request' // 요청 자체가 잘못됨 (재시도해도 같은 결과)

export interface ApiFailure {
  ok: false
  kind: FailureKind
  /** 화면에 그대로 보여줄 한글 메시지 */
  message: string
  status: number | null
  /** 같은 요청을 다시 보내면 성공할 수 있는지 */
  retryable: boolean
  /** 서버가 보낸 JSON 본문 (없으면 null) */
  body: Record<string, unknown> | null
}

export type ApiResult<T> = { ok: true; data: T } | ApiFailure

const FALLBACK: Record<FailureKind, string> = {
  network:
    '네트워크에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.',
  unauthorized:
    '인증이 필요하거나 만료되었습니다. 페이지를 새로고침해 다시 로그인해 주세요.',
  rate_limit: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  timeout: '응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  server: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  request: '요청을 처리하지 못했습니다.',
}

/** HTTP 상태 코드를 실패 유형으로 분류한다 */
export function classifyStatus(status: number): {
  kind: FailureKind
  retryable: boolean
} {
  if (status === 401) return { kind: 'unauthorized', retryable: false }
  if (status === 429) return { kind: 'rate_limit', retryable: true }
  if (status === 408 || status === 504)
    return { kind: 'timeout', retryable: true }
  if (status >= 500) return { kind: 'server', retryable: true }
  return { kind: 'request', retryable: false }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** JSON 본문 POST. 어떤 실패든 예외를 던지지 않고 ApiFailure 로 돌려준다 */
export async function postJson<T>(
  url: string,
  payload: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: FALLBACK.network,
      status: null,
      retryable: true,
      body: null,
    }
  }

  // 본문이 JSON이 아닐 수 있다 (HTML 오류 페이지, 빈 응답 등)
  let body: Record<string, unknown> | null = null
  try {
    const parsed: unknown = await response.json()
    body = isRecord(parsed) ? parsed : null
  } catch {
    body = null
  }

  if (response.ok) {
    if (body === null) {
      return {
        ok: false,
        kind: 'server',
        message: '서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.',
        status: response.status,
        retryable: true,
        body: null,
      }
    }
    return { ok: true, data: body as T }
  }

  const { kind, retryable } = classifyStatus(response.status)
  const serverMessage =
    body && typeof body.error === 'string' && body.error.trim() !== ''
      ? body.error
      : undefined
  return {
    ok: false,
    kind,
    // 서버가 준 한글 메시지가 있으면 그것이 가장 구체적이다
    message: serverMessage ?? FALLBACK[kind],
    status: response.status,
    retryable,
    body,
  }
}
