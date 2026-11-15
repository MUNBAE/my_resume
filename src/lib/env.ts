import { z } from 'zod'

// 서버 전용 환경변수 검증 — 클라이언트 컴포넌트에서 import 금지
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  VERCEL_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NOTION_API_KEY: z.string().min(1, 'NOTION_API_KEY가 설정되지 않았습니다'),
  NOTION_RESUME_DB_ID: z
    .string()
    .min(1, 'NOTION_RESUME_DB_ID가 설정되지 않았습니다'),
  NOTION_QNA_DB_ID: z.string().min(1, 'NOTION_QNA_DB_ID가 설정되지 않았습니다'),
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, 'ANTHROPIC_API_KEY가 설정되지 않았습니다'),
})

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_RESUME_DB_ID: process.env.NOTION_RESUME_DB_ID,
  NOTION_QNA_DB_ID: process.env.NOTION_QNA_DB_ID,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
})

export type Env = z.infer<typeof envSchema>
