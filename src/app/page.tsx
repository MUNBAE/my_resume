import { redirect } from 'next/navigation'

// 이 앱의 시작 화면은 문서 선택이다. 별도의 소개·로그인 화면은 두지 않는다.
export default function Home() {
  redirect('/resume')
}
