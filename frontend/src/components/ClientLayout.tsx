'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useAuth()
  
  // 認証が不要なページ（ログインページなど）
  const publicPages = ['/auth', '/', '/register']
  const isPublicPage = publicPages.includes(pathname)
  
  // ユーザーがログインしていない、かつパブリックページでない場合は子コンポーネントをそのまま表示
  if (!user && !isPublicPage) {
    return <>{children}</>
  }
  
  // ログインページなどのパブリックページではサイドバーを表示しない
  if (isPublicPage || !user) {
    return <>{children}</>
  }
  
  // ログイン済みユーザーにはサイドバー付きレイアウトを表示
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-6">
        {children}
      </main>
    </div>
  )
}