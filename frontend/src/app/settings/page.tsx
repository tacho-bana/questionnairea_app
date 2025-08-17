'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['users']['Row']

export default function SettingsPage() {
  const { user } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    gender: '',
    birth_date: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
  }, [user])

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      setUserProfile(data)
      setFormData({
        username: data.username || '',
        gender: data.gender || '',
        birth_date: data.birth_date || ''
      })
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !userProfile) return

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          username: formData.username || null,
          gender: formData.gender || null,
          birth_date: formData.birth_date || null
        })
        .eq('id', user.id)

      if (error) throw error

      // プロフィールを再取得（リアルタイム更新が反映されるまで少し待つ）
      setTimeout(async () => {
        await fetchUserProfile()
        setIsEditing(false)
        alert('プロフィールを更新しました！')
      }, 1000)
    } catch (error: any) {
      console.error('Error updating profile:', error)
      alert('プロフィールの更新に失敗しました: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (userProfile) {
      setFormData({
        username: userProfile.username || '',
        gender: userProfile.gender || '',
        birth_date: userProfile.birth_date || ''
      })
    }
    setIsEditing(false)
  }

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'male': return '男性'
      case 'female': return '女性'
      case 'other': return 'その他'
      case 'prefer_not_to_say': return '回答しない'
      default: return '未設定'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '未設定'
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    return age
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">設定</h1>
          <p className="text-gray-600">アカウント情報を管理できます</p>
        </div>

        {/* Profile Information */}
        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">プロフィール情報</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                編集
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ユーザー名
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="ユーザー名を入力"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  性別
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">選択してください</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                  <option value="prefer_not_to_say">回答しない</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  生年月日
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    ユーザー名
                  </label>
                  <p className="text-lg text-gray-900">
                    {userProfile?.username || '未設定'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    メールアドレス
                  </label>
                  <p className="text-lg text-gray-900">
                    {user?.email}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    性別
                  </label>
                  <p className="text-lg text-gray-900">
                    {getGenderLabel(userProfile?.gender || '')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    生年月日
                  </label>
                  <div>
                    <p className="text-lg text-gray-900">
                      {formatDate(userProfile?.birth_date || '')}
                    </p>
                    {userProfile?.birth_date && (
                      <p className="text-sm text-gray-500">
                        ({calculateAge(userProfile.birth_date)}歳)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account Information */}
        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">アカウント情報</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                保有ポイント
              </label>
              <p className="text-2xl font-bold text-blue-600">
                {userProfile?.points?.toLocaleString() || 0} pt
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                登録日
              </label>
              <p className="text-lg text-gray-900">
                {new Date(userProfile?.created_at || '').toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

      </div>
    </ProtectedRoute>
  )
}