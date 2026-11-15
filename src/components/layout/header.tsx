'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Container } from '@/components/layout/container'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

// 이 도구의 작업 순서. 현재 단계를 머리글에 표시한다
const STEPS = [
  { href: '/resume', label: '문서 선택' },
  { href: '/resume/merge', label: '검토·저장' },
] as const

export function Header() {
  const pathname = usePathname()

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <Container size="md">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/resume" className="text-lg font-bold whitespace-nowrap">
            이력서 통합
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <nav aria-label="작업 단계">
              <ol className="flex items-center gap-1 text-xs sm:gap-2 sm:text-sm">
                {STEPS.map((step, index) => {
                  const current = pathname === step.href
                  return (
                    <li
                      key={step.href}
                      className="flex items-center gap-1 sm:gap-2"
                    >
                      {index > 0 && (
                        <span className="text-muted-foreground" aria-hidden>
                          ›
                        </span>
                      )}
                      <Link
                        href={step.href}
                        aria-current={current ? 'step' : undefined}
                        className={cn(
                          'rounded-md px-1.5 py-1 whitespace-nowrap transition-colors',
                          current
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {index + 1}. {step.label}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </header>
  )
}
