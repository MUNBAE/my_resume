import { NextResponse, type NextRequest } from 'next/server'

import { isAuthorized } from '@/lib/basic-auth'
import { readAuthConfig } from '@/lib/auth-env'

// 개인 이력서·지원서가 담긴 화면과 API를 Basic 인증으로 보호한다 (PRD §10)
export const config = {
  matcher: ['/resume/:path*', '/api/resume/:path*'],
}

const isApi = (request: NextRequest) =>
  request.nextUrl.pathname.startsWith('/api/')

function deny(
  request: NextRequest,
  status: 401 | 503,
  message: string
): NextResponse {
  const headers: Record<string, string> = {}
  if (status === 401) {
    headers['WWW-Authenticate'] = 'Basic realm="resume", charset="UTF-8"'
  }
  return isApi(request)
    ? NextResponse.json({ error: message }, { status, headers })
    : new NextResponse(message, {
        status,
        headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
      })
}

export function middleware(request: NextRequest) {
  const auth = readAuthConfig()

  if (auth.state !== 'configured') {
    // 운영(배포) 환경에서 설정이 없거나 잘못되면 열어 두지 않고 막는다
    if (process.env.NODE_ENV === 'production') {
      return deny(
        request,
        503,
        auth.state === 'invalid'
          ? `접근 제한 설정이 올바르지 않아 접속을 차단했습니다. ${auth.reason}`
          : '접근 제한이 설정되지 않아 접속을 차단했습니다. BASIC_AUTH_USER와 BASIC_AUTH_PASSWORD를 설정해 주세요.'
      )
    }
    // 로컬 개발에서는 편의를 위해 통과시킨다
    return NextResponse.next()
  }

  if (isAuthorized(request.headers.get('authorization'), auth)) {
    return NextResponse.next()
  }
  return deny(request, 401, '인증이 필요합니다.')
}
