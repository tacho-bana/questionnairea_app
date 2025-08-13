'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          router.push('/auth?error=' + encodeURIComponent(error.message))
          return
        }

        if (data.session?.user) {
          const user = data.session.user
          
          // Check if user exists in our users table
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          if (fetchError && fetchError.code === 'PGRST116') {
            // User doesn't exist, create new user record
            const { error: insertError } = await supabase
              .from('users')
              .insert([
                {
                  id: user.id,
                  email: user.email!,
                  username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                  points: 0,
                  reputation_score: 100,
                  is_banned: false,
                },
              ])

            if (insertError) {
              console.error('Error creating user:', insertError)
            }
          }

          router.push('/dashboard')
        } else {
          router.push('/auth')
        }
      } catch (error) {
        console.error('Callback error:', error)
        router.push('/auth')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">ログイン処理中...</p>
      </div>
    </div>
  )
}