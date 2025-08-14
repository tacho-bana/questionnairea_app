'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type LotteryEvent = Database['public']['Tables']['lottery_events']['Row']
type LotteryEntry = Database['public']['Tables']['lottery_entries']['Row']

export default function LotteryPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<LotteryEvent[]>([])
  const [userEntries, setUserEntries] = useState<LotteryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [entryLoading, setEntryLoading] = useState<string | null>(null)
  const [userPoints, setUserPoints] = useState(0)

  useEffect(() => {
    if (user) {
      fetchLotteryData()
      fetchUserData()
    }
  }, [user])

  const fetchLotteryData = async () => {
    try {
      const { data: eventsData, error } = await supabase
        .from('lottery_events')
        .select('*')
        .eq('status', 'active')
        .order('end_date', { ascending: true })

      if (eventsData) {
        setEvents(eventsData)
      }

      if (user) {
        const { data: entriesData } = await supabase
          .from('lottery_entries')
          .select('*')
          .eq('user_id', user.id)

        if (entriesData) {
          setUserEntries(entriesData)
        }
      }
    } catch (error) {
      console.error('Error fetching lottery data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserData = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('points')
        .eq('id', user.id)
        .single()

      if (data) {
        setUserPoints(data.points)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }

  const handleEntry = async (event: LotteryEvent) => {
    if (!user) return

    setEntryLoading(event.id)

    try {
      // Check if user has enough points
      if (userPoints < event.entry_cost) {
        alert('ポイントが不足しています')
        return
      }

      // Check if user already entered
      const existingEntry = userEntries.find(entry => entry.event_id === event.id)
      if (existingEntry) {
        alert('既にこの抽選に参加しています')
        return
      }

      // Check if event is full
      if (event.max_participants && event.current_participants >= event.max_participants) {
        alert('参加者数が上限に達しています')
        return
      }

      // Create lottery entry
      const { error: entryError } = await supabase
        .from('lottery_entries')
        .insert([
          {
            event_id: event.id,
            user_id: user.id
          }
        ])

      if (entryError) throw entryError

      // Deduct points from user
      const { error: transactionError } = await supabase
        .from('point_transactions')
        .insert([
          {
            user_id: user.id,
            amount: -event.entry_cost,
            transaction_type: 'event_entry',
            related_id: event.id,
            description: `抽選参加: ${event.title}`
          }
        ])

      if (transactionError) throw transactionError

      // Update user points
      const { error: updateUserPointsError } = await supabase
        .rpc('increment_user_points', {
          user_id: user.id,
          amount: -event.entry_cost
        })

      if (updateUserPointsError) throw updateUserPointsError

      // Update event participant count
      const { error: updateError } = await supabase
        .from('lottery_events')
        .update({ 
          current_participants: event.current_participants + 1 
        })
        .eq('id', event.id)

      if (updateError) throw updateError

      alert('抽選に参加しました！')
      
      // Refresh data
      fetchLotteryData()
      fetchUserData()

    } catch (error: any) {
      console.error('Error entering lottery:', error)
      alert('参加に失敗しました: ' + error.message)
    } finally {
      setEntryLoading(null)
    }
  }

  const isEventExpired = (endDate: string) => {
    return new Date(endDate) < new Date()
  }

  const getDaysRemaining = (endDate: string) => {
    const now = new Date()
    const end = new Date(endDate)
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const hasUserEntered = (eventId: string) => {
    return userEntries.some(entry => entry.event_id === eventId)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">抽選イベント</h1>
              <div className="text-right">
                <div className="text-sm text-gray-600">保有ポイント</div>
                <div className="text-2xl font-bold text-blue-600">{userPoints}pt</div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {events.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">🎯</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      開催中の抽選イベントがありません
                    </h3>
                    <p className="text-gray-500">
                      新しい抽選イベントをお待ちください。
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((event) => {
                      const expired = isEventExpired(event.end_date)
                      const daysRemaining = getDaysRemaining(event.end_date)
                      const userEntered = hasUserEntered(event.id)
                      const isFull = event.max_participants && event.current_participants >= event.max_participants

                      return (
                        <div key={event.id} className="bg-white overflow-hidden shadow rounded-lg">
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              {expired ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  終了
                                </span>
                              ) : isFull ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  満員
                                </span>
                              ) : userEntered ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  参加済み
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  参加可能
                                </span>
                              )}
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {event.entry_cost}pt
                              </span>
                            </div>
                            
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              {event.title}
                            </h3>
                            
                            <p className="text-sm text-gray-600 mb-4">
                              {event.description}
                            </p>

                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-4">
                              <div className="flex items-center">
                                <div className="text-2xl mr-3">🏆</div>
                                <div>
                                  <div className="font-medium text-gray-900">賞品</div>
                                  <div className="text-sm text-gray-600">{event.prize_description}</div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2 mb-4">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">参加者:</span>
                                <span className="font-medium">
                                  {event.current_participants}
                                  {event.max_participants ? ` / ${event.max_participants}` : ''}人
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">締切:</span>
                                <span className="font-medium">
                                  {expired ? (
                                    <span className="text-red-600">終了</span>
                                  ) : (
                                    <span className="text-green-600">
                                      あと{daysRemaining}日
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">終了日:</span>
                                <span className="font-medium">
                                  {new Date(event.end_date).toLocaleDateString('ja-JP')}
                                </span>
                              </div>
                            </div>

                            {event.max_participants && (
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      (event.current_participants / event.max_participants) * 100,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            )}
                            
                            <button
                              onClick={() => handleEntry(event)}
                              disabled={
                                entryLoading === event.id ||
                                expired ||
                                userEntered ||
                                isFull ||
                                userPoints < event.entry_cost
                              }
                              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                            >
                              {entryLoading === event.id ? (
                                '参加中...'
                              ) : expired ? (
                                '終了済み'
                              ) : userEntered ? (
                                '参加済み'
                              ) : isFull ? (
                                '満員'
                              ) : userPoints < event.entry_cost ? (
                                'ポイント不足'
                              ) : (
                                `${event.entry_cost}ptで参加`
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-yellow-900 mb-2">抽選イベントについて</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• ポイントを消費して抽選イベントに参加できます</li>
                <li>• 当選者は抽選終了後に発表されます</li>
                <li>• 1つのイベントにつき1回のみ参加可能です</li>
                <li>• 参加費の返金はありません</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}