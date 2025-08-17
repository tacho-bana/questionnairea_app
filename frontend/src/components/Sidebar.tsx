'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const lastFetchTime = useRef<number>(0)

  useEffect(() => {
    if (user) {
      fetchUserProfile()
      
      // Supabaseリアルタイム購読を設定
      const subscription = supabase
        .channel('user-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('User profile updated:', payload)
            // リアルタイムでプロフィールを更新
            setUserProfile(payload.new)
            
            // キャッシュも更新
            const cacheKey = `userProfile_${user.id}`
            localStorage.setItem(cacheKey, JSON.stringify({
              data: payload.new,
              timestamp: Date.now()
            }))
            
            // ポイント変更の場合はUIにフィードバックを提供
            if (payload.old?.points !== payload.new?.points) {
              console.log('Points updated from', payload.old?.points, 'to', payload.new?.points)
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'point_transactions',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New point transaction:', payload)
            // ポイント取引が発生したら即座にプロフィールを再取得
            fetchUserProfile(true)
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    // ページフォーカス時にポイント更新
    const handleFocus = () => {
      if (user) {
        console.log('Page focused, refreshing user profile for updated points')
        fetchUserProfile(true)
      }
    }

    // ページの可視性変更時にポイント更新
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log('Page became visible, refreshing user profile for updated points')
        fetchUserProfile(true)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  // ナビゲーション状態の監視とポイント更新
  useEffect(() => {
    const handleRouteChangeStart = () => {
      setIsNavigating(true)
    }

    const handleRouteChangeComplete = () => {
      setIsNavigating(false)
      setIsMobileMenuOpen(false) // モバイルメニューを閉じる
      
      // ページ遷移完了時にポイントを更新（キャッシュを無視）
      if (user) {
        console.log('Route changed, refreshing user profile for updated points')
        fetchUserProfile(true)
      }
    }

    // Next.js App Routerでのページ遷移は直接監視できないため、pathname変更を監視
    setIsNavigating(false)
    
    // ページ遷移時にポイント更新
    if (user) {
      setTimeout(() => {
        fetchUserProfile(true)
      }, 100)
    }
  }, [pathname, user])

  const fetchUserProfile = async (forceRefresh = false) => {
    try {
      const cacheKey = `userProfile_${user?.id}`
      const now = Date.now()
      
      // 連続呼び出し防止（1秒以内の重複呼び出しを防ぐ）
      if (!forceRefresh && now - lastFetchTime.current < 1000) {
        console.log('Skipping profile fetch due to rate limit')
        return
      }
      
      if (!forceRefresh) {
        // キャッシュから読み込みを試行（期間を30秒に短縮）
        const cachedProfile = localStorage.getItem(cacheKey)
        
        if (cachedProfile) {
          const parsed = JSON.parse(cachedProfile)
          // キャッシュが30秒以内であれば使用
          if (Date.now() - parsed.timestamp < 30 * 1000) {
            setUserProfile(parsed.data)
            return
          }
        }
      }
      
      lastFetchTime.current = now

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()
      
      if (data) {
        setUserProfile(data)
        // キャッシュに保存
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }))
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const navItems = [
    { 
      name: 'マイページ', 
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0H8v0z" />
        </svg>
      )
    },
    { 
      name: 'アンケート一覧', 
      href: '/surveys',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    { 
      name: 'アンケート作成', 
      href: '/create-survey',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    { 
      name: 'データマーケット', 
      href: '/data-market',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
        </svg>
      )
    },
    { 
      name: '抽選イベント', 
      href: '/lottery',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    },
  ]

  if (!user) return null

  // サイドバーのスケルトンコンポーネント
  const SkeletonSidebar = () => (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200 bg-white border border-gray-200 shadow-sm"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-70 z-40" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }} />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ backgroundColor: 'white' }}
        data-component="sidebar"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <img src="/logo.png" alt="Gakurisa" className="h-8 w-auto" />
          </Link>
        </div>

        {/* Points Display Skeleton */}
        <div className="p-4 border-b border-gray-200">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="text-sm font-medium text-blue-100">保有ポイント</span>
              </div>
              <button
                onClick={() => fetchUserProfile(true)}
                className="text-blue-100 hover:text-white transition-colors p-1 rounded"
                title="ポイントを更新"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className="mt-2">
              <div className="h-8 bg-white bg-opacity-20 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    if (pathname === item.href) {
                      e.preventDefault()
                      return
                    }
                    setIsMobileMenuOpen(false)
                  }}
                  className={`
                    flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User Menu Skeleton */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded animate-pulse mb-1"></div>
              <div className="h-3 bg-gray-300 rounded animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  // ユーザープロフィールが読み込み中の場合はスケルトンを表示
  if (!userProfile) {
    return <SkeletonSidebar />
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200 bg-white border border-gray-200 shadow-sm"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-70 z-40" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }} />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ backgroundColor: 'white' }}
        data-component="sidebar"
      >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center space-x-3">
          <img src="/logo.png" alt="Gakurisa" className="h-8 w-auto" />
        </Link>
      </div>

      {/* Points Display */}
      <div className="p-4 border-b border-gray-200">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span className="text-sm font-medium text-blue-100">保有ポイント</span>
            </div>
            <button
              onClick={() => fetchUserProfile(true)}
              className="text-blue-100 hover:text-white transition-colors p-1 rounded"
              title="ポイントを更新"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <div className="mt-2">
            <button
              onClick={() => fetchUserProfile(true)}
              className="text-left hover:bg-blue-600 hover:bg-opacity-30 rounded-lg p-1 -m-1 transition-colors duration-200"
              title="クリックでポイントを更新"
            >
              <span className="text-2xl font-bold text-white">
                {userProfile?.points?.toLocaleString() || 0}
              </span>
              <span className="text-blue-100 text-sm ml-1">pt</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (pathname === item.href) {
                    e.preventDefault()
                    return
                  }
                  setIsMobileMenuOpen(false)
                }}
                className={`
                  flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                  ${isNavigating && pathname !== item.href ? 'opacity-70' : ''}
                `}
              >
                <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-gray-200">
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-left"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-semibold">
                {(userProfile?.username || user.user_metadata?.full_name || user.email || '').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {userProfile?.username || user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user.email}
              </div>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
              <Link
                href="/settings"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>設定</span>
              </Link>
              <button
                onClick={() => {
                  handleSignOut()
                  setIsUserMenuOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}