import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // env.ts가 import 시점에 검증하므로 테스트용 더미 값을 넣는다 (실제 키가 아니다)
    env: {
      NOTION_API_KEY: 'test-notion-key',
      NOTION_PORTFOLIO_PAGE_ID: 'test-portfolio-page-id',
    },
  },
})
