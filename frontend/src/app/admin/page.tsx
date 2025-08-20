'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type User = Database['public']['Tables']['users']['Row']
type Notification = Database['public']['Tables']['notifications']['Row']

export default function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'notifications' | 'create'>('users')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    content: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    reward_points: 0,
    claim_deadline: ''
  })

  // Note: This is a basic admin check. In production, you'd have proper role-based access control
  const isAdmin = user?.email === 'yuto0421tachi@gmail.com' // Replace with your admin email

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers()
      fetchNotifications()
    } else {
      setLoading(false)
    }
  }, [user, isAdmin])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || submitLoading) return

    setSubmitLoading(true)
    try {
      const notificationData = {
        title: notificationForm.title,
        content: notificationForm.content,
        type: notificationForm.type,
        reward_points: notificationForm.reward_points,
        claim_deadline: notificationForm.claim_deadline || null
      }

      // 現在のセッションのアクセストークンを取得
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token found')
      }

      // サーバーサイドAPIを使用してRLS制限を回避
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include', // クッキーを含める
        body: JSON.stringify(notificationData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create notification')
      }

      // フォームをリセット
      setNotificationForm({
        title: '',
        content: '',
        type: 'info',
        reward_points: 0,
        claim_deadline: ''
      })

      // お知らせ一覧を再取得
      await fetchNotifications()
      
      alert('お知らせを投稿しました！')
      setActiveTab('notifications')
    } catch (error) {
      console.error('Error creating notification:', error)
      alert(`お知らせの投稿に失敗しました。${error instanceof Error ? error.message : ''}`)
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">アクセス拒否</h1>
            <p className="text-gray-600 mt-2">管理者権限が必要です。</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">管理者マイページ</h1>
          <p className="text-gray-600">システム管理とお知らせ投稿</p>
        </div>

        {/* タブナビゲーション */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'users'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ユーザー管理
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              お知らせ一覧
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'create'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              お知らせ作成
            </button>
          </nav>
        </div>

        {/* ユーザー管理タブ */}
        {activeTab === 'users' && (
          <div className="bg-white shadow-lg rounded-2xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">ユーザー一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ポイント
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      登録日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userItem) => (
                    <tr key={userItem.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {userItem.username || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">{userItem.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {userItem.points.toLocaleString()}pt
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(userItem.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userItem.is_banned
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {userItem.is_banned ? 'BAN済み' : 'アクティブ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* お知らせ一覧タブ */}
        {activeTab === 'notifications' && (
          <div className="bg-white shadow-lg rounded-2xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">お知らせ一覧</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div key={notification.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {notification.content}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notification.type === 'success' ? 'bg-green-100 text-green-800' :
                            notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            notification.type === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {notification.type === 'success' ? '成功' :
                             notification.type === 'warning' ? '警告' :
                             notification.type === 'error' ? 'エラー' : '情報'}
                          </span>
                          {notification.reward_points > 0 && (
                            <span className="text-green-600 font-medium">
                              {notification.reward_points}pt 特典
                            </span>
                          )}
                          <span>
                            {new Date(notification.created_at).toLocaleString('ja-JP')}
                          </span>
                          <span className={notification.is_active ? 'text-green-600' : 'text-red-600'}>
                            {notification.is_active ? '有効' : '無効'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  お知らせがありません
                </div>
              )}
            </div>
          </div>
        )}

        {/* お知らせ作成タブ */}
        {activeTab === 'create' && (
          <div className="bg-white shadow-lg rounded-2xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">新しいお知らせを作成</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleNotificationSubmit} className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    タイトル *
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="お知らせのタイトルを入力"
                  />
                </div>

                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                    内容 *
                  </label>
                  <textarea
                    id="content"
                    required
                    rows={6}
                    value={notificationForm.content}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="お知らせの内容を入力"
                  />
                </div>

                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                    種類
                  </label>
                  <select
                    id="type"
                    value={notificationForm.type}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="info">情報</option>
                    <option value="success">成功</option>
                    <option value="warning">警告</option>
                    <option value="error">エラー</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reward_points" className="block text-sm font-medium text-gray-700 mb-2">
                    特典ポイント
                  </label>
                  <input
                    type="number"
                    id="reward_points"
                    min="0"
                    value={notificationForm.reward_points}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, reward_points: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                  <p className="text-sm text-gray-500 mt-1">0の場合は特典なし</p>
                </div>

                <div>
                  <label htmlFor="claim_deadline" className="block text-sm font-medium text-gray-700 mb-2">
                    受け取り期限（任意）
                  </label>
                  <input
                    type="datetime-local"
                    id="claim_deadline"
                    value={notificationForm.claim_deadline}
                    onChange={(e) => setNotificationForm(prev => ({ ...prev, claim_deadline: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">空欄の場合は期限なし</p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    {submitLoading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                          <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        投稿中...
                      </div>
                    ) : (
                      'お知らせを投稿する'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}