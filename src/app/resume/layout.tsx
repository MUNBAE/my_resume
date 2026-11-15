import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

// /resume 하위 모든 화면(로딩·오류 포함)이 같은 머리글·바닥글을 쓴다
export default function ResumeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {children}
      <Footer />
    </div>
  )
}
