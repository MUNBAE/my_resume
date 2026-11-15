import { z } from 'zod'

// 서버 전용 환경변수 검증 — 클라이언트 컴포넌트에서 import 금지
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  VERCEL_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NOTION_API_KEY: z.string().min(1, 'NOTION_API_KEY가 설정되지 않았습니다'),
  NOTION_PORTFOLIO_PAGE_ID: z
    .string()
    .min(1, 'NOTION_PORTFOLIO_PAGE_ID가 설정되지 않았습니다'),
  // Claude 호출 시점(src/lib/claude.ts)에 존재 여부를 검사한다.
  // Notion 조회만 쓰는 Phase 2에서는 없어도 서버가 동작해야 한다.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
})

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_PORTFOLIO_PAGE_ID: process.env.NOTION_PORTFOLIO_PAGE_ID,
  // .env에 빈 값(`KEY=`)으로 둔 경우 미설정으로 취급한다
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
})

export type Env = z.infer<typeof envSchema>
