import { Container } from '@/components/layout/container'
import { Skeleton } from '@/components/ui/skeleton'

// 서버에서 Notion 문서 목록을 읽는 동안 보여준다
export default function ResumeLoading() {
  return (
    <main className="flex-1 py-10" aria-busy="true" aria-label="불러오는 중">
      <Container size="md">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 mb-6 h-4 w-72" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[72px] w-full" />
          ))}
          <Skeleton className="h-9 w-32" />
        </div>
      </Container>
    </main>
  )
}
