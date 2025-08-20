'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Notification = Database['public']['Tables']['notifications']['Row'] & {
  is_read?: boolean
  points_claimed?: boolean
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [claimLoading, setClaimLoading] = useState(false)
  const [markAllLoading, setMarkAllLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  const fetchNotifications = async () => {
    if (!user) return

    try {
      // お知らせを取得
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError)
        return
      }

      // 既読状態を取得
      const { data: reads } = await supabase
        .from('user_notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)

      // ポイント受け取り状態を取得
      const { data: claims } = await supabase
        .from('notification_point_claims')
        .select('notification_id')
        .eq('user_id', user.id)

      const readNotificationIds = new Set(reads?.map(r => r.notification_id) || [])
      const claimedNotificationIds = new Set(claims?.map(c => c.notification_id) || [])

      // お知らせに既読状態とポイント受け取り状態を追加
      const notificationsWithReadStatus = (notificationsData || []).map(notification => ({
        ...notification,
        is_read: readNotificationIds.has(notification.id),
        points_claimed: claimedNotificationIds.has(notification.id)
      }))

      setNotifications(notificationsWithReadStatus)

      // 未読数を計算
      const unreadNotifications = notificationsWithReadStatus.filter(n => !n.is_read)
      setUnreadCount(unreadNotifications.length)

    } catch (error) {
      console.error('Error in fetchNotifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    if (!user) return

    try {
      // 既読記録を作成
      await supabase
        .from('user_notification_reads')
        .upsert([
          {
            user_id: user.id,
            notification_id: notificationId
          }
        ])

      // ローカル状態を更新
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        )
      )

      // 未読数を再計算
      setUnreadCount(prev => Math.max(0, prev - 1))

    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const markAllAsReadAndClaimPoints = async () => {
    if (!user || markAllLoading) return

    setMarkAllLoading(true)
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read)
      const unclaimedPointNotifications = notifications.filter(n => 
        n.reward_points > 0 && 
        !n.points_claimed && 
        !isClaimExpired(n) && 
        !isClaimLimitReached(n)
      )
      
      if (unreadNotifications.length === 0 && unclaimedPointNotifications.length === 0) {
        setMarkAllLoading(false)
        return
      }

      let totalPointsEarned = 0
      let claimResults: string[] = []

      // 未読を既読にする
      if (unreadNotifications.length > 0) {
        const readsToInsert = unreadNotifications.map(notification => ({
          user_id: user.id,
          notification_id: notification.id
        }))

        await supabase
          .from('user_notification_reads')
          .upsert(readsToInsert)
      }

      // ポイントを一括受け取り
      for (const notification of unclaimedPointNotifications) {
        try {
          const { data, error } = await supabase.rpc('claim_notification_points', {
            p_notification_id: notification.id,
            p_user_id: user.id
          })

          if (error) {
            console.error(`Error claiming points for ${notification.id}:`, error)
            claimResults.push(`「${notification.title}」: エラー`)
            continue
          }

          const result = data as { success: boolean; points_claimed?: number; error?: string }

          if (result.success && result.points_claimed) {
            totalPointsEarned += result.points_claimed
            claimResults.push(`「${notification.title}」: ${result.points_claimed}pt`)
          } else {
            claimResults.push(`「${notification.title}」: ${result.error || '失敗'}`)
          }
        } catch (error) {
          console.error(`Exception claiming points for ${notification.id}:`, error)
          claimResults.push(`「${notification.title}」: エラー`)
        }
      }

      // ローカル状態を更新
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({
          ...notification,
          is_read: true,
          points_claimed: notification.points_claimed || unclaimedPointNotifications.some(n => n.id === notification.id)
        }))
      )

      setUnreadCount(0)

      // 結果を表示
      if (totalPointsEarned > 0 || claimResults.length > 0) {
        let message = ''
        if (unreadNotifications.length > 0) {
          message += `${unreadNotifications.length}件を既読にしました。\n`
        }
        if (totalPointsEarned > 0) {
          message += `合計${totalPointsEarned}ポイントを獲得しました！\n\n詳細:\n${claimResults.join('\n')}`
        } else if (claimResults.length > 0) {
          message += `ポイント受け取り結果:\n${claimResults.join('\n')}`
        }
        alert(message)
      } else if (unreadNotifications.length > 0) {
        alert(`${unreadNotifications.length}件を既読にしました。`)
      }

    } catch (error) {
      console.error('Error in markAllAsReadAndClaimPoints:', error)
      alert('処理中にエラーが発生しました。')
    } finally {
      setMarkAllLoading(false)
    }
  }

  const openNotificationModal = async (notification: Notification) => {
    setSelectedNotification(notification)
    
    // 未読の場合は既読にする
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
  }

  const closeNotificationModal = () => {
    setSelectedNotification(null)
  }

  const claimPoints = async () => {
    if (!user || !selectedNotification || claimLoading) return

    setClaimLoading(true)
    try {
      const { data, error } = await supabase.rpc('claim_notification_points', {
        p_notification_id: selectedNotification.id,
        p_user_id: user.id
      })

      if (error) throw error

      const result = data as { success: boolean; points_claimed?: number; error?: string; message?: string }

      if (result.success) {
        alert(`${result.points_claimed}ポイントを獲得しました！`)
        // ローカル状態を更新
        setNotifications(prev => 
          prev.map(n => 
            n.id === selectedNotification.id 
              ? { ...n, points_claimed: true } 
              : n
          )
        )
        setSelectedNotification(prev => 
          prev ? { ...prev, points_claimed: true } : null
        )
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

  const isClaimExpired = (notification: Notification) => {
    if (!notification.claim_deadline) return false
    return new Date(notification.claim_deadline) < new Date()
  }

  const isClaimLimitReached = (notification: Notification) => {
    if (!notification.max_claims) return false
    return notification.current_claims >= notification.max_claims
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      default: // info
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
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
            戻る
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">お知らせ</h1>
              <p className="text-gray-600 mt-2">
                システムからの重要なお知らせを確認できます
              </p>
            </div>
            
            {(unreadCount > 0 || notifications.some(n => n.reward_points > 0 && !n.points_claimed && !isClaimExpired(n) && !isClaimLimitReached(n))) && (
              <button
                onClick={markAllAsReadAndClaimPoints}
                disabled={markAllLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2"
              >
                {markAllLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>処理中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>すべて既読・受け取り</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          {unreadCount > 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                {unreadCount}件の未読のお知らせがあります
              </p>
            </div>
          )}
        </div>

        {/* お知らせ一覧 */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📢</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              お知らせはありません
            </h3>
            <p className="text-gray-500">
              新しいお知らせが配信されるとここに表示されます
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white border rounded-xl transition-all duration-200 hover:shadow-lg ${
                  notification.is_read ? 'border-gray-200' : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div 
                  className="block p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openNotificationModal(notification)}
                >
                  <div className="flex items-start space-x-4">
                    {getNotificationIcon(notification.type)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className={`text-lg font-semibold ${
                            notification.is_read ? 'text-gray-900' : 'text-gray-900'
                          }`}>
                            {notification.title}
                            {!notification.is_read && (
                              <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                          </h3>
                          
                          {/* ポイント特典がある場合の表示 */}
                          {notification.reward_points > 0 && (
                            <div className="mt-3 flex items-center space-x-2">
                              {notification.points_claimed ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  ✓ {notification.reward_points}pt 受け取り済み
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  🎁 {notification.reward_points}pt 特典あり
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-sm text-gray-500">
                              {new Date(notification.created_at).toLocaleString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            
                            <div className="flex items-center text-blue-600">
                              <span className="text-sm font-medium">詳細を見る</span>
                              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            ))}
          </div>
        )}
        
        {/* モーダル */}
        {selectedNotification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-8 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* モーダルヘッダー */}
              <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-xl font-bold text-gray-900">お知らせ詳細</h2>
                <button
                  onClick={closeNotificationModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* モーダルコンテンツ */}
              <div className="p-6">
                {/* ヘッダー部分 */}
                <div className="flex items-start space-x-4 mb-6">
                  {getNotificationIcon(selectedNotification.type)}
                  
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      {selectedNotification.title}
                    </h1>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>
                        {new Date(selectedNotification.created_at).toLocaleString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedNotification.type === 'success' ? 'bg-green-100 text-green-800' :
                        selectedNotification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        selectedNotification.type === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedNotification.type === 'success' ? '成功' :
                         selectedNotification.type === 'warning' ? '警告' :
                         selectedNotification.type === 'error' ? 'エラー' : '情報'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ポイント特典がある場合 */}
                {selectedNotification.reward_points > 0 && (
                  <div className="p-4 border border-gray-200 rounded-xl mb-6 bg-gradient-to-r from-green-50 to-blue-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">🎁 特典ポイント</h3>
                        <p className="text-gray-700 mb-2">
                          このお知らせをご覧いただいた方に <span className="font-bold text-green-600">{selectedNotification.reward_points}ポイント</span> をプレゼント！
                        </p>
                        
                        {selectedNotification.claim_deadline && (
                          <p className="text-sm text-gray-600">
                            受け取り期限: {new Date(selectedNotification.claim_deadline).toLocaleDateString('ja-JP', {
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
                        {selectedNotification.points_claimed ? (
                          <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-medium flex items-center text-sm">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            受け取り済み
                          </div>
                        ) : isClaimExpired(selectedNotification) ? (
                          <div className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium text-sm">
                            受け取り期限切れ
                          </div>
                        ) : isClaimLimitReached(selectedNotification) ? (
                          <div className="bg-yellow-100 text-yellow-600 px-4 py-2 rounded-lg font-medium text-sm">
                            受け取り上限に達しました
                          </div>
                        ) : (
                          <button
                            onClick={claimPoints}
                            disabled={claimLoading}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors text-sm"
                          >
                            {claimLoading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                                  <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                受け取り中...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                {selectedNotification.reward_points}pt 受け取る
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* コンテンツ */}
                <div className="prose max-w-none">
                  <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {selectedNotification.content}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}