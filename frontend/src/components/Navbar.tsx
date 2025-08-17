'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()
      
      if (data) {
        setUserProfile(data)
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
    { name: 'マイページ', href: '/dashboard' },
    { name: 'アンケート一覧', href: '/surveys' },
    { name: 'アンケート作成', href: '/create-survey' },
    { name: 'データマーケット', href: '/data-market' },
    { name: '抽選イベント', href: '/lottery' },
  ]

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side: Logo, Navigation, Points, and User (Desktop) */}
          <div className="flex items-center space-x-8">
            {/* Logo & Brand */}
            <Link href="/dashboard" className="flex items-center space-x-3">
              <img src="/logo.png" alt="Gakurisa" className="h-10 w-auto" />
            </Link>

            {/* Desktop Navigation */}
            {user && (
              <div className="hidden lg:flex items-center space-x-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      px-3 py-2 text-sm font-medium transition-colors duration-200
                      ${pathname === item.href 
                        ? 'text-blue-600 border-b-2 border-blue-600' 
                        : 'text-gray-600 hover:text-gray-900'
                      }
                    `}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Desktop: Points and User Menu */}
            {user && (
              <div className="hidden lg:flex items-center space-x-4">
                {/* Points Display */}
                <div className="flex items-center bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg px-3 py-1.5 shadow-sm">
                  <svg className="w-4 h-4 text-white mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className="text-white text-sm font-semibold">
                    {userProfile?.points?.toLocaleString() || 0}
                  </span>
                </div>

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-white text-sm font-semibold">
                        {(userProfile?.username || user.user_metadata?.full_name || user.email || '').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">
                          {userProfile?.username || user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.email}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleSignOut()
                          setIsUserMenuOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                      >
                        ログアウト
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side: Mobile Menu and Points (Mobile only) */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Points Display - Mobile only */}
                <div className="lg:hidden flex items-center bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg px-3 py-1.5 shadow-sm">
                  <svg className="w-4 h-4 text-white mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className="text-white text-sm font-semibold">
                    {userProfile?.points?.toLocaleString() || 0}
                  </span>
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-1">
              {/* User Info Mobile */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white font-semibold">
                      {(userProfile?.username || user.user_metadata?.full_name || user.email || '').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-gray-900 font-medium text-sm">
                      {userProfile?.username || user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Items Mobile */}
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`
                    block px-4 py-3 text-sm font-medium rounded-md transition-colors duration-200
                    ${pathname === item.href 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  {item.name}
                </Link>
              ))}

              {/* Logout Button Mobile */}
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors duration-200 mt-2 border-t border-gray-200 pt-4"
              >
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}