'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Notification = Database['public']['Tables']['notifications']['Row'] & {
  is_read?: boolean
  points_claimed?: boolean
}

export default function NotificationDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [notification, setNotification] = useState<Notification | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimLoading, setClaimLoading] = useState(false)

  useEffect(() => {
    if (id && user) {
      fetchNotificationDetail()
    }
  }, [id, user])

  const fetchNotificationDetail = async () => {
    if (!user) return

    try {
      // お知らせ詳細を取得
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (notificationError) {
        console.error('Error fetching notification:', notificationError)
        return
      }

      // 既読状態を確認
      const { data: read } = await supabase
        .from('user_notification_reads')
        .select('id')
        .eq('user_id', user.id)
        .eq('notification_id', id as string)
        .single()

      // ポイント受け取り状態を確認
      const { data: claimed } = await supabase
        .from('notification_point_claims')
        .select('id')
        .eq('user_id', user.id)
        .eq('notification_id', id as string)
        .single()

      const notificationWithStatus = {
        ...notificationData,
        is_read: !!read,
        points_claimed: !!claimed
      }

      setNotification(notificationWithStatus)

      // 未読の場合は自動的に既読にする
      if (!read) {
        await markAsRead(id as string)
      }

    } catch (error) {
      console.error('Error fetching notification detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    if (!user) return

    try {
      await supabase
        .from('user_notification_reads')
        .upsert([
          {
            user_id: user.id,
            notification_id: notificationId
          }
        ])
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const claimPoints = async () => {
    if (!user || !notification || claimLoading) return

    setClaimLoading(true)
    try {
      const { data, error } = await supabase.rpc('claim_notification_points', {
        p_notification_id: notification.id,
        p_user_id: user.id
      })

      if (error) throw error

      const result = data as { success: boolean; points_claimed?: number; error?: string; message?: string }

      if (result.success) {
        alert(`${result.points_claimed}ポイントを獲得しました！`)
        setNotification(prev => prev ? { ...prev, points_claimed: true } : null)
        // ポイント獲得後にページをリフレッシュしてポイント表示を更新
        window.location.reload()
      } else {
        alert(result.error || 'ポイントの受け取りに失敗しました')
      }

    } catch (error: any) {
      console.error('Error claiming points:', error)
      alert('ポイントの受け取りに失敗しました: ' + error.message)
    } finally {
      setClaimLoading(false)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      default: // info
        return (
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
  }

  const isClaimExpired = () => {
    if (!notification?.claim_deadline) return false
    return new Date(notification.claim_deadline) < new Date()
  }

  const isClaimLimitReached = () => {
    if (!notification?.max_claims) return false
    return notification.current_claims >= notification.max_claims
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-300 rounded mb-6"></div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!notification) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              お知らせが見つかりません
            </h3>
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700"
            >
              戻る
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            お知らせ一覧に戻る
          </button>
        </div>

        {/* お知らせ詳細 */}
        <div className="bg-white border rounded-xl overflow-hidden shadow-lg">
          {/* ヘッダー部分 */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start space-x-4">
              {getNotificationIcon(notification.type)}
              
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {notification.title}
                </h1>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>
                    {new Date(notification.created_at).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
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
                </div>
              </div>
            </div>
          </div>

          {/* ポイント特典がある場合 */}
          {notification.reward_points > 0 && (
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">プレゼント</h3>
                  <p className="text-gray-700 mb-2">
                    <span className="font-bold text-green-600">{notification.reward_points}ポイント</span> が届きました。
                  </p>
                  
                  {notification.max_claims && (
                    <p className="text-sm text-gray-600 mb-1">
                      受け取り可能人数: {notification.current_claims}/{notification.max_claims}人
                    </p>
                  )}
                  
                  {notification.claim_deadline && (
                    <p className="text-sm text-gray-600">
                      受け取り期限: {new Date(notification.claim_deadline).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
                
                <div className="ml-6">
                  {notification.points_claimed ? (
                    <div className="bg-gray-100 text-gray-600 px-6 py-3 rounded-lg font-medium flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      受け取り済み
                    </div>
                  ) : isClaimExpired() ? (
                    <div className="bg-red-100 text-red-600 px-6 py-3 rounded-lg font-medium">
                      受け取り期限切れ
                    </div>
                  ) : isClaimLimitReached() ? (
                    <div className="bg-yellow-100 text-yellow-600 px-6 py-3 rounded-lg font-medium">
                      受け取り上限に達しました
                    </div>
                  ) : (
                    <button
                      onClick={claimPoints}
                      disabled={claimLoading}
                      className="bg-green-400 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium flex items-center transition-colors"
                    >
                      {claimLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                            <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          受け取り中...
                        </>
                      ) : (
                        <>
                          {notification.reward_points}pt 受け取る
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* コンテンツ */}
          <div className="p-6">
            <div className="prose max-w-none">
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {notification.content}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}