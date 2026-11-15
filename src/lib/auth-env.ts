// 접근 제한용 환경변수. Notion 키 검증(env.ts)과 분리해, 미들웨어가 Notion 설정과 무관하게 동작하도록 한다.
// 서버 전용 — 클라이언트 컴포넌트에서 import 금지
import { z } from 'zod'

const MIN_PASSWORD_LENGTH = 8

const authSchema = z.object({
  BASIC_AUTH_USER: z.string().min(1).optional(),
  BASIC_AUTH_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH).optional(),
})

export type AuthConfig =
  /** 사용자·비밀번호가 모두 올바르게 설정됨 */
  | { state: 'configured'; user: string; password: string }
  /** 아직 설정하지 않음 */
  | { state: 'missing' }
  /** 한쪽만 있거나 비밀번호가 너무 짧음 */
  | { state: 'invalid'; reason: string }

// `.env`에 `KEY=`처럼 빈 값으로 둔 경우는 미설정으로 취급한다
const clean = (value: string | undefined) => value || undefined

export function readAuthConfig(
  source: Record<string, string | undefined> = process.env
): AuthConfig {
  const user = clean(source.BASIC_AUTH_USER)
  const password = clean(source.BASIC_AUTH_PASSWORD)

  if (!user && !password) return { state: 'missing' }
  if (!user || !password) {
    return {
      state: 'invalid',
      reason: 'BASIC_AUTH_USER와 BASIC_AUTH_PASSWORD를 둘 다 설정해야 합니다.',
    }
  }

  const parsed = authSchema.safeParse({
    BASIC_AUTH_USER: user,
    BASIC_AUTH_PASSWORD: password,
  })
  if (!parsed.success) {
    return {
      state: 'invalid',
      reason: `BASIC_AUTH_PASSWORD는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
    }
  }
  return { state: 'configured', user, password }
}
