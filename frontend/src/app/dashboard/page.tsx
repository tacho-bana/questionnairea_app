'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase-client'
import { Database } from '@/types/database'

type Survey = Database['public']['Tables']['surveys']['Row']
type PointTransaction = Database['public']['Tables']['point_transactions']['Row']

export default function Dashboard() {
  const { user } = useAuth()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [recentSurveys, setRecentSurveys] = useState<Survey[]>([])
  const [recentTransactions, setRecentTransactions] = useState<PointTransaction[]>([])
  const [stats, setStats] = useState({
    totalSurveys: 0,
    completedSurveys: 0,
    totalEarnings: 0,
  })

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()

      setUserProfile(profile)

      const { data: surveys } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentSurveys(surveys || [])

      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentTransactions(transactions || [])

      const { data: completedSurveys } = await supabase
        .from('survey_responses')
        .select('survey_id')
        .eq('respondent_id', user?.id)

      const totalEarnings = transactions?.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0) || 0

      setStats({
        totalSurveys: surveys?.length || 0,
        completedSurveys: completedSurveys?.length || 0,
        totalEarnings,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">ダッシュボード</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">P</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          保有ポイント
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {userProfile?.points || 0}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">S</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          回答済みアンケート
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {stats.completedSurveys}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">E</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          総獲得ポイント
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {stats.totalEarnings}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">R</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          信頼度スコア
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {userProfile?.reputation_score || 100}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    最新アンケート
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    回答可能な最新のアンケート一覧
                  </p>
                </div>
                <ul className="divide-y divide-gray-200">
                  {recentSurveys.map((survey) => (
                    <li key={survey.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {survey.title}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              {survey.reward_points}pt
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              {survey.description?.slice(0, 100)}...
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    最近の取引履歴
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    ポイントの獲得・消費履歴
                  </p>
                </div>
                <ul className="divide-y divide-gray-200">
                  {recentTransactions.map((transaction) => (
                    <li key={transaction.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {transaction.description}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              transaction.amount > 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.amount > 0 ? '+' : ''}{transaction.amount}pt
                            </p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            {new Date(transaction.created_at).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}